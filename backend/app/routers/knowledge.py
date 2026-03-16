"""
知识图谱 API：构建与查询。
"""

import json
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session, get_db
from app.models import Conversation, KgBuildHistory, KgQueryMessage, KgQuerySession, Message, Page, Project
from app.services.lightrag_service import (
    build_knowledge_graph_stream,
    get_graph_for_visualization,
    get_project_doc_count,
    query,
    query_stream,
)

router = APIRouter(prefix="/api/projects", tags=["knowledge"])


class QueryRequest(BaseModel):
    question: str
    mode: str = "hybrid"
    session_id: str | None = None


@router.get("/{project_id}/kg/simple-search")
async def kg_simple_search(
    project_id: str,
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
):
    """轻量模式：未构建图谱时，对 Message/Page 做 ILIKE 全文匹配，返回片段列表。"""
    project = await db.get(Project, project_id)
    if not project or getattr(project, "deleted_at", None) is not None:
        raise HTTPException(404, "Project not found")

    pattern = f"%{q.strip()}%"
    chunks = []

    # Search in messages
    msg_q = (
        select(Message.id, Message.content, Message.conversation_id)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.project_id == project_id)
        .where(Message.content.ilike(pattern))
    )
    msg_res = await db.execute(msg_q)
    for row in msg_res.all():
        snippet = (row.content or "")[:200].replace("\n", " ")
        chunks.append({
            "id": row.id,
            "type": "message",
            "source_id": row.conversation_id,
            "snippet": snippet,
        })

    # Search in pages
    page_q = (
        select(Page.id, Page.name, Page.code_block)
        .where(Page.project_id == project_id)
        .where(or_(Page.name.ilike(pattern), Page.code_block.ilike(pattern)))
    )
    page_res = await db.execute(page_q)
    for row in page_res.all():
        snippet = (row.name or "") + ": " + ((row.code_block or "")[:150].replace("\n", " "))
        chunks.append({
            "id": row.id,
            "type": "page",
            "source_id": row.id,
            "snippet": snippet[:200],
        })

    return {"chunks": chunks[:50]}


@router.get("/{project_id}/kg/doc-count")
async def kg_doc_count(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """获取项目可构建文档数量，用于构建前检查。"""
    return await get_project_doc_count(project_id, db)


@router.post("/{project_id}/kg/build")
async def kg_build(project_id: str):
    """触发知识图谱构建，SSE 流式返回进度与日志。Session 在生成器内部创建以保障构建历史持久化。"""
    async def generate():
        async with async_session() as db:
            async for chunk in build_knowledge_graph_stream(project_id, db):
                yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{project_id}/kg/build-history")
async def kg_build_history(
    project_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取项目知识图谱构建历史，按时间倒序。"""
    result = await db.execute(
        select(KgBuildHistory)
        .where(KgBuildHistory.project_id == project_id)
        .order_by(KgBuildHistory.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "doc_count": r.doc_count,
            "msg_count": r.msg_count or 0,
            "page_count": r.page_count or 0,
            "timeline_count": r.timeline_count or 0,
            "node_count": r.node_count,
            "edge_count": r.edge_count,
            "duration_seconds": r.duration_seconds,
            "status": r.status,
            "error": r.error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/{project_id}/kg/query-sessions")
async def kg_query_sessions(
    project_id: str,
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取项目知识图谱查询会话列表，按时间倒序。"""
    result = await db.execute(
        select(KgQuerySession)
        .where(KgQuerySession.project_id == project_id)
        .order_by(KgQuerySession.created_at.desc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "title": r.title,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/{project_id}/kg/query-history")
async def kg_query_history(
    project_id: str,
    session_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """获取知识图谱查询历史。若提供 session_id 则返回该会话消息，否则返回空。"""
    if not session_id:
        return []
    result = await db.execute(
        select(KgQueryMessage)
        .where(
            KgQueryMessage.project_id == project_id,
            KgQueryMessage.session_id == session_id,
        )
        .order_by(KgQueryMessage.created_at.asc())
        .limit(limit)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "session_id": r.session_id,
            "role": r.role,
            "content": r.content,
            "query_mode": r.query_mode,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.get("/{project_id}/kg/graph")
async def kg_graph(
    project_id: str,
    max_nodes: int = Query(500, ge=1, le=2000, description="Maximum nodes to return"),
    db: AsyncSession = Depends(get_db),
):
    """获取知识图谱结构用于可视化。"""
    return await get_graph_for_visualization(project_id, max_nodes, db)


@router.post("/{project_id}/kg/query-stream")
async def kg_query_stream_endpoint(
    project_id: str,
    body: QueryRequest,
):
    """RAG 查询流式接口：实时返回 LightRAG 日志（log）和检索过程（thinking）。"""

    async def generate():
        session_id = body.session_id
        answer = ""
        async with async_session() as db:
            async for chunk in query_stream(project_id, body.question, body.mode, db):
                if chunk.startswith("event: done"):
                    m = re.search(r"data: (.+)$", chunk, re.MULTILINE | re.DOTALL)
                    if m:
                        try:
                            data = json.loads(m.group(1).strip())
                            answer = data.get("answer", "")
                        except Exception:
                            pass
                yield chunk
        if answer and not session_id:
            async with async_session() as db:
                title = (body.question[:20] + "…") if len(body.question) > 20 else body.question
                session = KgQuerySession(project_id=project_id, title=title or "新对话")
                db.add(session)
                await db.flush()
                sid = session.id
                db.add(KgQueryMessage(project_id=project_id, session_id=sid, role="user", content=body.question, query_mode=body.mode))
                db.add(KgQueryMessage(project_id=project_id, session_id=sid, role="assistant", content=answer, query_mode=body.mode))
                await db.commit()
            yield f"event: session\ndata: {json.dumps({'session_id': sid})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{project_id}/kg/query")
async def kg_query_endpoint(
    project_id: str,
    body: QueryRequest,
    db: AsyncSession = Depends(get_db),
):
    """RAG 查询，返回回答文本，并保存到查询历史。若无 session_id 则创建新会话。"""
    try:
        answer = await query(project_id, body.question, body.mode)

        session_id = body.session_id
        if not session_id:
            title = (body.question[:20] + "…") if len(body.question) > 20 else body.question
            session = KgQuerySession(project_id=project_id, title=title or "新对话")
            db.add(session)
            await db.flush()
            session_id = session.id

        db.add(KgQueryMessage(project_id=project_id, session_id=session_id, role="user", content=body.question, query_mode=body.mode))
        db.add(KgQueryMessage(project_id=project_id, session_id=session_id, role="assistant", content=answer, query_mode=body.mode))
        await db.commit()
        return {"answer": answer, "session_id": session_id}
    except Exception as e:
        raise HTTPException(500, f"Query failed: {e}")
