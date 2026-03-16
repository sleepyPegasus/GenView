"""
LightRAG 知识图谱服务：按 project_id 隔离，聚合 Message/Page/Timeline 数据构建知识图谱。
"""

import json
import logging
from pathlib import Path

from lightrag import LightRAG, QueryParam
from lightrag.llm.openai import openai_complete_if_cache, openai_embed
from lightrag.llm.ollama import ollama_model_complete, ollama_embed
from lightrag.utils import EmbeddingFunc
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Conversation, KgBuildHistory, Message, Page, Project, ProjectTimelineEvent

logger = logging.getLogger("genview.lightrag")

# 按 (project_id, llm_name) 缓存的 LightRAG 实例，支持项目级 kg_model
_rag_instances: dict[tuple[str, str], LightRAG] = {}


def _make_embedding_func():
    """创建 Embedding 函数：本地 Ollama 或 OpenAI 兼容 API。"""
    if settings.lightrag_use_local:
        host = settings.lightrag_ollama_host
        model = settings.lightrag_ollama_embed
        dim = settings.lightrag_ollama_embed_dim

        async def _embed(texts: list[str]):
            # 使用 .func 绕过 ollama_embed 的 1024 维校验，由我们的 EmbeddingFunc 按配置维度校验
            raw = ollama_embed.func if hasattr(ollama_embed, "func") else ollama_embed
            return await raw(texts, embed_model=model, host=host)

        return EmbeddingFunc(embedding_dim=dim, max_token_size=8192, func=_embed)

    api_key = settings.embedding_api_key or settings.openrouter_api_key
    base_url = settings.embedding_base_url or "https://api.openai.com/v1"
    model = settings.embedding_model or "text-embedding-3-small"

    async def _embed(texts: list[str]):
        return await openai_embed(
            texts,
            model=model,
            base_url=base_url,
            api_key=api_key,
        )

    return EmbeddingFunc(
        embedding_dim=1536,
        max_token_size=8192,
        func=_embed,
    )


def _make_openrouter_llm_func(model_name: str):
    """创建使用指定模型的 OpenRouter LLM 函数。"""

    async def _openrouter_llm_complete(
        prompt,
        system_prompt=None,
        history_messages=None,
        **kwargs,
    ):
        if history_messages is None:
            history_messages = []
        return await openai_complete_if_cache(
            model_name,
            prompt,
            system_prompt=system_prompt,
            history_messages=history_messages,
            base_url="https://openrouter.ai/api/v1",
            api_key=settings.openrouter_api_key,
            **kwargs,
        )

    return _openrouter_llm_complete


def _make_llm_func(model_name: str | None = None):
    """创建 LLM 函数：本地 Ollama 或 OpenRouter。"""
    if settings.lightrag_use_local:
        return ollama_model_complete
    return _make_openrouter_llm_func(model_name or settings.default_model)


