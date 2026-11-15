import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import acompletion_with_retry, ai_error_response, extract_json, resolve_api_key
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

Difficulty level: {data.difficulty} — {DIFFICULTY_GUIDANCE.get(data.difficulty, "Standard difficulty")}

Generate exactly this breakdown of question types:
{chr(10).join(type_lines)}

Rules per question type:
1. "mcq": Exactly 4 options in an "options" list. Exactly ONE option must have "is_correct": true, and the other 3 must have "is_correct": false.
2. "true_false": Exactly 2 options ("True" and "False") in an "options" list. Exactly ONE option must have "is_correct": true, and the other "is_correct": false.
3. "short_answer": Do NOT provide an "options" list. Instead, include an "expected_answer" string representing the concise correct answer.

{hint_instruction}
Every question must include an "explanation" string detailing why the correct answer is right.

Respond with ONLY valid JSON (no markdown fences, no explanatory text outside the JSON), matching this JSON structure:
{{
  "questions": [
    {{
      "type": "mcq",
      "question_text": "Sample multiple choice question text?",
      "hint": "Helpful hint here or null",
      "explanation": "Why this answer is correct.",
      "options": [
        {{"text": "Correct option", "is_correct": true}},
        {{"text": "Incorrect option 1", "is_correct": false}},
        {{"text": "Incorrect option 2", "is_correct": false}},
        {{"text": "Incorrect option 3", "is_correct": false}}
      ]
    }},
    {{
      "type": "true_false",
      "question_text": "Sample statement to evaluate as true or false?",
      "hint": "Helpful hint here or null",
      "explanation": "Explanation of true or false.",
      "options": [
        {{"text": "True", "is_correct": true}},
        {{"text": "False", "is_correct": false}}
      ]
    }},
    {{
      "type": "short_answer",
      "question_text": "Sample short answer question prompt?",
      "hint": "Helpful hint here or null",
      "explanation": "Explanation of concept.",
      "expected_answer": "Concise Answer"
    }}
  ]
}}"""


class QuizService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = QuizRepository(db)

    async def generate(self, user_id: uuid.UUID, data: QuizGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["quiz"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['quiz']} quizzes. Features resume after 5 hours.",
            )

        breakdown = data.mix_breakdown or {data.question_type: data.total_questions}
        prompt = _build_prompt(data, breakdown)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
                max_tokens=3000,
            )
            parsed = extract_json(response.choices[0].message.content)
        except Exception as e:
            status_code, message = ai_error_response(e, "generate the quiz")
            raise HTTPException(status_code, message)

        questions = []
        if isinstance(parsed, list):
            questions = parsed
        elif isinstance(parsed, dict):
            if isinstance(parsed.get("questions"), list):
                questions = parsed["questions"]
            elif isinstance(parsed.get("quiz"), dict) and isinstance(parsed["quiz"].get("questions"), list):
                questions = parsed["quiz"]["questions"]
            elif isinstance(parsed.get("items"), list):
                questions = parsed["items"]

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
            raw_type = str(q.get("type", "mcq")).lower().strip()
            if "true" in raw_type or "false" in raw_type:
                q_type = "true_false"
            elif "short" in raw_type:
                q_type = "short_answer"
            else:
                q_type = "mcq"

            q_text = str(
                q.get("question_text") or q.get("question") or q.get("prompt") or f"Question {order + 1}"
            ).strip()
            explanation = str(q.get("explanation") or "").strip() or None
            hint = str(q.get("hint") or "").strip() if data.hints_enabled else None
            if hint in ("None", "null", ""):
                hint = None

            question = await self.repo.add_question(
                quiz.id,
                q_text,
                explanation,
                order,
                hint,
                q_type,
            )

            if q_type in ("mcq", "true_false"):
                opts = q.get("options") or q.get("choices") or []
                parsed_opts: list[tuple[str, bool]] = []
                for opt in opts:
                    if isinstance(opt, dict):
                        text = str(opt.get("text") or opt.get("option") or opt.get("value") or "").strip()
                        is_corr = bool(opt.get("is_correct") or opt.get("isCorrect") or opt.get("correct", False))
                    else:
                        text = str(opt).strip()
                        is_corr = False
                    if text:
                        parsed_opts.append((text, is_corr))

                # Handle true/false default if empty options returned
                if q_type == "true_false" and not parsed_opts:
                    expected = str(q.get("expected_answer") or q.get("answer") or "true").strip().lower()
                    is_true = "t" in expected
                    parsed_opts = [("True", is_true), ("False", not is_true)]

                # Guarantee at least one option is marked correct
                if not any(is_corr for _, is_corr in parsed_opts) and parsed_opts:
                    ca = str(
                        q.get("correct_answer") or q.get("answer") or q.get("expected_answer") or ""
                    ).strip().lower()
                    matched = False
                    for idx, (otext, _) in enumerate(parsed_opts):
                        if ca and (ca == otext.lower() or ca == chr(65 + idx).lower()):
                            parsed_opts[idx] = (otext, True)
                            matched = True
                            break
                    if not matched:
                        parsed_opts[0] = (parsed_opts[0][0], True)

                for text, is_corr in parsed_opts:
                    await self.repo.add_option(question.id, text, is_corr)
            else:  # short_answer — store expected answer as the single "correct option"
                expected = str(
                    q.get("expected_answer") or q.get("answer") or q.get("correct_answer") or "Answer"
                ).strip()
                await self.repo.add_option(question.id, expected or "Answer", True)

        return quiz

    async def list_quizzes(self, user_id: uuid.UUID, limit: int = 50):
        return await self.repo.list_quizzes(user_id, limit)

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
