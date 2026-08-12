from datetime import datetime
import enum
import uuid

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPKMixin


class ProcessingStatus(str, enum.Enum):
    uploading = "uploading"
    processing = "processing"
    ready = "ready"
    failed = "failed"


class UploadedFile(Base, UUIDPKMixin, SoftDeleteMixin):
    __tablename__ = "uploaded_files"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    chat_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("chats.id", ondelete="SET NULL"), nullable=True, index=True
    )
    file_name: Mapped[str] = mapped_column(String(255))
    original_name: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(120))
    file_extension: Mapped[str] = mapped_column(String(20))
    file_size: Mapped[int] = mapped_column(BigInteger)
    storage_key: Mapped[str] = mapped_column(Text)
    storage_provider: Mapped[str] = mapped_column(String(50), default="s3")
    checksum: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[ProcessingStatus] = mapped_column(
        Enum(ProcessingStatus, name="processing_status"), default=ProcessingStatus.uploading, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="file", cascade="all, delete-orphan"
    )


class DocumentChunk(Base, UUIDPKMixin):
    __tablename__ = "document_chunks"

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("uploaded_files.id", ondelete="CASCADE"), index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    # Gap-2 from Phase 0 review: this stores the Qdrant point ID (a UUID Qdrant
    # accepts natively), NOT a Postgres pgvector FK. pgvector extension is kept
    # available for future hybrid search but Qdrant is the source of truth for
    # vectors in v1 — avoids maintaining embeddings in two places.
    embedding_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    file: Mapped["UploadedFile"] = relationship(back_populates="chunks")


class AIModel(Base, UUIDPKMixin):
    __tablename__ = "ai_models"

    provider: Mapped[str] = mapped_column(String(100))
    model_name: Mapped[str] = mapped_column(String(100))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    context_window: Mapped[int | None] = mapped_column(Integer)
    max_output_tokens: Mapped[int | None] = mapped_column(Integer)
