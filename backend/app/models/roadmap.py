import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SoftDeleteMixin, UUIDPKMixin


class Roadmap(Base, UUIDPKMixin, SoftDeleteMixin):
    """
    Not part of the original DB schema doc — added to support the roadmap
    generator feature (a step-by-step career/learning path for a target role
    or topic, requested separately from the core Study Pack tools).
    """
    __tablename__ = "roadmaps"

    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    topic: Mapped[str] = mapped_column(String(300))
    json_structure: Mapped[dict[str, Any]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
