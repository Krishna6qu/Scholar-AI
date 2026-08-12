import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.flashcard import FlashcardGenerateRequest, FlashcardSetDetail, FlashcardSetSummary
from app.services.flashcard_service import FlashcardService

router = APIRouter()


@router.post("", response_model=FlashcardSetDetail, status_code=status.HTTP_201_CREATED)
async def generate_flashcards(
    data: FlashcardGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FlashcardService(db).generate(current_user.id, data)


@router.get("", response_model=list[FlashcardSetSummary])
async def list_flashcard_sets(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FlashcardService(db).list_sets(current_user.id)


@router.get("/{flashcard_id}", response_model=FlashcardSetDetail)
async def get_flashcard_set(
    flashcard_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await FlashcardService(db).get_set(flashcard_id, current_user.id)


@router.delete("/{flashcard_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_flashcard_set(
    flashcard_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await FlashcardService(db).delete_set(flashcard_id, current_user.id)
