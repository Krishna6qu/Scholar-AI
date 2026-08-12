import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MindMapGenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    source_chat_id: uuid.UUID | None = None


class MindMapSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime


class MindMapDetail(MindMapSummary):
    json_structure: dict[str, Any]
