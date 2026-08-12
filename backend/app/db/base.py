"""
Base class + shared mixins for all ORM models.

Every table in the schema uses a UUID PK and created_at/updated_at.
Gap-3 from Phase 0 review: soft delete (deleted_at) is only specified
for `users` in the schema doc, but the data-ownership rules call for it
"where recovery or auditing is valuable." Decision made here: give every
user-owned content table (chats, uploaded_files, quizzes, flashcards,
short_notes, mind_maps) a deleted_at column via SoftDeleteMixin, since
retrofitting it later touches every repository method. Purely
transactional/log tables (chat_messages, quiz_answers, audit_logs,
refresh_sessions) do NOT get it — they're either immutable history or
already governed by their parent's soft delete.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
