import uuid
from pydantic import BaseModel, ConfigDict
from app.schemas.chat import MessageResponse

class LinkPreviewRequest(BaseModel):
    url: str

class LinkPreviewResponse(BaseModel):
    url: str
    title: str
    source_type: str  # youtube, pdf, article
    author_or_domain: str | None = None
    thumbnail_url: str | None = None

class LinkSummarizeRequest(BaseModel):
    url: str
    chat_id: uuid.UUID | None = None
    custom_instructions: str | None = None

class LinkSummarizeResponse(BaseModel):
    chat_id: uuid.UUID
    chat_title: str
    source_title: str
    source_type: str
    user_message: MessageResponse
    assistant_message: MessageResponse
    audio_script: str
