from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Conversation, Message
from app.schemas import ConversationCreate, ConversationOut, MessageOut

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


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
    conv = Conversation(**body.model_dump())
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
