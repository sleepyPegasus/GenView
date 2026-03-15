from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Conversation, Message, Project
from app.schemas import ConversationCreate, ConversationOut, ConversationUpdate, MessageOut

router = APIRouter(prefix="/api/conversations", tags=["conversations"])

DEFAULT_NAV_MENU_ITEMS = [
    {"label": "Dashboard", "icon": "LayoutDashboard", "selected": True},
    {"label": "Analytics", "icon": "BarChart", "selected": False},
    {"label": "Settings", "icon": "Settings", "selected": False},
]


def _nav_config_to_menu_items(nav_config: dict | None) -> list[dict]:
    """Convert project nav_config (pageId/label) to conversation nav_menu_items (label/icon/children)."""
    if not nav_config:
        return DEFAULT_NAV_MENU_ITEMS
    items = nav_config.get("items")
    if items:
        result = []
        for i, it in enumerate(items):
            entry = {"label": it.get("label", ""), "icon": it.get("icon", ""), "selected": i == 0}
            children = it.get("children")
            if children:
                entry["children"] = [{"label": c.get("label", ""), "icon": c.get("icon", "")} for c in children]
            result.append(entry)
        return result
    side = nav_config.get("side") or []
    top = nav_config.get("top") or []
    items = side if side else top
    if not items:
        return DEFAULT_NAV_MENU_ITEMS
    return [{"label": it.get("label", ""), "icon": it.get("icon", ""), "selected": i == 0} for i, it in enumerate(items)]


def _project_menu_items_to_conv(project_items: list[dict] | None) -> list[dict]:
    """Use project nav_menu_items, add selected to first item for new conversation. Preserves children."""
    if not project_items:
        return DEFAULT_NAV_MENU_ITEMS
    result = []
    first = True
    for it in project_items:
        entry = {k: v for k, v in it.items() if k != "selected"}
        children = entry.get("children")
        if children:
            entry["selected"] = False
            entry["children"] = [
                {**c, "selected": first and i == 0} if isinstance(c, dict) else c
                for i, c in enumerate(children)
            ]
            if first:
                first = False
        else:
            entry["selected"] = first
            if first:
                first = False
        result.append(entry)
    return result


@router.get("", response_model=list[ConversationOut])
async def list_conversations(
    project_id: str = Query(...), db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.project_id == project_id)
        .order_by(Conversation.updated_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=ConversationOut, status_code=201)
async def create_conversation(
    body: ConversationCreate, db: AsyncSession = Depends(get_db)
):
    project_id = body.project_id
    title = body.title or "New Conversation"

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if project:
        nav_items = (
            _project_menu_items_to_conv(project.nav_menu_items)
            if project.nav_menu_items
            else _nav_config_to_menu_items(project.nav_config)
        )
        conv = Conversation(
            project_id=project_id,
            title=title,
            app_name=project.name,
            logo_url=project.logo_url or "",
            nav_layout=project.nav_layout or "side",
            theme=project.theme or "modern-b2b",
            custom_theme=project.custom_theme,
            model=project.model or "google/gemini-3.1-pro-preview",
            conversation_mode=project.conversation_mode or "agent",
            nav_background_color=project.nav_background_color,
            app_name_font_size=project.app_name_font_size,
            app_name_color=project.app_name_color,
            nav_menu_items=nav_items,
        )
    else:
        conv = Conversation(
            project_id=project_id,
            title=title,
            app_name="GenView Dashboard",
            logo_url="",
            nav_layout="side",
            theme="modern-b2b",
            custom_theme=None,
            model="google/gemini-3.1-pro-preview",
            conversation_mode="agent",
            nav_menu_items=DEFAULT_NAV_MENU_ITEMS,
        )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


@router.get("/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.id == conversation_id)
        .options(selectinload(Conversation.messages))
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(404, "Conversation not found")
    return conv


@router.patch("/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    conversation_id: str,
    body: ConversationUpdate,
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    if body.title is not None:
        conv.title = body.title
    if body.app_name is not None:
        conv.app_name = body.app_name
    if body.logo_url is not None:
        conv.logo_url = body.logo_url
    if body.nav_layout is not None:
        conv.nav_layout = body.nav_layout
    if body.theme is not None:
        conv.theme = body.theme
    if body.custom_theme is not None:
        conv.custom_theme = body.custom_theme
    if body.model is not None:
        conv.model = body.model
    if body.conversation_mode is not None:
        conv.conversation_mode = body.conversation_mode
    if body.nav_background_color is not None:
        conv.nav_background_color = body.nav_background_color
    if body.app_name_font_size is not None:
        conv.app_name_font_size = body.app_name_font_size
    if body.app_name_color is not None:
        conv.app_name_color = body.app_name_color
    if body.nav_menu_items is not None:
        conv.nav_menu_items = body.nav_menu_items
    await db.commit()
    await db.refresh(conv)
    return conv


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str, db: AsyncSession = Depends(get_db)
):
    conv = await db.get(Conversation, conversation_id)
    if not conv:
        raise HTTPException(404, "Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"success": True}


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    conversation_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.delete("/{conversation_id}/messages/{message_id}")
async def delete_message(
    conversation_id: str, message_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.conversation_id == conversation_id,
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(404, "Message not found")
    await db.delete(msg)
    await db.commit()
    return {"success": True}
