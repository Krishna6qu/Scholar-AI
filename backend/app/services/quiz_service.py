import uuid
from typing import Any

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


def _extract_question_list(parsed: Any) -> list[dict]:
    """Tolerantly extract question items from any JSON structure returned by the model."""
    if isinstance(parsed, list):
        return [q for q in parsed if isinstance(q, dict)]
    if not isinstance(parsed, dict):
        return []

    # Check common keys
    for key in ("questions", "quiz", "items", "mcqs", "cards", "data", "results"):
        val = parsed.get(key)
        if isinstance(val, list):
            return [q for q in val if isinstance(q, dict)]
        if isinstance(val, dict):
            nested = val.get("questions") or val.get("items")
            if isinstance(nested, list):
                return [q for q in nested if isinstance(q, dict)]

    # Check numbered question dicts: {"1": {...}, "2": {...}}
    numbered = []
    for _, v in parsed.items():
        if isinstance(v, dict) and any(f in v for f in ("question_text", "question", "options", "prompt")):
            numbered.append(v)
    if numbered:
        return numbered

    # Check type groups: {"mcq": [...], "true_false": [...]}
    type_grouped = []
    for k in ("mcq", "true_false", "short_answer", "multiple_choice"):
        val = parsed.get(k)
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict):
                    if "type" not in item:
                        item["type"] = k
                    type_grouped.append(item)
    if type_grouped:
        return type_grouped

    return []


def _build_prompt(data: QuizGenerateRequest, breakdown: dict) -> str:
    total_q = data.total_questions
    type_lines = []
    for qtype, count in breakdown.items():
        label = {"mcq": "multiple-choice", "true_false": "true/false", "short_answer": "short-answer"}[qtype]
        type_lines.append(f"- {count} {label} question(s)")

    hint_instruction = (
        'For each question, provide a short, non-giveaway "hint" string that nudges the student without revealing the answer.'
        if data.hints_enabled
        else 'Set "hint" to null for all questions.'
    )

    sample_items = []
    if "mcq" in breakdown or data.question_type == "mcq":
        sample_items.append("""    {
      "type": "mcq",
      "question_text": "Clear question prompt?",
      "hint": "Brief hint or null",
      "explanation": "Concise 1-2 sentence explanation of the correct answer.",
      "options": [
        {"text": "Correct choice", "is_correct": true},
        {"text": "Plausible distractor 1", "is_correct": false},
        {"text": "Plausible distractor 2", "is_correct": false},
        {"text": "Plausible distractor 3", "is_correct": false}
      ]
    }""")
    if "true_false" in breakdown or data.question_type == "true_false":
        sample_items.append("""    {
      "type": "true_false",
      "question_text": "Clear statement to evaluate as true or false?",
      "hint": "Brief hint or null",
      "explanation": "Concise explanation of true or false.",
      "options": [
        {"text": "True", "is_correct": true},
        {"text": "False", "is_correct": false}
      ]
    }""")
    if "short_answer" in breakdown or data.question_type == "short_answer":
        sample_items.append("""    {
      "type": "short_answer",
      "question_text": "Clear short-answer question prompt?",
      "hint": "Brief hint or null",
      "explanation": "Concise explanation of concept.",
      "expected_answer": "Concise Answer Phrase"
    }""")

    sample_block = ",\n".join(sample_items)

    return f"""You are a master academic assessment engine for ScholarAI.
Generate a comprehensive, rigorous quiz on the topic: "{data.topic}".

DIFFICULTY LEVEL: {data.difficulty} — {DIFFICULTY_GUIDANCE.get(data.difficulty, "Standard difficulty")}

MANDATORY QUESTION COUNT:
You MUST generate EXACTLY {total_q} questions.
The "questions" JSON array MUST contain EXACTLY {total_q} complete question objects.
Do NOT stop early. Do NOT generate only 1, 2, or 3 questions. Generate all {total_q} questions.

QUESTION TYPE BREAKDOWN:
{chr(10).join(type_lines)}

RULES:
1. "mcq": Exactly 4 options in "options". Exactly one option with "is_correct": true, and three with "is_correct": false.
2. "true_false": Exactly 2 options ("True" and "False") in "options". Exactly one option with "is_correct": true, and one with "is_correct": false.
3. "short_answer": No "options" array. Instead include a concise "expected_answer" string.
4. {hint_instruction}
5. Every question MUST include a concise 1-2 sentence "explanation" detailing why the correct answer is right.

Respond ONLY with valid JSON (no markdown fences, no preamble, no commentary):
{{
  "questions": [
{sample_block}
    // Continue generating until there are EXACTLY {total_q} complete question objects in this array.
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
        target_count = data.total_questions

        questions: list[dict] = []
        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
                max_tokens=5000,
            )
            parsed = extract_json(response.choices[0].message.content)
            questions = _extract_question_list(parsed)

            # If the model returned fewer questions than requested, request completion of the remainder
            if len(questions) < target_count:
                needed = target_count - len(questions)
                followup_prompt = (
                    f"{prompt}\n\nIMPORTANT: The previous output only contained {len(questions)} questions. "
                    f"Please generate the remaining {needed} questions on '{data.topic}' so that the total is {target_count}. "
                    f"Return ONLY the valid JSON with a 'questions' array containing {needed} new questions."
                )
                followup_resp = await acompletion_with_retry(
                    model=model,
                    messages=[{"role": "user", "content": followup_prompt}],
                    api_key=resolve_api_key(model),
                    max_tokens=4000,
                )
                followup_parsed = extract_json(followup_resp.choices[0].message.content)
                more_questions = _extract_question_list(followup_parsed)
                questions.extend(more_questions)

        except Exception as e:
            status_code, message = ai_error_response(e, "generate the quiz")
            raise HTTPException(status_code, message)

        if not questions:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return any questions. Please try again.")

        # Cap to exact target count
        final_questions = questions[:target_count]

        # Prepare normalized questions and options data
        prepared_questions: list[dict] = []
        for order, q in enumerate(final_questions):
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

            parsed_opts: list[tuple[str, bool]] = []
            if q_type in ("mcq", "true_false"):
                opts = q.get("options") or q.get("choices") or []
                for opt in opts:
                    if isinstance(opt, dict):
                        text = str(opt.get("text") or opt.get("option") or opt.get("value") or "").strip()
                        is_corr = bool(opt.get("is_correct") or opt.get("isCorrect") or opt.get("correct", False))
                    else:
                        text = str(opt).strip()
                        is_corr = False
                    if text:
                        parsed_opts.append((text, is_corr))

                if q_type == "true_false" and not parsed_opts:
                    expected = str(q.get("expected_answer") or q.get("answer") or "true").strip().lower()
                    is_true = "t" in expected
                    parsed_opts = [("True", is_true), ("False", not is_true)]

                # Guarantee at least one correct option
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
            else:  # short_answer
                expected = str(
                    q.get("expected_answer") or q.get("answer") or q.get("correct_answer") or "Answer"
                ).strip()
                parsed_opts = [(expected or "Answer", True)]

            prepared_questions.append({
                "question_text": q_text,
                "explanation": explanation,
                "hint": hint,
                "question_type": q_type,
                "options": parsed_opts,
            })

        # Save entire quiz with all questions and options in a single atomic transaction
        return await self.repo.create_full_quiz(
            owner_id=user_id,
            title=f"{data.topic.strip().title()} Quiz",
            difficulty=data.difficulty,
            total_questions=len(prepared_questions),
            time_limit_minutes=data.time_limit_minutes,
            hints_enabled=data.hints_enabled,
            questions_data=prepared_questions,
        )

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
