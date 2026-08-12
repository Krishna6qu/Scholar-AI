import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.chat import (
    ChatCreate,
    ChatDetailResponse,
    ChatResponse,
    ChatUpdate,
    MessageCreate,
    MessageFeedbackUpdate,
    MessageResponse,
)
from app.services.chat_service import ChatService

router = APIRouter()


@router.post("", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat(
    data: ChatCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).create_chat(current_user.id, data.title)


@router.get("", response_model=list[ChatResponse])
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).list_chats(current_user.id)


@router.get("/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).get_chat(chat_id, current_user.id)


@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(
    chat_id: uuid.UUID,
    data: ChatUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).rename_chat(chat_id, current_user.id, data)


@router.delete("/{chat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await ChatService(db).delete_chat(chat_id, current_user.id)


@router.post("/{chat_id}/messages", response_model=MessageResponse)
async def send_message(
    chat_id: uuid.UUID,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).send_message(chat_id, current_user.id, data.content)


@router.patch("/{chat_id}/messages/{message_id}/feedback", response_model=MessageResponse)
async def set_message_feedback(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    data: MessageFeedbackUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await ChatService(db).set_feedback(chat_id, message_id, current_user.id, data.feedback)
