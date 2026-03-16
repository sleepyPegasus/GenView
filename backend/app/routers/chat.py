import json
import logging
import re
import time

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Message
from app.schemas import ChatRequest
from app.services.lightrag_service import get_retrieval_context
from app.services.memos_client import add_message as memos_add_message
from app.services.memos_client import search_memory as memos_search_memory

router = APIRouter()
logger = logging.getLogger("genview.chat")

SYSTEM_PROMPT_TEMPLATE = """你是一个资深的工业软件 UI/UX 架构师，名为 GenView AI。当前系统的全局配置如下：
- 主业务风格 (Theme): {theme}
- 系统名称 (App Name): {app_name}
- 布局结构 (Nav Layout): {nav_layout}

工作要求：
1. **架构图**: 若用户需要系统架构图、流程图、时序图等，必须输出包裹在 ```mermaid 中的 Mermaid 代码。
   - 【Mermaid 语法规范】节点标签若含特殊字符（如 /、()、:、>、< 等），必须使用 `节点ID["标签文本"]` 格式，否则会导致 Parse error。
   - 每个节点定义必须单独占一行，禁止在同一行写多个节点。
   - 使用 classDef 定义样式后，优先用 `class 节点ID1,节点ID2 className` 指令批量应用，例如先定义 `U1["培训教员/考官"]` 等节点，再单独一行写 `class U1,U2,U3 user`。若用行内 `:::className` 应用，则 `:::` 与类名之间不能有空格。
   - 子图 subgraph 的标题若含特殊字符，用双引号包裹。
2. **UI界面**: 若用户需要产品界面、管理后台、数据看板等，必须输出包裹在 ```tsx 中的 React 代码。
   - 务必使用内联样式 (inline styles) 配合 CSS 变量进行样式编写。
   - 使用以下 CSS 变量而非硬编码颜色: var(--primary), var(--primary-foreground), var(--background), var(--foreground), var(--secondary), var(--muted), var(--muted-foreground), var(--accent), var(--card), var(--card-foreground), var(--border)。
   - 组件必须使用 `export default function DashboardContent()` 格式导出。
   - 多文件支持：若需拆分子组件或工具，可输出多个代码块，格式为 ```tsx:path/to/file.tsx，主入口仍为 ```tsx（即 DashboardContent.tsx）。
3. **禁止输出** `<html>`、全屏的侧边栏或顶部导航代码，因为系统外层框架已存在。你只需输出主业务内容区 (Content Area) 的代码。
4. 图表库：默认使用 `recharts`；若需要复杂图表（如 K 线、热力图、关系图、地图等），可使用 `echarts`（已预装）。`lucide-react` 作为图标库。
   【中国地图】必须使用 `CHINA_GEO_JSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'`，fetch 时需加 `{{ referrerPolicy: 'no-referrer' }}`。示例：`const CHINA_GEO_JSON_URL = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'; fetch(CHINA_GEO_JSON_URL, {{ referrerPolicy: 'no-referrer' }}).then(r=>r.json()).then(geo=>{{ echarts.registerMap('china', geo); /* 在 option 中设置 map: 'china' */ }});`
5. **Python 脚本**: 若用户需要数据处理、算法、脚本、工具等，必须输出包裹在 ```python 中的 Python 代码。
   - 支持标准库及常见第三方库（numpy、pandas、matplotlib 等，运行于 Pyodide 浏览器环境）。
   - 脚本应包含可执行逻辑，建议使用 print() 输出结果。
   - 多文件支持：格式为 ```python:utils.py，主入口为 ```python。
6. 【重要】在多轮对话修改时，绝不允许截断代码或使用 "// ... existing code ..." 之类的省略写法。必须每次输出完整的组件代码！
7. 请先用中文简要描述你的设计思路，然后输出代码。
【回复风格】用词克制、务实，贴近工程师日常沟通。禁止使用夸张、营销式表述（如「革命性」「颠覆性」「完美」「极致」「非常棒」「超强」等）；避免过度热情（如「太棒了！」「太好了！」）。直接说明实现思路和注意事项即可，少用修饰词。
8. 所有生成的 UI 应该看起来专业、高保真、像真实的生产级工业软件。尽可能使用丰富的数据、统计卡片、图表和表格来填充页面。"""

