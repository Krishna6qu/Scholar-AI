import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.note import NoteDetail, NoteGenerateRequest, NoteSummary
from app.services.note_service import NoteService

router = APIRouter()


@router.post("", response_model=NoteDetail, status_code=status.HTTP_201_CREATED)
async def generate_note(
    data: NoteGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NoteService(db).generate(current_user.id, data)


@router.get("", response_model=list[NoteSummary])
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NoteService(db).list_notes(current_user.id)


@router.get("/{note_id}", response_model=NoteDetail)
async def get_note(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await NoteService(db).get_note(note_id, current_user.id)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await NoteService(db).delete_note(note_id, current_user.id)
