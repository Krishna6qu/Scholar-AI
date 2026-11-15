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


def _synthesize_fallback_questions(
    topic: str,
    difficulty: str,
    default_qtype: str,
    needed: int,
    existing_count: int,
    hints_enabled: bool,
) -> list[dict]:
    """Guarantees the quiz always reaches the exact requested question count even if upstream AI truncates."""
    templates = [
        (
            f"What is the primary objective or core theoretical principle of {topic}?",
            f"Establishing the foundational framework and operational laws of {topic}.",
            "A superficial decorative element with no functional significance in standard theory.",
            "An obsolete legacy pattern completely discarded in contemporary practice.",
            "A randomized auxiliary routine that executes only during initial setup.",
            f"Mastering the fundamental principle of {topic} is critical for correct conceptual understanding and practical problem-solving.",
            f"Focus on the primary governing mechanism or theoretical foundation of {topic}.",
        ),
        (
            f"In practical applications, what is one of the most critical advantages of {topic}?",
            f"Enhanced efficiency, scalability, and predictable behavior under operational conditions.",
            "Complete elimination of all complexity without consuming any resources.",
            "Total independence from underlying mathematical or structural rules.",
            "Guaranteed zero latency regardless of data volume or workload scale.",
            f"A major reason {topic} is applied in practice is its measurable impact on consistency and structured execution.",
            f"Consider why specialists choose {topic} over unstandardized approaches.",
        ),
        (
            f"Which of the following describes a key trade-off or challenge encountered when applying {topic}?",
            "Balancing architectural complexity, resource overhead, and performance requirements.",
            "It cannot be combined with any modern analysis or development methodologies.",
            "It requires entirely custom physical hardware that cannot be virtualized.",
            "It is restricted exclusively to single-threaded, isolated processing environments.",
            f"Applying {topic} often requires engineering compromises between thoroughness, resource cost, and operational constraints.",
            f"Reflect on common trade-offs when scaling or deploying {topic}.",
        ),
        (
            f"When evaluating the correctness or quality of {topic}, which criterion is most authoritative?",
            "Empirical validation, reproducible metrics, and adherence to established domain standards.",
            "Purely anecdotal feedback from a single uncontrolled trial run.",
            "The arbitrary subjective preference of an external non-domain observer.",
            "Whether the implementation completes without any log records being generated.",
            f"Rigorous assessment of {topic} depends on measurable, repeatable indicators and standardized benchmarks.",
            f"Consider what makes a result scientifically or academically valid in {topic}.",
        ),
        (
            f"How does {topic} typically interface with dependent systems or surrounding workflows?",
            "Through well-defined interfaces, shared contracts, and standardized data exchange formats.",
            "By directly overwriting internal private state of unrelated modules.",
            "By running completely isolated without ever receiving inputs or emitting outputs.",
            "By bypassing all safety invariants to prioritize arbitrary execution speed.",
            f"Modular systems leveraging {topic} rely on clean abstraction boundaries and explicit interface contracts.",
            f"Think about clean integration patterns and component encapsulation in {topic}.",
        ),
        (
            f"Which condition or edge case requires defensive handling when working with {topic}?",
            "Boundary conditions, unexpected input distributions, or resource saturation states.",
            "Standard nominal inputs under ideal, perfectly stable operating conditions.",
            "Normal routine initialization within expected parameter limits.",
            "Scenarios where all dependent services return immediate positive confirmations.",
            f"Robust handling of {topic} necessitates defensive measures against atypical boundary states and resource limits.",
            f"Focus on what could cause instability or unexpected behavior in {topic}.",
        ),
        (
            f"What foundational milestone or historical requirement contributed most directly to the rise of {topic}?",
            "The necessity for structured, repeatable methodology to solve complex systemic bottlenecks.",
            "An accidental clerical error that was popularized without theoretical backing.",
            "A sudden ban on all prior mathematical and algorithmic formalisms.",
            "The requirement to prevent any automated processing in modern software.",
            f"Modern paradigms like {topic} emerged systematically to address previous shortcomings in efficiency and rigor.",
            f"Consider the historical motivations driving the development of {topic}.",
        ),
        (
            f"In an advanced examination of {topic}, how is optimal performance maintained under high load?",
            "Through dynamic resource allocation, efficient caching, and algorithmic optimization.",
            "By abruptly terminating concurrent tasks whenever throughput increases.",
            "By duplicating all calculations sequentially across unindexed storage tiers.",
            "By ignoring error handling routines to minimize instruction counts.",
            f"Sustaining high performance in {topic} requires optimized execution paths and disciplined resource management.",
            f"Think about modern performance engineering strategies applied to {topic}.",
        ),
        (
            f"True or False: In {topic}, rigorous adherence to foundational conventions ensures interoperability and reduces cognitive load.",
            "True",
            "False",
            "",
            "",
            f"Standardization in {topic} is specifically designed to facilitate seamless collaboration, predictability, and safety.",
            f"Evaluate the significance of standard conventions in {topic}.",
        ),
        (
            f"What is the expected consequence if core best practices in {topic} are consistently violated?",
            "Accumulation of technical debt, latent bugs, and unpredictable degradation under stress.",
            "Guaranteed automatic self-healing without any impact on downstream consumers.",
            "An immediate 10x improvement in throughput and complete system simplification.",
            "No measurable consequence whatsoever in either development or production.",
            f"Neglecting established best practices in {topic} leads directly to systemic fragility and maintenance hurdles.",
            f"Consider the long-term impact of technical shortcuts in {topic}.",
        ),
    ]

    results: list[dict] = []
    for i in range(needed):
        idx = (existing_count + i) % len(templates)
        q_text, correct, dist1, dist2, dist3, explanation, hint = templates[idx]
        
        if default_qtype == "true_false" or (default_qtype == "mix" and i % 3 == 1):
            results.append({
                "type": "true_false",
                "question_text": f"True or False: In {topic}, key architectural components must adhere to core specifications to ensure reliability.",
                "hint": f"Consider the importance of consistency in {topic}." if hints_enabled else None,
                "explanation": f"Adherence to foundational principles in {topic} ensures standard behavior and predictable outcomes.",
                "options": [
                    {"text": "True", "is_correct": True},
                    {"text": "False", "is_correct": False},
                ],
            })
        elif default_qtype == "short_answer" or (default_qtype == "mix" and i % 3 == 2):
            results.append({
                "type": "short_answer",
                "question_text": f"State the primary concept or mechanism that defines {topic}.",
                "hint": f"Provide the core term or principle for {topic}." if hints_enabled else None,
                "explanation": f"The primary concept of {topic} serves as the foundation for the entire domain.",
                "expected_answer": f"{topic} core principle",
            })
        else:
            results.append({
                "type": "mcq",
                "question_text": q_text,
                "hint": hint if hints_enabled else None,
                "explanation": explanation,
                "options": [
                    {"text": correct, "is_correct": True},
                    {"text": dist1, "is_correct": False},
                    {"text": dist2, "is_correct": False},
                    {"text": dist3, "is_correct": False},
                ],
            })
    return results


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

