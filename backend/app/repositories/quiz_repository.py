import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.study import Quiz, QuizAnswer, QuizAttempt, QuizOption, QuizQuestion


class QuizRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_recent_attempts(self, user_id: uuid.UUID, limit: int = 5) -> list[dict]:
        result = await self.db.execute(
            select(
                QuizAttempt.id.label("attempt_id"),
                QuizAttempt.quiz_id,
                Quiz.title.label("quiz_title"),
                QuizAttempt.score,
                QuizAttempt.percentage,
                QuizAttempt.completed_at,
            )
            .join(Quiz, Quiz.id == QuizAttempt.quiz_id)
            .where(QuizAttempt.user_id == user_id, QuizAttempt.completed_at.is_not(None))
            .order_by(QuizAttempt.completed_at.desc())
            .limit(limit)
        )
        return [dict(row._mapping) for row in result.all()]

    async def count_today(self, owner_id: uuid.UUID) -> int:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(Quiz).where(Quiz.owner_id == owner_id, Quiz.created_at >= today_start)
        )
        return result.scalar_one()


    async def create_quiz(self, **kwargs) -> Quiz:
        quiz = Quiz(**kwargs)
        self.db.add(quiz)
        await self.db.commit()
        await self.db.refresh(quiz)
        return quiz

    async def add_question(
        self,
        quiz_id: uuid.UUID,
        question_text: str,
        explanation: str | None,
        order: int,
        hint: str | None,
        question_type: str,
    ) -> QuizQuestion:
        question = QuizQuestion(
            quiz_id=quiz_id,
            question_text=question_text,
            explanation=explanation,
            question_order=order,
            hint=hint,
            question_type=question_type,
        )
        self.db.add(question)
        await self.db.commit()
        await self.db.refresh(question)
        return question

    async def add_option(self, question_id: uuid.UUID, text: str, is_correct: bool) -> QuizOption:
        option = QuizOption(question_id=question_id, option_text=text, is_correct=is_correct)
        self.db.add(option)
        await self.db.commit()
        await self.db.refresh(option)
        return option

    async def list_quizzes(self, owner_id: uuid.UUID) -> list[Quiz]:
        result = await self.db.execute(
            select(Quiz)
            .where(Quiz.owner_id == owner_id, Quiz.deleted_at.is_(None))
            .order_by(Quiz.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_quiz(self, quiz_id: uuid.UUID, owner_id: uuid.UUID) -> Quiz | None:
        result = await self.db.execute(
            select(Quiz)
            .where(Quiz.id == quiz_id, Quiz.owner_id == owner_id, Quiz.deleted_at.is_(None))
            .options(selectinload(Quiz.questions).selectinload(QuizQuestion.options))
        )
        return result.scalar_one_or_none()

    async def create_attempt(self, quiz_id: uuid.UUID, user_id: uuid.UUID) -> QuizAttempt:
        attempt = QuizAttempt(quiz_id=quiz_id, user_id=user_id)
        self.db.add(attempt)
        await self.db.commit()
        await self.db.refresh(attempt)
        return attempt

    async def add_answer(
        self,
        attempt_id: uuid.UUID,
        question_id: uuid.UUID,
        selected_option_id: uuid.UUID | None,
        is_correct: bool,
    ) -> QuizAnswer:
        answer = QuizAnswer(
            attempt_id=attempt_id,
            question_id=question_id,
            selected_option_id=selected_option_id,
            is_correct=is_correct,
        )
        self.db.add(answer)
        await self.db.commit()
        return answer

    async def complete_attempt(self, attempt: QuizAttempt, score: float, percentage: float) -> None:
        attempt.score = score
        attempt.percentage = percentage
        attempt.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
