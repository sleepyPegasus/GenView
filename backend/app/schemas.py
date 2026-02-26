from datetime import datetime

from pydantic import BaseModel


# ── Project ──────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = "GenView Dashboard"
    logo_url: str = ""
    nav_layout: str = "side"
    theme: str = "modern-b2b"


class ProjectUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    nav_layout: str | None = None
    theme: str | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    logo_url: str
    nav_layout: str
    theme: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Conversation ─────────────────────────────────────────
class ConversationCreate(BaseModel):
    project_id: str
    title: str = "New Conversation"


class ConversationOut(BaseModel):
    id: str
    title: str
    project_id: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Message ──────────────────────────────────────────────
class MessageOut(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    code_block: str | None = None
    code_language: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat ─────────────────────────────────────────────────
class ChatMessagePart(BaseModel):
    type: str
    text: str = ""


class ChatMessage(BaseModel):
    role: str
    parts: list[ChatMessagePart] = []


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    app_name: str = "GenView Dashboard"
    logo_url: str = ""
    nav_layout: str = "side"
    theme: str = "modern-b2b"
    model: str = ""
    current_code: str = ""
    conversation_id: str | None = None
