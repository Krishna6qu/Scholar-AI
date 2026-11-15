import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import Chat
from app.models.roadmap import Roadmap
from app.models.study import Flashcard, MindMap, Quiz, QuizQuestion, ShortNote
from app.models.identity import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.quiz_repository import QuizRepository
from app.schemas.user import LearningStatsResponse


def compute_day_streak(activity_dates: list[date], today: date) -> int:
    if not activity_dates:
        return 0

    unique_dates = sorted(set(activity_dates), reverse=True)
    most_recent = unique_dates[0]

    if most_recent == today:
        current_check = today
    elif most_recent == today - timedelta(days=1):
        current_check = today - timedelta(days=1)
    else:
        return 0

    streak = 0
    date_set = set(unique_dates)
    while current_check in date_set:
        streak += 1
        current_check -= timedelta(days=1)

    return streak


class StatsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.chats = ChatRepository(db)
        self.quizzes = QuizRepository(db)

    async def get_activity_dates(self, user_id: uuid.UUID) -> list[date]:
        query = text("""
            SELECT DISTINCT CAST(act.act_time AS DATE) as act_date
            FROM (
                SELECT created_at AS act_time FROM chats WHERE user_id = :uid AND deleted_at IS NULL
                UNION ALL
                SELECT m.created_at AS act_time FROM chat_messages m JOIN chats c ON c.id = m.chat_id WHERE c.user_id = :uid AND m.sender = 'user'
                UNION ALL
                SELECT created_at AS act_time FROM quizzes WHERE owner_id = :uid AND deleted_at IS NULL
                UNION ALL
                SELECT started_at AS act_time FROM quiz_attempts WHERE user_id = :uid
                UNION ALL
                SELECT created_at AS act_time FROM flashcards WHERE owner_id = :uid AND deleted_at IS NULL
                UNION ALL
                SELECT created_at AS act_time FROM short_notes WHERE owner_id = :uid AND deleted_at IS NULL
                UNION ALL
                SELECT created_at AS act_time FROM mind_maps WHERE owner_id = :uid AND deleted_at IS NULL
                UNION ALL
                SELECT created_at AS act_time FROM roadmaps WHERE owner_id = :uid AND deleted_at IS NULL
            ) act
            ORDER BY act_date DESC
        """)
        result = await self.db.execute(query, {"uid": user_id})
        parsed_dates: list[date] = []
        for row in result.fetchall():
            d = row[0]
            if d is not None:
                if isinstance(d, datetime):
                    parsed_dates.append(d.date())
                elif isinstance(d, date):
                    parsed_dates.append(d)
                elif isinstance(d, str):
                    try:
                        parsed_dates.append(datetime.strptime(d[:10], "%Y-%m-%d").date())
                    except ValueError:
                        pass
        return parsed_dates

    async def get_learning_stats(self, user_id: uuid.UUID, user_tz: str = "UTC") -> LearningStatsResponse:
        total_chats = await self.chats.count_all(user_id)
        total_quizzes = await self.quizzes.count_all(user_id)
        activity_dates = await self.get_activity_dates(user_id)

        try:
            today = datetime.now(ZoneInfo(user_tz)).date()
        except Exception:
            today = datetime.now(timezone.utc).date()

        day_streak = compute_day_streak(activity_dates, today)

        return LearningStatsResponse(
            total_chats=total_chats,
            total_quizzes=total_quizzes,
            day_streak=day_streak,
        )

    async def export_user_data(self, user: User) -> dict[str, Any]:
        user_id = user.id

        profile_data = {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "username": user.username,
            "bio": user.bio,
            "college": user.college,
            "course": user.course,
            "timezone": user.timezone,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }

        chats_result = await self.db.execute(
            select(Chat)
            .where(Chat.user_id == user_id, Chat.deleted_at.is_(None))
            .options(selectinload(Chat.messages))
            .order_by(Chat.created_at.desc())
        )
        chats = chats_result.scalars().all()
        chats_data = [
            {
                "id": str(c.id),
                "title": c.title,
                "model_used": c.model_used,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "messages": [
                    {
                        "id": str(m.id),
                        "sender": m.sender.value if hasattr(m.sender, "value") else str(m.sender),
                        "content": m.content,
                        "created_at": m.created_at.isoformat() if m.created_at else None,
                        "feedback": m.feedback,
                    }
                    for m in c.messages
                ],
            }
            for c in chats
        ]

        notes_result = await self.db.execute(
            select(ShortNote)
            .where(ShortNote.owner_id == user_id, ShortNote.deleted_at.is_(None))
            .order_by(ShortNote.created_at.desc())
        )
        notes = notes_result.scalars().all()
        notes_data = [
            {
                "id": str(n.id),
                "title": n.title,
                "content": n.content,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ]

        fc_result = await self.db.execute(
            select(Flashcard)
            .where(Flashcard.owner_id == user_id, Flashcard.deleted_at.is_(None))
            .options(selectinload(Flashcard.items))
            .order_by(Flashcard.created_at.desc())
        )
        flashcards = fc_result.scalars().all()
        flashcards_data = [
            {
                "id": str(f.id),
                "title": f.title,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "times_reviewed": f.times_reviewed,
                "cards": [
                    {
                        "id": str(item.id),
                        "front": item.front_text,
                        "back": item.back_text,
                        "order": item.order_number,
                    }
                    for item in f.items
                ],
            }
            for f in flashcards
        ]

        qz_result = await self.db.execute(
            select(Quiz)
            .where(Quiz.owner_id == user_id, Quiz.deleted_at.is_(None))
            .options(
                selectinload(Quiz.questions).selectinload(QuizQuestion.options),
                selectinload(Quiz.attempts),
            )
            .order_by(Quiz.created_at.desc())
        )
        quizzes = qz_result.scalars().all()
        quizzes_data = [
            {
                "id": str(q.id),
                "title": q.title,
                "difficulty": q.difficulty,
                "total_questions": q.total_questions,
                "created_at": q.created_at.isoformat() if q.created_at else None,
                "questions": [
                    {
                        "id": str(quest.id),
                        "question_text": quest.question_text,
                        "explanation": quest.explanation,
                        "type": quest.question_type,
                        "options": [
                            {"text": opt.option_text, "is_correct": opt.is_correct}
                            for opt in quest.options
                        ],
                    }
                    for quest in q.questions
                ],
                "attempts": [
                    {
                        "id": str(att.id),
                        "score": float(att.score) if att.score is not None else None,
                        "percentage": float(att.percentage) if att.percentage is not None else None,
                        "started_at": att.started_at.isoformat() if att.started_at else None,
                        "completed_at": att.completed_at.isoformat() if att.completed_at else None,
                    }
                    for att in q.attempts
                ],
            }
            for q in quizzes
        ]

        mm_result = await self.db.execute(
            select(MindMap)
            .where(MindMap.owner_id == user_id, MindMap.deleted_at.is_(None))
            .order_by(MindMap.created_at.desc())
        )
        mindmaps = mm_result.scalars().all()
        mindmaps_data = [
            {
                "id": str(m.id),
                "title": m.title,
                "structure": m.json_structure,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in mindmaps
        ]

        rm_result = await self.db.execute(
            select(Roadmap)
            .where(Roadmap.owner_id == user_id, Roadmap.deleted_at.is_(None))
            .order_by(Roadmap.created_at.desc())
        )
        roadmaps = rm_result.scalars().all()
        roadmaps_data = [
            {
                "id": str(r.id),
                "title": r.title,
                "topic": r.topic,
                "structure": r.json_structure,
                "step_progress": r.step_progress,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in roadmaps
        ]

        return {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "profile": profile_data,
            "chats": chats_data,
            "notes": notes_data,
            "flashcard_sets": flashcards_data,
            "quizzes": quizzes_data,
            "mind_maps": mindmaps_data,
            "roadmaps": roadmaps_data,
        }
