import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.quiz import (
    QuizAttemptResult,
    QuizAttemptSubmit,
    QuizGenerateRequest,
    QuizHistoryItem,
    QuizResponse,
    QuizTakeResponse,
)
from app.services.quiz_service import QuizService

router = APIRouter()


@router.get("/history/recent", response_model=list[QuizHistoryItem])
async def get_recent_quiz_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await QuizService(db).list_recent_attempts(current_user.id)


@router.post("/generate", response_model=QuizResponse, status_code=status.HTTP_201_CREATED)
async def generate_quiz(
    data: QuizGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await QuizService(db).generate(current_user.id, data)


@router.get("", response_model=list[QuizResponse])
async def list_quizzes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await QuizService(db).list_quizzes(current_user.id)


@router.get("/{quiz_id}", response_model=QuizTakeResponse)
async def get_quiz(
    quiz_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await QuizService(db).get_quiz_for_taking(quiz_id, current_user.id)


@router.post("/{quiz_id}/attempts", response_model=QuizAttemptResult)
async def submit_attempt(
    quiz_id: uuid.UUID,
    data: QuizAttemptSubmit,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await QuizService(db).submit_attempt(quiz_id, current_user.id, data.answers)
