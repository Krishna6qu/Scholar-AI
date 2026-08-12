import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Chat, ChatMessage, SenderType


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_chat(self, user_id: uuid.UUID, title: str | None, model_used: str) -> Chat:
        chat = Chat(user_id=user_id, title=title, model_used=model_used)
        self.db.add(chat)
        await self.db.commit()
        await self.db.refresh(chat)
        return chat

    async def list_chats(self, user_id: uuid.UUID) -> list[Chat]:
        result = await self.db.execute(
            select(Chat)
            .where(Chat.user_id == user_id, Chat.deleted_at.is_(None))
            .order_by(Chat.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_chat(
        self, chat_id: uuid.UUID, user_id: uuid.UUID, with_messages: bool = False
    ) -> Chat | None:
        query = select(Chat).where(
            Chat.id == chat_id, Chat.user_id == user_id, Chat.deleted_at.is_(None)
        )
        if with_messages:
            query = query.options(selectinload(Chat.messages))
        result = await self.db.execute(query)
        return result.scalar_one_or_none()

    async def add_message(
        self,
        chat_id: uuid.UUID,
        sender: SenderType,
        content: str,
        token_count: int | None = None,
        response_time_ms: int | None = None,
    ) -> ChatMessage:
        message = ChatMessage(
            chat_id=chat_id,
            sender=sender,
            content=content,
            token_count=token_count,
            response_time_ms=response_time_ms,
        )
        self.db.add(message)
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def get_message(self, message_id: uuid.UUID, chat_id: uuid.UUID) -> ChatMessage | None:
        result = await self.db.execute(
            select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.chat_id == chat_id)
        )
        return result.scalar_one_or_none()

    async def set_message_feedback(self, message: ChatMessage, feedback: str | None) -> ChatMessage:
        message.feedback = feedback
        await self.db.commit()
        await self.db.refresh(message)
        return message

    async def update_chat(self, chat: Chat, data: dict) -> Chat:
        for key, value in data.items():
            setattr(chat, key, value)
        await self.db.commit()
        await self.db.refresh(chat)
        return chat

    async def soft_delete(self, chat: Chat) -> None:
        chat.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