PLAN_SYSTEM_PROMPT = """你是一个资深的工业软件产品顾问，名为 GenView AI。你擅长与用户进行头脑风暴、讨论产品思路、激发设计灵感。

当前模式为 Plan（规划/灵感）模式，主要用于：
- 与用户讨论产品需求、功能规划
- 头脑风暴界面设计思路
- 帮助用户理清思路、激发灵感

你不需要输出代码或架构图，专注于对话和思考。若用户明确要求生成页面或代码，可建议其切换到 Agent 模式。

【回复风格】用词克制、务实，贴近工程师日常沟通。禁止夸张、营销式表述；避免过度热情。直接分析需求、给出建议即可。"""


def _build_system_prompt(req: ChatRequest) -> str:
    if req.conversation_mode == "plan":
        return PLAN_SYSTEM_PROMPT
    prompt = SYSTEM_PROMPT_TEMPLATE.format(
        theme=req.theme,
        app_name=req.app_name,
        nav_layout=req.nav_layout,
    )
    if req.current_code:
        prompt += f"\n\n当前画布上正在渲染的代码如下（用户可能希望基于此进行修改）：\n```tsx\n{req.current_code}\n```"
    return prompt


def _convert_messages(req: ChatRequest) -> list[dict]:
    """Convert frontend UIMessage format to OpenAI messages format."""
    result: list[dict] = []
    for msg in req.messages:
        text = "".join(p.text for p in msg.parts if p.type == "text")
        if text:
            result.append({"role": msg.role, "content": text})
    return result


def _truncate_messages(messages: list[dict], max_rounds: int) -> list[dict]:
    """保留最近 max_rounds 轮对话。每轮 = user + assistant，最后一轮可为仅 user。"""
    if max_rounds <= 0 or len(messages) <= 1:
        return messages
    # 取最近 2*max_rounds - 1 条（1 条当前 user + (max_rounds-1) 对 user+assistant）
    take = 2 * max_rounds - 1
    start = max(0, len(messages) - take)
    return messages[start:]


def _extract_code_block(text: str) -> tuple[str | None, str | None]:
    """Extract the last code block and its language from text."""
    pattern = r"```(tsx|mermaid|python)\s*\n([\s\S]*?)```"
    matches = re.findall(pattern, text)
    if matches:
        lang, code = matches[-1]
        return code.strip(), lang
    return None, None


def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _detect_phase(full_text: str, new_chunk: str) -> str | None:
    """Detect the current generation phase based on accumulated text."""
    if "```tsx" in new_chunk:
        return "generating_code"
    if "```mermaid" in new_chunk:
        return "generating_diagram"
    if "```python" in new_chunk:
        return "generating_python"
    if full_text.count("```") >= 2 and new_chunk.rstrip().endswith("```"):
        return "code_complete"
    return None


