import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, UUIDPKMixin


class Quiz(Base, UUIDPKMixin, SoftDeleteMixin):
    __tablename__ = "quizzes"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    source_chat_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=True)
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("uploaded_files.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    difficulty: Mapped[str | None] = mapped_column(String(30))
    total_questions: Mapped[int] = mapped_column(Integer)
    # Not in the original schema doc — added to support the quiz wizard's
    # time limit and hint-availability settings.
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hints_enabled: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    questions: Mapped[list["QuizQuestion"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")
    attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="quiz", cascade="all, delete-orphan")


class QuizQuestion(Base, UUIDPKMixin):
    __tablename__ = "quiz_questions"

    quiz_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    question_text: Mapped[str] = mapped_column(Text)
    explanation: Mapped[str | None] = mapped_column(Text)
    question_order: Mapped[int] = mapped_column(Integer)
    # Not in the original schema doc — needed so the frontend knows whether to
    # render multiple-choice buttons, true/false buttons, or a free-text box,
    # and to optionally surface a hint before the user answers.
    question_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)

    quiz: Mapped["Quiz"] = relationship(back_populates="questions")
    options: Mapped[list["QuizOption"]] = relationship(back_populates="question", cascade="all, delete-orphan")


class QuizOption(Base, UUIDPKMixin):
    __tablename__ = "quiz_options"

    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), index=True)
    option_text: Mapped[str] = mapped_column(Text)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False)

    question: Mapped["QuizQuestion"] = relationship(back_populates="options")


class QuizAttempt(Base, UUIDPKMixin):
    __tablename__ = "quiz_attempts"

    quiz_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quizzes.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    percentage: Mapped[float | None] = mapped_column(Numeric(5, 2))
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    quiz: Mapped["Quiz"] = relationship(back_populates="attempts")
    answers: Mapped[list["QuizAnswer"]] = relationship(back_populates="attempt", cascade="all, delete-orphan")


class QuizAnswer(Base, UUIDPKMixin):
    __tablename__ = "quiz_answers"

    attempt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_attempts.id", ondelete="CASCADE"), index=True)
    question_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"))
    selected_option_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("quiz_options.id"), nullable=True)
    # Denormalized from quiz_options.is_correct at answer-submission time (Gap-8
    # from Phase 0 review). Quizzes are immutable once created (no edit flow in
    # the UX doc), so this can't drift — it exists purely so grading/analytics
    # queries don't need a join back to quiz_options.
    is_correct: Mapped[bool] = mapped_column(Boolean)

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="answers")


class Flashcard(Base, UUIDPKMixin, SoftDeleteMixin):
    __tablename__ = "flashcards"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    source_chat_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=True)
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("uploaded_files.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")

    items: Mapped[list["FlashcardItem"]] = relationship(back_populates="flashcard", cascade="all, delete-orphan")


class FlashcardItem(Base, UUIDPKMixin):
    __tablename__ = "flashcard_items"

    flashcard_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("flashcards.id", ondelete="CASCADE"), index=True)
    front_text: Mapped[str] = mapped_column(Text)
    back_text: Mapped[str] = mapped_column(Text)
    order_number: Mapped[int] = mapped_column(Integer)

    flashcard: Mapped["Flashcard"] = relationship(back_populates="items")


class ShortNote(Base, UUIDPKMixin, SoftDeleteMixin):
    __tablename__ = "short_notes"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    source_chat_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=True)
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("uploaded_files.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")


class MindMap(Base, UUIDPKMixin, SoftDeleteMixin):
    __tablename__ = "mind_maps"

    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    json_structure: Mapped[dict] = mapped_column(JSONB)
    source_chat_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("chats.id"), nullable=True)
    source_file_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("uploaded_files.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()")
