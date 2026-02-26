import json
import re

import httpx
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import Message
from app.schemas import ChatRequest

router = APIRouter()

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


@router.post("/api/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    system_prompt = _build_system_prompt(req)
    openai_messages = [{"role": "system", "content": system_prompt}]
    openai_messages.extend(_convert_messages(req))

    model = req.model or settings.default_model

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
        async with httpx.AsyncClient(timeout=120.0) as client:
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
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk["choices"][0].get("delta", {})
                        text = delta.get("content", "")
                        if text:
                            full_text += text
                            yield text
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue

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

    return StreamingResponse(generate(), media_type="text/plain; charset=utf-8")
