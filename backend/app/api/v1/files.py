import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.repositories.file_repository import FileRepository
from app.schemas.file import FileResponse
from app.services.file_service import FileService

router = APIRouter()


@router.post("", response_model=FileResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
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
    """Serves the raw file bytes so it can be opened/viewed from the chat UI."""
    file = await FileRepository(db).get_by_id(file_id, current_user.id)
    if file is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "File not found.")

    contents = await FileService(db).read_content(file.storage_key)

    return Response(
        content=contents,
        media_type=file.mime_type,
        headers={"Content-Disposition": f'inline; filename="{file.original_name}"'},
    )
