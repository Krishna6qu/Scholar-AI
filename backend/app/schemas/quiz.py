import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

QuestionType = Literal["mcq", "true_false", "short_answer"]
Difficulty = Literal["easy", "medium", "hard", "interview_hard"]


class QuizGenerateRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=300)
    question_type: Literal["mcq", "true_false", "short_answer", "mix"]
    total_questions: int = Field(ge=1, le=50)
    # Required only when question_type == "mix": which types to combine and
    # how many of each. Must select exactly 2 or 3 types (not 1 — that's not
    # really a "mix" — and not more than the 3 available types).
    mix_breakdown: dict[QuestionType, int] | None = None
    difficulty: Difficulty
    time_limit_minutes: int = Field(ge=2, le=30)
    hints_enabled: bool = False

    @model_validator(mode="after")
    def validate_mix(self) -> "QuizGenerateRequest":
        if self.question_type == "mix":
            if not self.mix_breakdown:
                raise ValueError("mix_breakdown is required when question_type is 'mix'.")
            if len(self.mix_breakdown) not in (2, 3):
                raise ValueError("Select exactly 2 or 3 question types for a mixed quiz.")
            if sum(self.mix_breakdown.values()) != self.total_questions:
                raise ValueError("The mix_breakdown counts must add up to total_questions.")
            if any(v <= 0 for v in self.mix_breakdown.values()):
                raise ValueError("Each selected type must have at least 1 question.")
        elif self.mix_breakdown:
            raise ValueError("mix_breakdown should only be set when question_type is 'mix'.")
        return self


class QuizOptionTakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    option_text: str


class QuizQuestionTakeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    question_text: str
    question_order: int
    question_type: str | None
    hint: str | None
    options: list[QuizOptionTakeResponse] = []


class QuizResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    id: uuid.UUID
    title: str
    difficulty: str | None
    total_questions: int
    time_limit_minutes: int | None
    hints_enabled: bool | None
    created_at: datetime


class QuizTakeResponse(QuizResponse):
    questions: list[QuizQuestionTakeResponse] = []


class AnswerSubmit(BaseModel):
    question_id: uuid.UUID
    selected_option_id: uuid.UUID | None = None
    text_answer: str | None = None


class QuizAttemptSubmit(BaseModel):
    answers: list[AnswerSubmit]


class AnswerResult(BaseModel):
    question_id: uuid.UUID
    question_text: str
    is_correct: bool
    your_answer: str | None
    correct_answer: str | None
    explanation: str | None


class QuizAttemptResult(BaseModel):
    attempt_id: uuid.UUID
    score: float
    percentage: float
    total_questions: int
    correct_count: int
    results: list[AnswerResult]


class QuizHistoryItem(BaseModel):
    attempt_id: uuid.UUID
    quiz_id: uuid.UUID
    quiz_title: str
    score: float | None
    percentage: float | None
    completed_at: datetime | None
