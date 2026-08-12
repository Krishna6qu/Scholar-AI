import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class SenderType(str, enum.Enum):
    user = "user"
    assistant = "assistant"
    system = "system"


class Chat(Base, UUIDPKMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "chats"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str | None] = mapped_column(String(255))
    model_used: Mapped[str | None] = mapped_column(String(100))
    system_prompt: Mapped[str | None] = mapped_column(Text)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="chat", cascade="all, delete-orphan", order_by="ChatMessage.created_at"
    )


class ChatMessage(Base, UUIDPKMixin):
    __tablename__ = "chat_messages"

    chat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="CASCADE"), index=True
    )
    sender: Mapped[SenderType] = mapped_column(Enum(SenderType, name="sender_type"))
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int | None] = mapped_column(Integer)
    response_time_ms: Mapped[int | None] = mapped_column(Integer)
    parent_message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chat_messages.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True, server_default="now()")
    # 'like' / 'dislike' / null — user feedback on assistant responses. Not in
    # the original schema doc; added to support thumbs up/down in the UI.
    feedback: Mapped[str | None] = mapped_column(String(10), nullable=True)

    chat: Mapped["Chat"] = relationship(back_populates="messages")
