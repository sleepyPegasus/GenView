from datetime import date, datetime

from pydantic import BaseModel


# ── Customer ──────────────────────────────────────────────
class CustomerCreate(BaseModel):
    name: str
    code: str | None = None
    contact: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    contact: str | None = None


class CustomerOut(BaseModel):
    id: str
    name: str
    code: str | None = None
    contact: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactCreate(BaseModel):
    name: str
    role: str | None = None
    phone: str | None = None
    email: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = None
    role: str | None = None
    phone: str | None = None
    email: str | None = None


class ContactOut(BaseModel):
    id: str
    customer_id: str
    name: str
    role: str | None = None
    phone: str | None = None
    email: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Project ──────────────────────────────────────────────
class ProjectCreate(BaseModel):
    name: str = "GenView Dashboard"
    logo_url: str = ""
    nav_layout: str = "side"
    theme: str = "modern-b2b"
    customer_id: str | None = None


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
    customer_id: str | None = None


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
    customer_id: str | None = None
    customer_name: str | None = None
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
    attachments: list[dict] | None = None  # [{"url": str}, ...]
    code_block: str | None = None
    code_language: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AiModifyMessageOut(BaseModel):
    id: str
    role: str
    content: str
    referenced_code: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Chat ─────────────────────────────────────────────────
class ChatMessagePart(BaseModel):
    type: str  # "text" | "image_url" | "excel_file"
    text: str = ""
    image_url: str | None = None  # data:image/...;base64,... or https://...
    excel_url: str | None = None  # /api/projects/.../chat-attachments/xxx.xlsx
    sheet_name: str | None = None  # user-specified sheet name for excel


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
    participant_contact_ids: list[str] | None = None
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
    participant_contact_ids: list[str] | None = None
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
    participant_contact_ids: list[str] | None = None
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
    # AI 修改选中代码模式：当设置时，仅修改选中部分，输出完整替换代码
    modify_selection: str | None = None
    # AI 修改全文件模式：当 True 时，基于 current_code 分析并修改整个文件
    modify_full_file: bool = False
    # AI 修改持久化：scope_key（page_id 或 hash_xxx），与 project_id 一起用于写入 ai_modify_messages
    scope_key: str | None = None
