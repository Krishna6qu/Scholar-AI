import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chat_id: uuid.UUID | None
    original_name: str
    mime_type: str
    file_size: int
    processing_status: str
    created_at: datetime


class FileDetailResponse(FileResponse):
    content: str | None = None
