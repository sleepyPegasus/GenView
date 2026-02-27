"""Integration tests for POST /api/chat with mocked OpenRouter response."""
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# Mock OpenRouter SSE-style response lines
MOCK_STREAM_LINES = [
    'data: {"choices":[{"delta":{"content":"Here is "}}]}',
    'data: {"choices":[{"delta":{"content":"the code:"}}]}',
    'data: {"choices":[{"delta":{"content":"\n\n```tsx\n"}}]}',
    'data: {"choices":[{"delta":{"content":"export default function App"}}]}',
    'data: {"choices":[{"delta":{"content":"() { return <div>Hi</div>; }\n```"}}]}',
    "data: [DONE]",
]


async def _mock_aiter_lines():
    for line in MOCK_STREAM_LINES:
        yield line


@pytest_asyncio.fixture
def mock_httpx_stream():
    """Mock httpx.AsyncClient.stream to return fake OpenRouter SSE response."""
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.aiter_lines = _mock_aiter_lines

    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_resp)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=None)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_stream_ctx)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)

    with patch("app.routers.chat.httpx.AsyncClient", return_value=mock_client):
        yield


@pytest.mark.asyncio
async def test_chat_stream_mock_openrouter(client, mock_httpx_stream):
    """POST /api/chat returns SSE stream with content and step events."""
    payload = {
        "messages": [
            {"role": "user", "parts": [{"type": "text", "text": "Create a simple React component"}]}
        ],
    }

    events = []
    async with client.stream("POST", "/api/chat", json=payload) as resp:
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers.get("content-type", "")

        buffer = ""
        async for chunk in resp.aiter_bytes():
            buffer += chunk.decode()
            while "\n\n" in buffer:
                event_block, buffer = buffer.split("\n\n", 1)
                lines = event_block.strip().split("\n")
                if lines:
                    event_type = None
                    event_data = None
                    for line in lines:
                        if line.startswith("event: "):
                            event_type = line[7:]
                        elif line.startswith("data: "):
                            try:
                                event_data = json.loads(line[6:])
                            except json.JSONDecodeError:
                                pass
                    if event_type and event_data:
                        events.append((event_type, event_data))

    # Should have step, content, progress, done events
    event_types = [e[0] for e in events]
    assert "step" in event_types
    assert "content" in event_types
    assert "progress" in event_types
    assert "done" in event_types

    # Content should include our mock response
    content_events = [e[1] for e in events if e[0] == "content"]
    all_text = "".join(c.get("text", "") for c in content_events)
    assert "Here is" in all_text
    assert "tsx" in all_text or "export default" in all_text
