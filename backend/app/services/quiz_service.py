import json
import re
import uuid

import litellm
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.repositories.quiz_repository import QuizRepository
from app.schemas.quiz import AnswerResult, AnswerSubmit, QuizAttemptResult, QuizGenerateRequest

DIFFICULTY_GUIDANCE = {
    "easy": "Simple recall and basic understanding — suitable for a beginner just learning the topic.",
    "medium": "Requires applying concepts, not just recalling facts — suitable for someone with working knowledge.",
    "hard": "Requires deeper analysis, multi-step reasoning, or connecting multiple concepts together.",
    "interview_hard": (
        "Interview-level difficulty — the kind of challenging, probing question an expert interviewer "
        "would ask to test true mastery, including edge cases and 'why' questions, not just 'what'."
    ),
}


def _resolve_api_key(model: str) -> str | None:
    if model.startswith("gemini/") or model.startswith("vertex_ai/"):
        return settings.GEMINI_API_KEY
    if model.startswith("claude") or model.startswith("anthropic/"):
        return settings.ANTHROPIC_API_KEY
    if model.startswith("gpt") or model.startswith("openai/"):
        return settings.OPENAI_API_KEY
    return None


def _extract_json(raw: str) -> dict:
    """Models sometimes wrap JSON in markdown code fences despite instructions
    not to — strip those before parsing. strict=False tolerates literal
    control characters (raw newlines) inside string values."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return json.loads(cleaned, strict=False)


def _build_prompt(data: QuizGenerateRequest, breakdown: dict) -> str:
    type_lines = []
    for qtype, count in breakdown.items():
        label = {"mcq": "multiple-choice", "true_false": "true/false", "short_answer": "short-answer"}[qtype]
        type_lines.append(f"- {count} {label} question(s)")

    hint_instruction = (
        'Include a short, non-giveaway "hint" field for each question that nudges the student '
        "without revealing the answer."
        if data.hints_enabled
        else 'Set "hint" to null for every question — hints are disabled for this quiz.'
    )

    return f"""You are a quiz-generation engine for a study app. Generate a quiz on the topic: "{data.topic}".

Difficulty level: {data.difficulty} — {DIFFICULTY_GUIDANCE[data.difficulty]}

Generate exactly this breakdown of question types:
{chr(10).join(type_lines)}

Rules per type:
- "mcq": provide exactly 4 options, exactly one marked "is_correct": true.
- "true_false": provide exactly 2 options ("True" and "False"), exactly one marked "is_correct": true.
- "short_answer": provide no options array; instead include "expected_answer" as a concise correct answer string.

{hint_instruction}
Every question must include a brief "explanation" of why the answer is correct, shown to the student after they answer.

Respond with ONLY valid JSON (no markdown code fences, no commentary), in exactly this shape:
{{
  "questions": [
    {{
      "type": "mcq" | "true_false" | "short_answer",
      "question_text": "...",
      "hint": "..." | null,
      "explanation": "...",
      "options": [{{"text": "...", "is_correct": true|false}}, ...],
      "expected_answer": "..."
    }}
  ]
}}
Omit "options" for short_answer questions and omit "expected_answer" for mcq/true_false questions."""


class QuizService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = QuizRepository(db)

    async def generate(self, user_id: uuid.UUID, data: QuizGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["quiz"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['quiz']} quizzes. Try again tomorrow.",
            )

        breakdown = data.mix_breakdown or {data.question_type: data.total_questions}
        prompt = _build_prompt(data, breakdown)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=_resolve_api_key(model),
            )
            parsed = _extract_json(response.choices[0].message.content)
        except json.JSONDecodeError:
            raise HTTPException(
                status.HTTP_502_BAD_GATEWAY,
                "The AI returned a response that couldn't be parsed as a quiz. Please try again.",
            )
        except Exception as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The AI provider could not generate the quiz: {e}")

        questions = parsed.get("questions", [])
        if not questions:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return any questions. Please try again.")

        quiz = await self.repo.create_quiz(
            owner_id=user_id,
            title=f"{data.topic.strip().title()} Quiz",
            difficulty=data.difficulty,
            total_questions=len(questions),
            time_limit_minutes=data.time_limit_minutes,
            hints_enabled=data.hints_enabled,
        )

        for order, q in enumerate(questions):
            question = await self.repo.add_question(
                quiz.id,
                q["question_text"],
                q.get("explanation"),
                order,
                q.get("hint") if data.hints_enabled else None,
                q["type"],
            )
            if q["type"] in ("mcq", "true_false"):
                for opt in q.get("options", []):
                    await self.repo.add_option(question.id, opt["text"], bool(opt.get("is_correct")))
            else:  # short_answer — store expected answer as the single "correct option"
                await self.repo.add_option(question.id, q.get("expected_answer", ""), True)

        return quiz

    async def list_quizzes(self, user_id: uuid.UUID):
        return await self.repo.list_quizzes(user_id)

    async def list_recent_attempts(self, user_id: uuid.UUID, limit: int = 5):
        return await self.repo.list_recent_attempts(user_id, limit)

    async def get_quiz_for_taking(self, quiz_id: uuid.UUID, user_id: uuid.UUID):
        quiz = await self.repo.get_quiz(quiz_id, user_id)
        if quiz is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")
        return quiz

    async def submit_attempt(
        self, quiz_id: uuid.UUID, user_id: uuid.UUID, answers: list[AnswerSubmit]
    ) -> QuizAttemptResult:
        quiz = await self.repo.get_quiz(quiz_id, user_id)
        if quiz is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Quiz not found.")

        questions_by_id = {q.id: q for q in quiz.questions}
        attempt = await self.repo.create_attempt(quiz_id, user_id)

        results: list[AnswerResult] = []
        correct_count = 0

        for ans in answers:
            question = questions_by_id.get(ans.question_id)
            if question is None:
                continue

            correct_option = next((o for o in question.options if o.is_correct), None)

            if question.question_type == "short_answer":
                your_answer = (ans.text_answer or "").strip()
                expected = (correct_option.option_text if correct_option else "").strip()
                is_correct = bool(your_answer) and your_answer.lower() == expected.lower()
                selected_option_id = None
            else:
                selected = next((o for o in question.options if o.id == ans.selected_option_id), None)
                your_answer = selected.option_text if selected else None
                is_correct = bool(selected and selected.is_correct)
                selected_option_id = selected.id if selected else None

            await self.repo.add_answer(attempt.id, question.id, selected_option_id, is_correct)
            if is_correct:
                correct_count += 1

            results.append(
                AnswerResult(
                    question_id=question.id,
                    question_text=question.question_text,
                    is_correct=is_correct,
                    your_answer=your_answer,
                    correct_answer=correct_option.option_text if correct_option else None,
                    explanation=question.explanation,
                )
            )

        total = len(quiz.questions)
        percentage = round((correct_count / total) * 100, 2) if total else 0.0
        await self.repo.complete_attempt(attempt, score=correct_count, percentage=percentage)

        return QuizAttemptResult(
            attempt_id=attempt.id,
            score=correct_count,
            percentage=percentage,
            total_questions=total,
            correct_count=correct_count,
            results=results,
        )