async def get_rag(project_id: str, db: AsyncSession | None = None) -> LightRAG:
    """按 project_id 获取或创建 LightRAG 实例，使用 workspace 隔离。支持项目级 kg_model。"""
    llm_name = settings.lightrag_ollama_llm if settings.lightrag_use_local else settings.default_model
    if db and not settings.lightrag_use_local:
        result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.deleted_at.is_(None),
            )
        )
        proj = result.scalar_one_or_none()
        if proj and getattr(proj, "kg_model", None):
            llm_name = proj.kg_model
        elif proj and getattr(proj, "model", None):
            llm_name = proj.model

    cache_key = (project_id, llm_name)
    if cache_key in _rag_instances:
        return _rag_instances[cache_key]

    working_dir = settings.lightrag_working_dir.rstrip("/")
    graph_storage = "Neo4JStorage" if settings.neo4j_uri else "NetworkXStorage"

    llm_kwargs: dict = {}
    if settings.lightrag_use_local:
        llm_kwargs = {
            "host": settings.lightrag_ollama_host,
            "think": settings.lightrag_ollama_think,  # Qwen3.5 等：False 关闭 thinking 加速
        }

    rag = LightRAG(
        working_dir=working_dir,
        workspace=project_id,
        embedding_func=_make_embedding_func(),
        llm_model_func=_make_llm_func(llm_name),
        llm_model_name=llm_name,
        llm_model_kwargs=llm_kwargs,
        graph_storage=graph_storage,
        addon_params={
            "language": "Simplified Chinese",
            "insert_batch_size": 20,
            "max_parallel_insert": 4,
            "llm_model_max_async": 8,
            "embedding_func_max_async": 8,
        },
    )

    if graph_storage == "Neo4JStorage" and settings.neo4j_uri:
        # Neo4j 连接参数通过环境变量传递，LightRAG 会读取
        import os
        os.environ.setdefault("NEO4J_URI", settings.neo4j_uri)
        os.environ.setdefault("NEO4J_USER", settings.neo4j_user)
        os.environ.setdefault("NEO4J_PASSWORD", settings.neo4j_password)

    await rag.initialize_storages()
    _rag_instances[cache_key] = rag
    mode = "local (Ollama)" if settings.lightrag_use_local else "cloud (OpenRouter)"
    logger.info(f"[LightRAG] Initialized for project {project_id} | mode={mode}")
    return rag


