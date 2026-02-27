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

router = APIRouter()
logger = logging.getLogger("genview.chat")

SYSTEM_PROMPT_TEMPLATE = """你是一个资深的工业软件 UI/UX 架构师，名为 GenView AI。当前系统的全局配置如下：
- 主业务风格 (Theme): {theme}
- 系统名称 (App Name): {app_name}
- 布局结构 (Nav Layout): {nav_layout}

工作要求：
1. **架构图**: 若用户需要系统架构图、流程图、时序图等，必须输出包裹在 ```mermaid 中的 Mermaid 代码。
2. **UI界面**: 若用户需要产品界面、管理后台、数据看板等，必须输出包裹在 ```tsx 中的 React 代码。
   - 务必使用内联样式 (inline styles) 配合 CSS 变量进行样式编写。
   - 使用以下 CSS 变量而非硬编码颜色: var(--primary), var(--primary-foreground), var(--background), var(--foreground), var(--secondary), var(--muted), var(--muted-foreground), var(--accent), var(--card), var(--card-foreground), var(--border)。
   - 组件必须使用 `export default function DashboardContent()` 格式导出。
3. **禁止输出** `<html>`、全屏的侧边栏或顶部导航代码，因为系统外层框架已存在。你只需输出主业务内容区 (Content Area) 的代码。
4. 必须默认使用 `lucide-react` 作为图标库，`recharts` 作为图表库。
5. 【重要】在多轮对话修改时，绝不允许截断代码或使用 "// ... existing code ..." 之类的省略写法。必须每次输出完整的组件代码！
6. 请先用中文简要描述你的设计思路，然后输出代码。
7. 所有生成的 UI 应该看起来专业、高保真、像真实的生产级工业软件。尽可能使用丰富的数据、统计卡片、图表和表格来填充页面。"""


def _build_system_prompt(req: ChatRequest) -> str:
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


def _extract_code_block(text: str) -> tuple[str | None, str | None]:
    """Extract the last code block and its language from text."""
    pattern = r"```(tsx|mermaid)\s*\n([\s\S]*?)```"
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
    if full_text.count("```") >= 2 and new_chunk.rstrip().endswith("```"):
        return "code_complete"
    return None


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
    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(_convert_messages(req))

    model = req.model or settings.default_model

    logger.info(f"[Chat] Starting request | model={model} | messages={len(req.messages)}")

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
        last_progress = 0
        start_time = time.time()
        token_count = 0

        logger.info(f"[Chat] Connecting to OpenRouter | model={model}")
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

                            token_count += 1
                            full_text += text

                            # Detect phase transitions
                            phase = _detect_phase(full_text, text)
                            if phase == "generating_code":
                                in_code_block = True
                                yield _sse_event("step", {"label": "Generating code...", "status": "active"})
                                logger.info(f"[Chat] Code generation started | tokens_so_far={token_count}")
                            elif phase == "generating_diagram":
                                in_code_block = True
                                yield _sse_event("step", {"label": "Generating diagram...", "status": "active"})
                                logger.info(f"[Chat] Diagram generation started | tokens_so_far={token_count}")
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
        logger.info(f"[Chat] Stream complete | tokens={token_count} | elapsed={elapsed:.1f}s | chars={len(full_text)}")

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

    return StreamingResponse(
        generate(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx/proxy buffering
        },
    )
