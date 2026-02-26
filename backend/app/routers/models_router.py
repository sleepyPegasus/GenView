import time

import httpx
from fastapi import APIRouter

from app.config import settings

router = APIRouter(tags=["models"])

_cache: list[dict] | None = None
_cache_ts: float = 0
_CACHE_TTL = 300  # 5 minutes


@router.get("/api/models")
async def list_models():
    global _cache, _cache_ts

    now = time.time()
    if _cache and (now - _cache_ts) < _CACHE_TTL:
        return _cache

    headers = {}
    if settings.openrouter_api_key:
        headers["Authorization"] = f"Bearer {settings.openrouter_api_key}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models", headers=headers
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])

            models = sorted(
                [
                    {
                        "id": m["id"],
                        "name": m.get("name", m["id"]),
                        "context_length": m.get("context_length", 0),
                        "pricing": {
                            "prompt": m.get("pricing", {}).get("prompt", "0"),
                            "completion": m.get("pricing", {}).get("completion", "0"),
                        },
                    }
                    for m in data
                    if "/auto" not in m["id"].lower()
                ],
                key=lambda m: m["name"],
            )

            _cache = models
            _cache_ts = now
            return models

    except httpx.HTTPError:
        if _cache:
            return _cache
        return []
