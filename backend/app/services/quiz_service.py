import re
import uuid
from typing import Any

from fastapi import HTTPException, status
from loguru import logger
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


def _extract_questions_from_raw_text(text: str) -> list[dict]:
    """Fallback extractor if the AI returned questions in raw text or markdown format."""
    questions: list[dict] = []
    # Split by common question headings: "1.", "Question 1:", "## 1", etc.
    raw_blocks = re.split(r"(?:\n\s*(?:(?:Question|Q)\s*\d+[:.]|\d+[\.)])\s+)", "\n" + text)
    for block in raw_blocks:
        block = block.strip()
        if not block or len(block) < 15:
            continue
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        if not lines:
            continue
        q_text = lines[0]
        options: list[dict] = []
        explanation = ""
        hint = None
        answer_text = ""

        for line in lines[1:]:
            opt_match = re.match(r"^([A-Da-d])[\)\.]\s*(.+)$", line)
            if opt_match:
                options.append({
                    "text": opt_match.group(2).strip(),
                    "is_correct": False,
                    "letter": opt_match.group(1).upper(),
                })
                continue
            ans_match = re.match(r"^(?:Correct\s+)?Answer\s*[:\-]\s*(.+)$", line, re.I)
            if ans_match:
                answer_text = ans_match.group(1).strip()
                continue
            exp_match = re.match(r"^Explanation\s*[:\-]\s*(.+)$", line, re.I)
            if exp_match:
                explanation = exp_match.group(1).strip()
                continue
            hint_match = re.match(r"^Hint\s*[:\-]\s*(.+)$", line, re.I)
            if hint_match:
                hint = hint_match.group(1).strip()

        if options:
            matched = False
            for opt in options:
                if answer_text and (opt["letter"] == answer_text.upper() or opt["text"].lower() == answer_text.lower()):
                    opt["is_correct"] = True
                    matched = True
                    break
            if not matched and options:
                options[0]["is_correct"] = True
            questions.append({
                "type": "mcq",
                "question_text": q_text,
                "hint": hint,
                "explanation": explanation or None,
                "options": [{"text": o["text"], "is_correct": o["is_correct"]} for o in options],
            })
    return questions


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
        label = {"mcq": "multiple-choice", "true_false": "true/false", "short_answer": "short-answer"}.get(qtype, qtype)
        type_lines.append(f"- {count} {label} question(s)")

    hint_instruction = (
        'For each question, provide a short, non-giveaway "hint" string (under 15 words) that nudges the student.'
        if data.hints_enabled
        else 'Set "hint" to null for all questions.'
    )

    return f"""You are a master academic assessment engine for ScholarAI.
Generate a comprehensive, high-quality quiz on the topic: "{data.topic}".

DIFFICULTY LEVEL: {data.difficulty} — {DIFFICULTY_GUIDANCE.get(data.difficulty, "Standard difficulty")}

STRICT REQUIREMENT - GENERATE EXACTLY {total_q} QUESTIONS:
The "questions" JSON array MUST contain EXACTLY {total_q} questions.
Do NOT stop early. Do NOT output only 1, 2, or 3 questions. Generate all {total_q} questions.

QUESTION TYPE BREAKDOWN:
{chr(10).join(type_lines)}

FIELD SPECIFICATIONS:
- "type": "mcq" | "true_false" | "short_answer"
- "question_text": Clear, rigorous question prompt
- {hint_instruction}
- "explanation": Exactly 1 concise sentence explaining why the answer is correct
- For "mcq": "options" array with exactly 4 choices: [{{"text": "...", "is_correct": true}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}]
- For "true_false": "options" array with exactly 2 choices: [{{"text": "True", "is_correct": true/false}}, {{"text": "False", "is_correct": false/true}}]
- For "short_answer": "expected_answer" string (no options array)

Return ONLY a valid JSON object without markdown fences, commentary, or comments:
{{
  "questions": [
    {{
      "type": "mcq",
      "question_text": "First question prompt?",
      "hint": "Brief hint or null",
      "explanation": "Brief explanation.",
      "options": [
        {{"text": "Correct choice", "is_correct": true}},
        {{"text": "Plausible distractor 1", "is_correct": false}},
        {{"text": "Plausible distractor 2", "is_correct": false}},
        {{"text": "Plausible distractor 3", "is_correct": false}}
      ]
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
                "Daily limit is reached. Please wait 5 hours to use it again.",
            )

        breakdown = data.mix_breakdown or {data.question_type: data.total_questions}
        prompt = _build_prompt(data, breakdown)
        model = settings.DEFAULT_AI_MODEL
        target_count = data.total_questions

        # Allocate ample tokens so 10+ questions never truncate mid-JSON
        max_tokens_budget = min(4096, max(2600, target_count * 280))

        questions: list[dict] = []
        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
                max_tokens=max_tokens_budget,
            )
            raw_content = response.choices[0].message.content or ""
            try:
                parsed = extract_json(raw_content)
                questions = _extract_question_list(parsed)
            except Exception:
                questions = []

            # If JSON extraction did not find questions, attempt raw text extraction
            if not questions:
                questions = _extract_questions_from_raw_text(raw_content)

            # If the model returned fewer questions than requested, attempt one fast completion
            if len(questions) < target_count:
                needed = target_count - len(questions)
                followup_prompt = (
                    f"Generate {needed} additional distinct {data.difficulty} {data.question_type} quiz questions on '{data.topic}'. "
                    f"Do not repeat previous concepts. Return ONLY a valid JSON object: {{\"questions\": [...]}} containing {needed} complete question objects."
                )
                try:
                    followup_resp = await acompletion_with_retry(
                        model=model,
                        messages=[{"role": "user", "content": followup_prompt}],
                        api_key=resolve_api_key(model),
                        max_tokens=min(2500, max(1000, needed * 250)),
                    )
                    followup_raw = followup_resp.choices[0].message.content or ""
                    try:
                        followup_parsed = extract_json(followup_raw)
                        more_questions = _extract_question_list(followup_parsed)
                    except Exception:
                        more_questions = _extract_questions_from_raw_text(followup_raw)
                    questions.extend(more_questions)
                except Exception as followup_err:
                    logger.warning(
                        f"Quiz followup generation had non-fatal error (continuing with {len(questions)} questions): {followup_err}"
                    )

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
                if isinstance(opts, dict):
                    # e.g. {"A": "Choice A", "B": "Choice B"} or {"A": {"text": "...", "is_correct": True}}
                    for k, v in opts.items():
                        if isinstance(v, dict):
                            otext = str(v.get("text") or v.get("option") or v.get("value") or "").strip()
                            is_corr = bool(v.get("is_correct") or v.get("isCorrect") or v.get("correct", False))
                        else:
                            otext = str(v).strip()
                            ca = str(q.get("correct_answer") or q.get("answer") or "").strip().lower()
                            is_corr = bool(ca and (ca == str(k).lower() or ca == otext.lower()))
                        if otext:
                            parsed_opts.append((otext, is_corr))
                elif isinstance(opts, list):
                    for opt in opts:
                        if isinstance(opt, dict):
                            otext = str(opt.get("text") or opt.get("option") or opt.get("value") or "").strip()
                            is_corr = bool(opt.get("is_correct") or opt.get("isCorrect") or opt.get("correct", False))
                        else:
                            otext = str(opt).strip()
                            ca = str(q.get("correct_answer") or q.get("answer") or "").strip().lower()
                            is_corr = bool(ca and (ca == otext.lower() or (len(ca) == 1 and otext.lower().startswith(ca + ")"))))
                        if otext:
                            parsed_opts.append((otext, is_corr))

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

                # Guarantee at least 2 options for multiple-choice questions
                if q_type == "mcq" and len(parsed_opts) < 2:
                    if len(parsed_opts) == 1:
                        parsed_opts.append(("None of the above", False))
                    else:
                        parsed_opts = [("Option A", True), ("Option B", False)]
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