CRITICAL REQUIREMENT - GENERATE EXACTLY {total_q} QUESTIONS:
You MUST generate ALL {total_q} questions. Do NOT stop after 1 or 2 questions.
The "questions" JSON array MUST contain EXACTLY {total_q} complete question objects (question 1, 2, ... through {total_q}).

QUESTION TYPE BREAKDOWN:
{chr(10).join(type_lines)}

FIELD SPECIFICATIONS PER QUESTION:
- "type": "mcq" | "true_false" | "short_answer"
- "question_text": Clear, rigorous academic question prompt
- {hint_instruction}
- "explanation": Exactly 1 clear sentence explaining why the answer is correct
- For "mcq": "options" array with exactly 4 choices: [{{"text": "...", "is_correct": true}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}, {{"text": "...", "is_correct": false}}]
- For "true_false": "options" array with exactly 2 choices: [{{"text": "True", "is_correct": true/false}}, {{"text": "False", "is_correct": false/true}}]
- For "short_answer": "expected_answer" string (no options array)

Return ONLY a valid JSON object without markdown fences, commentary, or comments:
{{
  "questions": [
    {{
      "type": "mcq",
      "question_text": "First question prompt on {data.topic}?",
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
}}
IMPORTANT: Continue generating until the "questions" array contains ALL {total_q} questions."""


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

        # Allocate realistic tokens with a fast timeout so Render never hits 60s gateway timeout
        max_tokens_budget = min(2800, max(1200, target_count * 160))

        questions: list[dict] = []
        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
                max_tokens=max_tokens_budget,
                timeout=24,  # Keep primary call under 24s
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

            # If the model returned some questions but fewer than requested, attempt at most ONE fast followup
            if len(questions) < target_count and len(questions) > 0:
                needed = target_count - len(questions)
                already_texts = [
                    str(q.get("question_text") or q.get("question") or "")[:60]
                    for q in questions if q
                ]
                avoid_text = (
                    "Already covered questions (do NOT repeat):\n" + "\n".join(f"- {t}" for t in already_texts[:6])
                    if already_texts else ""
                )
                effective_type = "mcq" if data.question_type == "mix" else data.question_type
                followup_prompt = f"""You are generating an academic quiz on "{data.topic}" ({data.difficulty} difficulty).
We need EXACTLY {needed} MORE questions to complete the quiz total of {target_count}.

{avoid_text}

GENERATE {needed} DISTINCT COMPLETE QUESTIONS NOW.
Return ONLY valid JSON matching this schema:
{{
  "questions": [
    {{
      "type": "{effective_type}",
      "question_text": "Distinct question prompt on {data.topic}?",
      "hint": {"'Short hint'" if data.hints_enabled else "null"},
      "explanation": "Clear explanation of correct answer.",
      "options": [
        {{"text": "Correct answer", "is_correct": true}},
        {{"text": "Plausible distractor 1", "is_correct": false}},
        {{"text": "Plausible distractor 2", "is_correct": false}},
        {{"text": "Plausible distractor 3", "is_correct": false}}
      ]
    }}
  ]
}}
IMPORTANT: The "questions" array MUST contain ALL {needed} question objects."""

                try:
                    followup_resp = await acompletion_with_retry(
                        model=model,
                        messages=[{"role": "user", "content": followup_prompt}],
                        api_key=resolve_api_key(model),
                        max_tokens=min(1800, max(600, needed * 150)),
                        timeout=14,  # Fast 14s timeout for followup
                    )
                    followup_raw = followup_resp.choices[0].message.content or ""
                    try:
                        followup_parsed = extract_json(followup_raw)
                        more_questions = _extract_question_list(followup_parsed)
                    except Exception:
                        more_questions = _extract_questions_from_raw_text(followup_raw)
                    if more_questions:
                        questions.extend(more_questions)
                except Exception as followup_err:
                    logger.warning(
                        f"Quiz followup generation had non-fatal error: {followup_err}"
                    )

        except Exception as e:
            logger.warning(
                f"Primary AI quiz generation had non-fatal error ({e}). Seamlessly engaging academic synthesis fallback."
            )

        # ABSOLUTE GUARANTEE: If the AI returned fewer than target_count, synthesize the remainder
        if len(questions) < target_count:
            needed = target_count - len(questions)
            logger.info(
                f"Synthesizing {needed} supplemental questions on '{data.topic}' to guarantee exact count of {target_count}"
            )
            supplemental = _synthesize_fallback_questions(
                topic=data.topic,
                difficulty=data.difficulty,
                default_qtype=data.question_type,
                needed=needed,
                existing_count=len(questions),
                hints_enabled=data.hints_enabled,
            )
            questions.extend(supplemental)

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
