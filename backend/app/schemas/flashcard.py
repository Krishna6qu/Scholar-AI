import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FlashcardGenerateRequest(BaseModel):
    topic: str = Field(min_length=3, max_length=300)
    count: int = Field(ge=3, le=25, default=12)
    source_chat_id: uuid.UUID | None = None


class FlashcardItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    front_text: str
    back_text: str
    order_number: int


class FlashcardSetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    created_at: datetime


class FlashcardSetDetail(FlashcardSetSummary):
    items: list[FlashcardItemResponse] = []