def _count_tokens(text: str) -> int:
    """使用 tiktoken 估算 token 数（cl100k_base 适用于 GPT-4/3.5 等）"""
    try:
        import tiktoken
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except Exception:
        # 回退：中英混合约 2.5 字符/token
        return max(1, len(text) // 2)


def _estimate_progress(full_text: str, in_code_block: bool) -> int:
    """Estimate generation progress as percentage (0-100)."""
    text_len = len(full_text)
    if text_len < 50:
        return 5
    if not in_code_block:
        return min(20, 5 + text_len // 20)
    else:
        code_len = text_len
        if code_len < 500:
            return 30
        elif code_len < 2000:
            return 30 + min(40, code_len // 50)
        elif code_len < 5000:
            return 70 + min(20, (code_len - 2000) // 150)
        else:
            return min(95, 90 + (code_len - 5000) // 500)


@router.post("/api/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    system_prompt = _build_system_prompt(req)
    converted = _convert_messages(req)
    max_rounds = req.max_rounds if req.max_rounds is not None else settings.chat_max_rounds
    if max_rounds > 0:
        original_len = len(converted)
        converted = _truncate_messages(converted, max_rounds)
        if len(converted) < original_len:
            logger.info(
                f"[Chat] Context truncated | total={original_len} messages, kept last {max_rounds} rounds ({len(converted)} msgs)"
            )

    # MemOS: 检索相关记忆并注入 system prompt
    if settings.memos_enabled and req.conversation_id and converted:
        last_user = next((m for m in reversed(converted) if m.get("role") == "user"), None)
        if last_user:
            query = last_user.get("content", "").strip()
            if query:
                memory_text = await memos_search_memory(req.conversation_id, query)
                if memory_text:
                    system_prompt += f"\n\n{memory_text}"
                    logger.info(f"[Chat] MemOS memory injected | conversation_id={req.conversation_id}")

    # LightRAG: 当有 project_id 时，从知识图谱检索上下文注入 system prompt
    if req.project_id and converted:
        last_user = next((m for m in reversed(converted) if m.get("role") == "user"), None)
        if last_user:
            query = last_user.get("content", "").strip()
            if query:
                kg_context = await get_retrieval_context(req.project_id, query)
                if kg_context:
                    system_prompt += f"\n\n{kg_context}"
                    logger.info(f"[Chat] LightRAG context injected | project_id={req.project_id}")

    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(converted)

    model = req.model or settings.default_model

    logger.info(f"[Chat] Starting request | model={model} | messages={len(openai_messages)}")

    # Save user message to DB if conversation exists
    if req.conversation_id and req.messages:
        last_msg = req.messages[-1]
        if last_msg.role == "user":
            user_text = "".join(p.text for p in last_msg.parts if p.type == "text")
            db.add(Message(
                conversation_id=req.conversation_id,
                role="user",
                content=user_text,
            ))
            await db.commit()

    async def generate():
        full_text = ""
        in_code_block = False
        last_active_step_label: str | None = None
        last_progress = 0
        start_time = time.time()
        token_count = 0

        # 在调用 LLM 之前计算输入 token 数
        full_prompt_text = "\n".join(m.get("content", "") for m in openai_messages)
        prompt_token_count = _count_tokens(full_prompt_text)
        yield _sse_event("input_tokens", {"prompt_token_count": prompt_token_count})

        logger.info(f"[Chat] Connecting to OpenRouter | model={model} | input_tokens={prompt_token_count}")
        yield _sse_event("step", {"label": "Connecting to AI model...", "status": "loading"})

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                async with client.stream(
                    "POST",
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": openai_messages,
                        "stream": True,
                        "include_reasoning": True,
                    },
                ) as resp:
                    if resp.status_code != 200:
                        error_body = ""
                        async for chunk in resp.aiter_text():
                            error_body += chunk
                        logger.error(f"[Chat] OpenRouter error {resp.status_code}: {error_body[:500]}")
                        yield _sse_event("error", {"message": f"AI model returned error ({resp.status_code})"})
                        return

                    yield _sse_event("step", {"label": "Connected, AI is thinking...", "status": "active"})
                    logger.info(f"[Chat] Connected, streaming started")

                    thinking_sent = False

                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)

                            # OpenRouter/OpenAI 在流式响应的最后一个 chunk 中返回 usage
                            usage = chunk.get("usage")
                            if usage is not None:
                                comp = usage.get("completion_tokens")
                                total = usage.get("total_tokens")
                                if comp is not None:
                                    token_count = comp
                                elif total is not None:
                                    token_count = total

                            delta = chunk["choices"][0].get("delta", {})

                            # Handle thinking/reasoning tokens from various models:
                            # - DeepSeek: "reasoning_content"
                            # - OpenAI o-series: "reasoning"
                            # - Gemini thinking: "thought" or "thinking"
                            reasoning = (
                                delta.get("reasoning_content")
                                or delta.get("reasoning")
                                or delta.get("thought")
                                or delta.get("thinking")
                                or ""
                            )
                            if reasoning:
                                if not thinking_sent:
                                    yield _sse_event("step", {"label": "AI is reasoning...", "status": "active"})
                                    thinking_sent = True
                                yield _sse_event("thinking", {"text": reasoning})
                                continue

                            text = delta.get("content", "")
                            if not text:
                                continue

                            full_text += text

                            # Detect phase transitions
                            phase = _detect_phase(full_text, text)
                            if phase == "generating_code":
                                in_code_block = True
                                last_active_step_label = "Generating code..."
                                yield _sse_event("step", {"label": last_active_step_label, "status": "active"})
                                logger.info(f"[Chat] Code generation started | tokens_so_far={token_count}")
                            elif phase == "generating_diagram":
                                in_code_block = True
                                last_active_step_label = "Generating diagram..."
                                yield _sse_event("step", {"label": last_active_step_label, "status": "active"})
                                logger.info(f"[Chat] Diagram generation started | tokens_so_far={token_count}")
                            elif phase == "generating_python":
                                in_code_block = True
                                last_active_step_label = "Generating Python..."
                                yield _sse_event("step", {"label": last_active_step_label, "status": "active"})
                                logger.info(f"[Chat] Python generation started | tokens_so_far={token_count}")
                            elif phase == "code_complete":
                                in_code_block = False
                                yield _sse_event("step", {"label": "Code generation complete", "status": "done"})
                                logger.info(f"[Chat] Code generation complete | tokens={token_count}")

                            # Send content
                            yield _sse_event("content", {"text": text})

                            # Send progress updates (throttled, every 5% change)
                            progress = _estimate_progress(full_text, in_code_block)
                            if progress - last_progress >= 5:
                                last_progress = progress
                                yield _sse_event("progress", {"percent": progress})

                        except (json.JSONDecodeError, KeyError, IndexError):
                            continue

            except httpx.ConnectError as e:
                logger.error(f"[Chat] Connection failed: {e}")
                yield _sse_event("error", {"message": "Failed to connect to AI service"})
                return
            except httpx.ReadTimeout as e:
                logger.error(f"[Chat] Read timeout: {e}")
                yield _sse_event("error", {"message": "AI response timed out"})
                return

        elapsed = time.time() - start_time

        # 若 OpenRouter 未返回 usage，则按字符数估算（约 4 字符/token，中英混合）
        if token_count == 0 and full_text:
            token_count = max(1, len(full_text) // 4)

        logger.info(f"[Chat] Stream complete | tokens={token_count} | elapsed={elapsed:.1f}s | chars={len(full_text)}")

        # If stream ended while still in code block, mark the active step as done
        if in_code_block and last_active_step_label:
            yield _sse_event("step", {"label": last_active_step_label, "status": "done"})

        yield _sse_event("progress", {"percent": 100})
        yield _sse_event("step", {"label": "Generation complete", "status": "done"})
        yield _sse_event("done", {"token_count": token_count, "elapsed": round(elapsed, 1)})

        # Save assistant message to DB after stream completes
        if req.conversation_id and full_text:
            code_block, code_lang = _extract_code_block(full_text)
            db.add(Message(
                conversation_id=req.conversation_id,
                role="assistant",
                content=full_text,
                code_block=code_block,
                code_language=code_lang,
            ))
            await db.commit()
            logger.info(f"[Chat] Message saved to DB | conversation_id={req.conversation_id}")

        # MemOS: 将本轮对话写入记忆
        if settings.memos_enabled and req.conversation_id and full_text:
            last_user = next((m for m in reversed(converted) if m.get("role") == "user"), None)
            if last_user:
                to_add = [
                    {"role": "user", "content": last_user.get("content", "")},
                    {"role": "assistant", "content": full_text},
                ]
                await memos_add_message(req.conversation_id, to_add)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
        },
    )
