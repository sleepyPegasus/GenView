import datetime
import uuid

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, Integer, LargeBinary, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


def _gen_id() -> str:
    return uuid.uuid4().hex[:25]


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    name: Mapped[str] = mapped_column(String(200), default="GenView Dashboard")
    logo_url: Mapped[str] = mapped_column(Text, default="")
    nav_layout: Mapped[str] = mapped_column(String(20), default="side")
    theme: Mapped[str] = mapped_column(String(50), default="modern-b2b")
    custom_theme: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    model: Mapped[str] = mapped_column(String(100), default="google/gemini-3.1-pro-preview")
    kg_model: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    conversation_mode: Mapped[str] = mapped_column(String(20), default="agent")
    nav_background_color: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    app_name_font_size: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    app_name_color: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    nav_config: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    nav_menu_items: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )

    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    pages: Mapped[list["Page"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    timeline_events: Mapped[list["ProjectTimelineEvent"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    title: Mapped[str] = mapped_column(String(300), default="New Conversation")
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    # Conversation-level settings (inherited from project when created)
    app_name: Mapped[str] = mapped_column(String(200), default="GenView Dashboard")
    logo_url: Mapped[str] = mapped_column(Text, default="")
    nav_layout: Mapped[str] = mapped_column(String(20), default="side")
    theme: Mapped[str] = mapped_column(String(50), default="modern-b2b")
    custom_theme: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    model: Mapped[str] = mapped_column(String(100), default="google/gemini-3.1-pro-preview")
    conversation_mode: Mapped[str] = mapped_column(String(20), default="agent")
    nav_background_color: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    app_name_font_size: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    app_name_color: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    nav_menu_items: Mapped[list[dict] | None] = mapped_column(JSONB, nullable=True, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text, default="")
    code_block: Mapped[str | None] = mapped_column(Text, nullable=True)
    code_language: Mapped[str | None] = mapped_column(String(20), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")

    __table_args__ = (Index("ix_messages_conversation_id", "conversation_id"),)


class Page(Base):
    __tablename__ = "pages"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(200), default="Untitled Page")
    nav_label: Mapped[str] = mapped_column(String(100), default="")
    code_block: Mapped[str] = mapped_column(Text, default="")
    code_language: Mapped[str] = mapped_column(String(20), default="tsx")
    extra_files: Mapped[dict | None] = mapped_column(JSONB, nullable=True, default=None)
    source_conversation_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    source_message_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    screenshot_blob: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, default=None)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="pages")

    __table_args__ = (Index("ix_pages_project_id", "project_id"),)


class ProjectTimelineEvent(Base):
    """项目时间线节点：阶段节点(phase) 或 自定义事件(custom)"""
    __tablename__ = "project_timeline_events"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    type: Mapped[str] = mapped_column(String(20), default="phase")  # phase | custom

    # 阶段节点 (type=phase)
    phase_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
    phase_label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # pending | in_progress | completed
    start_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)

    # 自定义节点 (type=custom)
    title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    event_date: Mapped[datetime.date | None] = mapped_column(Date, nullable=True)
    event_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    participants: Mapped[str | None] = mapped_column(String(200), nullable=True)
    tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    attachments: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # [{"name": str, "url": str}, ...]

    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project: Mapped["Project"] = relationship(back_populates="timeline_events")

    __table_args__ = (Index("ix_timeline_events_project_id", "project_id"),)


class KgBuildHistory(Base):
    """知识图谱构建历史"""

    __tablename__ = "kg_build_history"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    doc_count: Mapped[int] = mapped_column(Integer, default=0)
    msg_count: Mapped[int] = mapped_column(Integer, default=0)
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    timeline_count: Mapped[int] = mapped_column(Integer, default=0)
    node_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    edge_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(30))  # success | error | no_documents
    error: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (Index("ix_kg_build_history_project_id", "project_id"),)


class KgQuerySession(Base):
    """知识图谱查询会话"""

    __tablename__ = "kg_query_sessions"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))

    title: Mapped[str] = mapped_column(String(200), default="新对话")

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (Index("ix_kg_query_sessions_project_id", "project_id"),)


class KgQueryMessage(Base):
    """知识图谱查询历史消息"""

    __tablename__ = "kg_query_messages"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    session_id: Mapped[str | None] = mapped_column(
        String(30),
        ForeignKey("kg_query_sessions.id", ondelete="CASCADE"),
        nullable=True,
    )

    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    query_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_kg_query_messages_project_id", "project_id"),
        Index("ix_kg_query_messages_session_id", "session_id"),
    )


class AiModifyMessage(Base):
    """AI 修改对话消息（与普通 conversation 分离，按 scope_key 索引）"""

    __tablename__ = "ai_modify_messages"

    id: Mapped[str] = mapped_column(String(30), primary_key=True, default=_gen_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    scope_key: Mapped[str] = mapped_column(String(100))  # page_id 或 hash_xxx
    role: Mapped[str] = mapped_column(String(20))  # user | assistant
    content: Mapped[str] = mapped_column(Text, default="")
    referenced_code: Mapped[str | None] = mapped_column(Text, nullable=True)  # 用户消息引用的选中代码
    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_ai_modify_messages_project_scope", "project_id", "scope_key"),
    )
