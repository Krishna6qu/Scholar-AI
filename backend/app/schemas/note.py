import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NoteGenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    source_chat_id: uuid.UUID | None = None


class NoteSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime


class NoteDetail(NoteSummary):
    content: str
