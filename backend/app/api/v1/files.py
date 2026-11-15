import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.identity import User
from app.repositories.file_repository import FileRepository
from app.schemas.file import FileResponse
from app.services.file_service import FileService

router = APIRouter()


@router.post("", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
async def upload_file(
    request: Request,
    file: UploadFile = File(...),
    chat_id: uuid.UUID | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FileService(db).upload(current_user.id, chat_id, file)


@router.get("/{file_id}")
async def get_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns file metadata plus its extracted text content (if any) for the
    in-app viewer modal. content is null for file types we don't extract
    text from yet (docx/pptx/xlsx — real Phase 7 work)."""
    file, content = await FileRepository(db).get_file_with_content(file_id, current_user.id)
    if file is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")
    return {
        "id": str(file.id),
        "original_name": file.original_name,
        "mime_type": file.mime_type,
        "content": content,
    }


@router.get("/{file_id}/content")
async def get_file_content(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Serves the raw file bytes securely so it can be viewed or downloaded."""
    file = await FileRepository(db).get_by_id(file_id, current_user.id)
    if file is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")

    contents = await FileService(db).read_content(file.storage_key)

    # Sanitize filename against CRLF header injection and quoting issues
    safe_name = file.original_name.replace('"', '').replace('\r', '').replace('\n', '').strip() or "download"

    # Only inline safe media types (PDF, common images). Everything else is attachment.
    safe_inline_mimes = {"application/pdf", "image/png", "image/jpeg", "image/webp"}
    disposition_type = "inline" if file.mime_type.lower() in safe_inline_mimes else "attachment"

    headers = {
        "Content-Disposition": f'{disposition_type}; filename="{safe_name}"',
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'",
    }

    return Response(
        content=contents,
        media_type=file.mime_type,
        headers=headers,
    )
