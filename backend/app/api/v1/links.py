from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.identity import User
from app.schemas.link import (
    LinkPreviewRequest,
    LinkPreviewResponse,
    LinkSummarizeRequest,
    LinkSummarizeResponse,
)
from app.services.source_service import SourceService

router = APIRouter()


@router.post("/preview", response_model=LinkPreviewResponse, status_code=status.HTTP_200_OK)
@limiter.limit("20/minute")
async def preview_link(
    request: Request,
    data: LinkPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Quickly fetch metadata preview for a dropped or pasted link (YouTube video,
    online PDF, or web article) before generating a summary.
    """
    service = SourceService(db)
    result = await service.extract_preview(data.url)
    return LinkPreviewResponse(**result)


@router.post("/summarize", response_model=LinkSummarizeResponse, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def summarize_link(
    request: Request,
    data: LinkSummarizeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a video link (YouTube), web document, or article URL, extract its content,
    ground it in the student's chat session, generate an in-depth structured study summary,
    and generate an engaging audio overview script.
    """
    service = SourceService(db)
    result = await service.ingest_and_summarize(
        user_id=current_user.id,
        url=data.url,
        chat_id=data.chat_id,
        custom_instructions=data.custom_instructions,
    )
    return LinkSummarizeResponse(**result)
