import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ChatCreate(BaseModel):
    title: str | None = None


class ChatUpdate(BaseModel):
    title: str | None = None
    is_pinned: bool | None = None
    archived: bool | None = None


class MessageCreate(BaseModel):
    content: str


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender: str
    content: str
    created_at: datetime
    feedback: str | None = None


class MessageFeedbackUpdate(BaseModel):
    feedback: str | None = None  # "like", "dislike", or null to clear


class ChatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())

    id: uuid.UUID
    title: str | None
    model_used: str | None
    is_pinned: bool
    archived: bool
    created_at: datetime
    updated_at: datetime


class ChatDetailResponse(ChatResponse):
    messages: list[MessageResponse] = []
    files: list["FileResponse"] = []


from app.schemas.file import FileResponse  # noqa: E402

ChatDetailResponse.model_rebuild()
