from datetime import date, datetime

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
    custom_theme: dict | None = None
    model: str | None = None
    kg_model: str | None = None
    conversation_mode: str | None = None
    nav_background_color: str | None = None
    app_name_font_size: str | None = None
    app_name_color: str | None = None
    nav_config: dict | None = None
    nav_menu_items: list[dict] | None = None


class ProjectOut(BaseModel):
    id: str
    name: str
    logo_url: str
    nav_layout: str
    theme: str
    custom_theme: dict | None = None
    model: str | None = None
    kg_model: str | None = None
    conversation_mode: str | None = None
    nav_background_color: str | None = None
    app_name_font_size: str | None = None
    app_name_color: str | None = None
    nav_config: dict | None = None
    nav_menu_items: list[dict] | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Conversation ─────────────────────────────────────────
class NavMenuItem(BaseModel):
    label: str
    icon: str = ""


class ConversationCreate(BaseModel):
    project_id: str
    title: str = "New Conversation"


class ConversationUpdate(BaseModel):
    title: str | None = None
    app_name: str | None = None
    logo_url: str | None = None
    nav_layout: str | None = None
    theme: str | None = None
    custom_theme: dict | None = None
    model: str | None = None
    conversation_mode: str | None = None
    nav_background_color: str | None = None
    app_name_font_size: str | None = None
    app_name_color: str | None = None
    nav_menu_items: list[dict] | None = None


class ConversationOut(BaseModel):
    id: str
    title: str
    project_id: str
    app_name: str
    logo_url: str
    nav_layout: str
    theme: str
    custom_theme: dict | None = None
    model: str
    conversation_mode: str | None = None
    nav_background_color: str | None = None
    app_name_font_size: str | None = None
    app_name_color: str | None = None
    nav_menu_items: list[dict] | None = None
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


# ── Page ──────────────────────────────────────────────
class PageCreate(BaseModel):
    name: str = "Untitled Page"
    nav_label: str = ""
    code_block: str = ""
    code_language: str = "tsx"
    extra_files: dict | None = None
    source_conversation_id: str | None = None
    source_message_id: str | None = None


class PageUpdate(BaseModel):
    name: str | None = None
    nav_label: str | None = None
    code_block: str | None = None
    code_language: str | None = None
    extra_files: dict | None = None
    sort_order: int | None = None


class PageOut(BaseModel):
    id: str
    project_id: str
    name: str
    nav_label: str
    code_block: str
    code_language: str
    extra_files: dict | None = None
    source_conversation_id: str | None = None
    source_message_id: str | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Timeline ──────────────────────────────────────────────
class TimelineEventCreate(BaseModel):
    type: str = "phase"  # phase | custom
    # phase
    phase_key: str | None = None
    phase_label: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    # custom
    title: str | None = None
    event_date: date | None = None
    event_time: str | None = None
    description: str | None = None
    outcome: str | None = None
    participants: str | None = None
    tags: list[str] | None = None
    attachments: list[dict] | None = None  # [{"name": str, "url": str}, ...]
    sort_order: int = 0


class TimelineEventUpdate(BaseModel):
    type: str | None = None
    phase_key: str | None = None
    phase_label: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    title: str | None = None
    event_date: date | None = None
    event_time: str | None = None
    description: str | None = None
    outcome: str | None = None
    participants: str | None = None
    tags: list[str] | None = None
    attachments: list[dict] | None = None
    sort_order: int | None = None


class TimelineEventOut(BaseModel):
    id: str
    project_id: str
    type: str
    phase_key: str | None = None
    phase_label: str | None = None
    status: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    title: str | None = None
    event_date: date | None = None
    event_time: str | None = None
    description: str | None = None
    outcome: str | None = None
    participants: str | None = None
    tags: list[str] | None = None
    attachments: list[dict] | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Chat ─────────────────────────────────────────────────
class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    app_name: str = "GenView Dashboard"
    logo_url: str = ""
    nav_layout: str = "side"
    theme: str = "modern-b2b"
    model: str = ""
    conversation_mode: str = "agent"
    current_code: str = ""
    conversation_id: str | None = None
    project_id: str | None = None
    # 本次请求覆盖配置，None 则用 settings.chat_max_rounds
    max_rounds: int | None = None