async def _aggregate_project_documents(
    project_id: str, db: AsyncSession
) -> tuple[list[str], list[str]]:
    """
    聚合项目下的 Message、Page、ProjectTimelineEvent 为文档列表。
    过滤 deleted_at 不为空的 Project。
    返回 (documents, ids)。
    """
    documents: list[str] = []
    ids: list[str] = []

    # 校验项目存在且未删除
    result = await db.execute(
        select(Project).where(
            Project.id == project_id,
            Project.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        return documents, ids

    # Message: 需关联 Conversation 获取 title
    conv_result = await db.execute(
        select(Conversation).where(Conversation.project_id == project_id)
    )
    convs = {c.id: c for c in conv_result.scalars().all()}

    msg_result = await db.execute(
        select(Message).where(Message.conversation_id.in_(convs.keys()))
    )
    for msg in msg_result.scalars().all():
        conv = convs.get(msg.conversation_id)
        title = conv.title if conv else "Unknown"
        parts = [f"[对话] {title}\n{msg.content or ''}"]
        if msg.code_block:
            parts.append(f"[代码]\n{msg.code_block}")
        doc = "\n".join(parts)
        if doc.strip():
            documents.append(doc)
            ids.append(f"msg_{msg.id}")

    # Page
    page_result = await db.execute(
        select(Page).where(Page.project_id == project_id)
    )
    for page in page_result.scalars().all():
        doc = f"[页面] {page.name}\n{page.code_block or ''}"
        if doc.strip():
            documents.append(doc)
            ids.append(f"page_{page.id}")

    # ProjectTimelineEvent
    ev_result = await db.execute(
        select(ProjectTimelineEvent).where(
            ProjectTimelineEvent.project_id == project_id
        )
    )
    for ev in ev_result.scalars().all():
        title = ev.title or ev.phase_label or "事件"
        parts = [f"[事件] {title}"]
        if ev.description:
            parts.append(str(ev.description))
        if ev.outcome:
            parts.append(str(ev.outcome))
        doc = "\n".join(parts)
        if doc.strip():
            documents.append(doc)
            ids.append(f"timeline_{ev.id}")

    return documents, ids


def _build_doc_source_map(project_id: str) -> dict[str, str]:
    """
    从 LightRAG workspace 的 doc_status 构建 doc_id -> 可读来源 映射。
    用于将 unknown_source 替换为「对话: 标题」「页面: 名称」「事件: 标题」等。
    """
    doc_source_map: dict[str, str] = {}
    base = Path(settings.lightrag_working_dir.rstrip("/")) / project_id
    status_path = base / "kv_store_doc_status.json"
    if not status_path.exists():
        return doc_source_map
    try:
        with open(status_path, encoding="utf-8") as f:
            data = json.load(f)
        for doc_id, info in data.items():
            if not isinstance(info, dict):
                continue
            summary = info.get("content_summary") or ""
            if not summary:
                continue
            first_line = summary.split("\n")[0].strip()
            if first_line.startswith("[对话]"):
                label = first_line[4:].strip() or "对话"
                doc_source_map[doc_id] = f"对话: {label}"
            elif first_line.startswith("[页面]"):
                label = first_line[4:].strip() or "页面"
                doc_source_map[doc_id] = f"页面: {label}"
            elif first_line.startswith("[事件]"):
                label = first_line[4:].strip() or "事件"
                doc_source_map[doc_id] = f"事件: {label}"
    except Exception as e:
        logger.debug(f"[LightRAG] _build_doc_source_map failed: {e}")
    return doc_source_map


def _build_chunk_to_doc_map(project_id: str) -> dict[str, str]:
    """从 doc_status 构建 chunk_id -> doc_id 映射，用于通过 chunk 反查来源文档。"""
    chunk_to_doc: dict[str, str] = {}
    base = Path(settings.lightrag_working_dir.rstrip("/")) / project_id
    status_path = base / "kv_store_doc_status.json"
    if not status_path.exists():
        return chunk_to_doc
    try:
        with open(status_path, encoding="utf-8") as f:
            data = json.load(f)
        for doc_id, info in data.items():
            if not isinstance(info, dict):
                continue
            for chunk_id in info.get("chunks_list") or []:
                chunk_to_doc[chunk_id] = doc_id
    except Exception as e:
        logger.debug(f"[LightRAG] _build_chunk_to_doc_map failed: {e}")
    return chunk_to_doc


def _resolve_file_path(
    properties: dict,
    doc_source_map: dict[str, str],
    chunk_to_doc: dict[str, str],
) -> None:
    """
    若 properties.file_path 为 unknown_source，尝试通过 chunk_ids 查找 doc_id 并替换为可读来源。
    原地修改 properties。
    """
    fp_val = properties.get("file_path")
    is_unknown = fp_val == "unknown_source" or (
        isinstance(fp_val, list)
        and fp_val
        and fp_val[0] == "unknown_source"
    )
    if not is_unknown:
        return
    chunk_ids = properties.get("chunk_ids") or properties.get("source_chunk_ids")
    if isinstance(chunk_ids, list) and chunk_ids:
        first_chunk = chunk_ids[0]
        if isinstance(first_chunk, str):
            doc_id = chunk_to_doc.get(first_chunk)
            if doc_id and doc_id in doc_source_map:
                properties["file_path"] = doc_source_map[doc_id]
                return
    file_paths = properties.get("file_paths")
    if isinstance(file_paths, list) and file_paths:
        fp = file_paths[0]
        if isinstance(fp, str) and fp in doc_source_map:
            properties["file_path"] = doc_source_map[fp]
            return
        if isinstance(fp, str) and fp != "unknown_source":
            properties["file_path"] = fp
            return


async def build_knowledge_graph(
    project_id: str, db: AsyncSession
) -> dict:
    """
    构建项目知识图谱，返回 {doc_count, status}。
    """
    documents, ids = await _aggregate_project_documents(project_id, db)
    doc_count = len(documents)

    if doc_count == 0:
        return {"doc_count": 0, "status": "no_documents"}

    try:
        rag = await get_rag(project_id, db)
        await rag.ainsert(documents, ids=ids)
        return {"doc_count": doc_count, "status": "success"}
    except Exception as e:
        logger.exception(f"[LightRAG] Build failed for project {project_id}: {e}")
        return {"doc_count": doc_count, "status": "error", "error": str(e)}


def _count_doc_types(ids: list[str]) -> tuple[int, int, int]:
    """统计 msg_、page_、timeline_ 数量。"""
    msg_c = sum(1 for i in ids if i.startswith("msg_"))
    page_c = sum(1 for i in ids if i.startswith("page_"))
    timeline_c = sum(1 for i in ids if i.startswith("timeline_"))
    return msg_c, page_c, timeline_c


async def get_project_doc_count(project_id: str, db: AsyncSession) -> dict:
    """获取项目可构建文档数量，用于构建前检查。"""
    documents, ids = await _aggregate_project_documents(project_id, db)
    msg_c, page_c, timeline_c = _count_doc_types(ids)
    return {
        "has_documents": len(documents) > 0,
        "doc_count": len(documents),
        "msg_count": msg_c,
        "page_count": page_c,
        "timeline_count": timeline_c,
    }


async def build_knowledge_graph_stream(project_id: str, db: AsyncSession):
    """
    构建项目知识图谱，异步生成 SSE 事件（log、progress、done、error）。
    按文档逐个插入以支持进度与日志流式输出。
    捕获 LightRAG 的 Python INFO 日志并转发到前端。
    """
    import json
    import time

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def _log(msg: str) -> str:
        ts = time.strftime("%H:%M:%S", time.localtime())
        return _sse("log", {"message": f"[{ts}] {msg}"})

    captured: list[str] = []
    _skip_prefixes = ("genview", "uvicorn", "sqlalchemy")

    class LightRAGLogCapture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            if record.levelno >= logging.INFO and not record.name.startswith(_skip_prefixes):
                try:
                    captured.append(self.format(record))
                except Exception:
                    pass

    capture_handler = LightRAGLogCapture()
    capture_handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    root_logger = logging.getLogger()
    root_logger.addHandler(capture_handler)

    def drain_captured():
        while captured:
            yield _log(captured.pop(0))

    try:
        documents, ids = await _aggregate_project_documents(project_id, db)
        total = len(documents)
        msg_count, page_count, timeline_count = _count_doc_types(ids)
        start_time = time.time()

        if total == 0:
            yield _log("无文档可处理")
            rec = KgBuildHistory(
                project_id=project_id,
                doc_count=0,
                msg_count=0,
                page_count=0,
                timeline_count=0,
                status="no_documents",
            )
            db.add(rec)
            await db.commit()
            yield _sse("done", {"doc_count": 0, "status": "no_documents"})
            return

        yield _log(f"开始构建，共 {total} 个文档（对话 {msg_count} · 页面 {page_count} · 事件 {timeline_count}）")
        yield _sse("progress", {"percent": 0, "current": 0, "total": total})

        try:
            rag = await get_rag(project_id, db)
            for chunk in drain_captured():
                yield chunk
            yield _log("LightRAG 已初始化")

            batch_size = 15
            for i in range(0, total, batch_size):
                batch_docs = documents[i : i + batch_size]
                batch_ids = ids[i : i + batch_size]
                await rag.ainsert(batch_docs, ids=batch_ids)
                for chunk in drain_captured():
                    yield chunk
                current = min(i + batch_size, total)
                percent = int(current / total * 100)
                yield _log(f"已处理 {current}/{total}")
                yield _sse("progress", {"percent": percent, "current": current, "total": total})

            for chunk in drain_captured():
                yield chunk
            duration = round(time.time() - start_time, 1)
            yield _log(f"构建完成，耗时 {duration}s")

            node_count, edge_count = None, None
            try:
                kg = await get_graph_for_visualization(project_id, max_nodes=2000)
                node_count = len(kg.get("nodes", []))
                edge_count = len(kg.get("edges", []))
                for chunk in drain_captured():
                    yield chunk
                yield _log(f"图谱统计: {node_count} 节点 · {edge_count} 边")
            except Exception as e:
                logger.debug(f"[LightRAG] get_graph_for_visualization failed: {e}")

            rec = KgBuildHistory(
                project_id=project_id,
                doc_count=total,
                msg_count=msg_count,
                page_count=page_count,
                timeline_count=timeline_count,
                node_count=node_count,
                edge_count=edge_count,
                duration_seconds=duration,
                status="success",
            )
            db.add(rec)
            await db.commit()
            yield _sse("done", {
                "doc_count": total,
                "status": "success",
                "duration_seconds": duration,
                "node_count": node_count,
                "edge_count": edge_count,
            })
        except Exception as e:
            duration = round(time.time() - start_time, 1)
            for chunk in drain_captured():
                yield chunk
            logger.exception(f"[LightRAG] Build failed for project {project_id}: {e}")
            yield _log(f"构建失败: {str(e)}")
            err_str = str(e).lower()
            error_type = "lightrag_insert"
            suggestion = "请检查 LightRAG 配置与数据"
            if "neo4j" in err_str or "connection" in err_str:
                error_type = "neo4j_connection"
                suggestion = "请检查 Neo4j 连接与配置"
            elif "timeout" in err_str:
                error_type = "timeout"
                suggestion = "请求超时，请稍后重试"
            yield _sse("error", {
                "message": str(e),
                "error_type": error_type,
                "suggestion": suggestion,
            })
            rec = KgBuildHistory(
                project_id=project_id,
                doc_count=total,
                msg_count=msg_count,
                page_count=page_count,
                timeline_count=timeline_count,
                duration_seconds=duration,
                status="error",
                error=str(e),
            )
            db.add(rec)
            await db.commit()
            yield _sse("done", {"doc_count": total, "status": "error", "error": str(e)})
    finally:
        root_logger.removeHandler(capture_handler)


async def query(
    project_id: str, question: str, mode: str = "hybrid", db: AsyncSession | None = None
) -> str:
    """RAG 查询，返回回答文本。"""
    rag = await get_rag(project_id, db)
    param = QueryParam(mode=mode)
    return await rag.aquery(question, param=param)


async def query_stream(project_id: str, question: str, mode: str = "hybrid", db: AsyncSession | None = None):
    """
    流式 RAG 查询：捕获 LightRAG 日志并 emit，再生成回答。
    Yields SSE: log, step, thinking, done, error.
    """
    import json
    import time

    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

    def _log(msg: str) -> str:
        ts = time.strftime("%H:%M:%S", time.localtime())
        return _sse("log", {"message": f"[{ts}] {msg}"})

    captured: list[str] = []
    _skip_prefixes = ("genview", "uvicorn", "sqlalchemy")

    class LightRAGLogCapture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            if record.levelno >= logging.INFO and not record.name.startswith(_skip_prefixes):
                try:
                    captured.append(self.format(record))
                except Exception:
                    pass

    capture_handler = LightRAGLogCapture()
    capture_handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    root_logger = logging.getLogger()
    root_logger.addHandler(capture_handler)

    def drain_captured():
        while captured:
            yield _log(captured.pop(0))

    try:
        yield _sse("step", {"label": "正在检索图谱...", "status": "loading"})

        rag = await get_rag(project_id, db)
        for chunk in drain_captured():
            yield chunk

        param_ctx = QueryParam(mode=mode, only_need_context=True)
        data = await rag.aquery_data(question, param=param_ctx)
        for chunk in drain_captured():
            yield chunk

        if data and "data" in data:
            ds = data["data"]
            entities = ds.get("entities", [])
            relationships = ds.get("relationships", [])
            chunks = ds.get("chunks", [])
            ne, nr, nc = len(entities), len(relationships), len(chunks)
            summary_parts = []
            if ne > 0:
                summary_parts.append(f"{ne} 个实体")
            if nr > 0:
                summary_parts.append(f"{nr} 个关系")
            if nc > 0:
                summary_parts.append(f"{nc} 个文本片段")
            if summary_parts:
                yield _sse("thinking", {"text": "检索到 " + "、".join(summary_parts)})
            else:
                yield _sse("thinking", {"text": "未检索到相关上下文"})

        yield _sse("step", {"label": "正在生成回答...", "status": "active"})

        param = QueryParam(mode=mode)
        answer = await rag.aquery(question, param=param)
        for chunk in drain_captured():
            yield chunk

        yield _sse("done", {"answer": answer})
    except Exception as e:
        logger.exception("[LightRAG] query_stream failed")
        yield _sse("error", {"message": str(e)})
    finally:
        root_logger.removeHandler(capture_handler)


async def get_graph_for_visualization(
    project_id: str,
    max_nodes: int = 500,
    db: AsyncSession | None = None,
) -> dict:
    """
    获取知识图谱的 nodes/edges，用于前端可视化。
    支持 NetworkX 与 Neo4j 存储。
    将 unknown_source 替换为可读来源（对话/页面/事件标题）。
    """
    try:
        rag = await get_rag(project_id, db)
        kg = await rag.get_knowledge_graph(
            node_label="*",
            max_depth=5,
            max_nodes=max_nodes,
        )
        doc_source_map = _build_doc_source_map(project_id)
        chunk_to_doc = _build_chunk_to_doc_map(project_id)
        nodes_out = []
        for n in kg.nodes:
            props = dict(n.properties) if n.properties else {}
            _resolve_file_path(props, doc_source_map, chunk_to_doc)
            node_type = (
                props.get("entity_type")
                or (n.labels[0] if n.labels else None)
                or props.get("type")
                or "unknown"
            )
            if isinstance(node_type, list):
                node_type = node_type[0] if node_type else "unknown"
            nodes_out.append({
                "id": n.id,
                "label": n.labels[0] if n.labels else n.id,
                "type": str(node_type) if node_type else "unknown",
                "properties": props,
            })
        return {
            "nodes": nodes_out,
            "edges": [
                {
                    "id": e.id,
                    "source": e.source,
                    "target": e.target,
                    "type": e.type or "RELATED",
                }
                for e in kg.edges
            ],
            "is_truncated": kg.is_truncated,
        }
    except Exception as e:
        logger.debug(f"[LightRAG] get_graph_for_visualization failed: {e}")
        return {"nodes": [], "edges": [], "is_truncated": False}


async def get_retrieval_context(project_id: str, question: str, db: AsyncSession | None = None) -> str | None:
    """
    从知识图谱检索与问题相关的上下文，用于注入 Chat system prompt。
    若项目未构建或检索失败，返回 None。
    """
    try:
        rag = await get_rag(project_id, db)
        param = QueryParam(mode="hybrid", only_need_context=True)
        data = await rag.aquery_data(question, param=param)
        if not data or "data" not in data:
            return None
        data_section = data["data"]
        entities = data_section.get("entities", [])
        relationships = data_section.get("relationships", [])
        chunks = data_section.get("chunks", [])
        if not entities and not relationships and not chunks:
            return None
        parts: list[str] = []
        for e in entities:
            if isinstance(e, dict):
                desc = e.get("description") or e.get("name") or str(e)
                parts.append(f"- {desc}")
            else:
                parts.append(f"- {e}")
        for r in relationships:
            if isinstance(r, dict):
                desc = r.get("description") or r.get("relation") or str(r)
                parts.append(f"- {desc}")
            else:
                parts.append(f"- {r}")
        for c in chunks:
            if isinstance(c, dict):
                content = c.get("content") or c.get("text") or str(c)
                parts.append(f"- {content}")
            else:
                parts.append(f"- {c}")
        if not parts:
            return None
        return (
            "\n\n【项目知识图谱检索到的相关上下文，供参考】\n"
            + "\n".join(parts[:50])  # 限制条数避免超长
        )
    except Exception as e:
        logger.debug(f"[LightRAG] get_retrieval_context failed: {e}")
        return None
