"""
MemOS Cloud 客户端 - 封装 add/message 与 search/memory API
文档: https://docs-pre.openmem.net/memos_cloud/mem_operations/add_message
"""
import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger("genview.memos")


def _is_enabled() -> bool:
    return bool(settings.memos_enabled and settings.memos_api_key)


async def search_memory(
    conversation_id: str,
    query: str,
    *,
    limit: int = 9,
    relativity: float = 0.45,
) -> str:
    """
    从 MemOS 检索相关记忆，返回可注入 prompt 的文本。
    若未启用或出错，返回空字符串。
    """
    if not _is_enabled() or not query.strip():
        return ""

    url = f"{settings.memos_base_url.rstrip('/')}/search/memory"
    headers = {
        "Authorization": f"Token {settings.memos_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "user_id": conversation_id,
        "conversation_id": conversation_id,
        "query": query,
        "memory_limit_number": limit,
        "relativity": relativity,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"[MemOS] Search failed {e.response.status_code}: {e.response.text[:200]}")
        return ""
    except Exception as e:
        logger.warning(f"[MemOS] Search error: {e}")
        return ""

    return _format_memories_for_prompt(data)


def _format_memories_for_prompt(data: dict[str, Any]) -> str:
    """将 MemOS 返回的数据格式化为可注入 system prompt 的文本。"""
    if not data:
        return ""

    # MemOS 可能返回 data 内嵌结构，兼容多种格式
    inner = data.get("data", data)
    if not isinstance(inner, dict):
        return ""

    facts = inner.get("facts") or inner.get("memories") or []
    preferences = inner.get("preferences") or []
    if isinstance(facts, dict):
        facts = facts.get("items", []) if isinstance(facts.get("items"), list) else []
    if isinstance(preferences, dict):
        preferences = preferences.get("items", []) if isinstance(preferences.get("items"), list) else []

    lines: list[str] = []
    if facts:
        for item in facts[:9]:
            text = item.get("memory", item.get("content", item)) if isinstance(item, dict) else str(item)
            if text:
                lines.append(f"- {text}")
    if preferences:
        for item in preferences[:6]:
            text = item.get("memory", item.get("content", item)) if isinstance(item, dict) else str(item)
            if text:
                lines.append(f"- [偏好] {text}")

    if not lines:
        return ""
    return "以下是此前对话中 MemOS 检索到的相关记忆，供参考：\n" + "\n".join(lines)


async def add_message(conversation_id: str, messages: list[dict]) -> bool:
    """
    将本轮对话写入 MemOS。
    若未启用或出错，返回 False。
    """
    if not _is_enabled() or not messages:
        return False

    url = f"{settings.memos_base_url.rstrip('/')}/add/message"
    headers = {
        "Authorization": f"Token {settings.memos_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "user_id": conversation_id,
        "conversation_id": conversation_id,
        "messages": messages,
        "async_mode": True,
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning(f"[MemOS] Add failed {e.response.status_code}: {e.response.text[:200]}")
        return False
    except Exception as e:
        logger.warning(f"[MemOS] Add error: {e}")
        return False

    # MemOS 成功时 code 通常为 0
    code = data.get("code", -1)
    if code != 0:
        logger.warning(f"[MemOS] Add returned code={code}: {data.get('message', '')}")
        return False

    logger.info(f"[MemOS] Memory added | conversation_id={conversation_id} | messages={len(messages)}")
    return True
