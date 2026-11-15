import pytest
from app.core.ai_utils import extract_json
from app.services.quiz_service import _build_prompt
from app.schemas.quiz import QuizGenerateRequest


def test_quiz_build_prompt():
    req = QuizGenerateRequest(
        topic="Machine Learning Basics",
        question_type="mcq",
        total_questions=3,
        difficulty="medium",
        time_limit_minutes=10,
        hints_enabled=True,
    )
    prompt = _build_prompt(req, {"mcq": 3})
    assert "Machine Learning Basics" in prompt
    assert "3 multiple-choice question(s)" in prompt
    assert "short, non-giveaway" in prompt
    assert "GENERATE EXACTLY 3 QUESTIONS" in prompt


def test_quiz_extract_json_markdown_fences():
    raw_ai_response = """Here is the quiz you requested:
```json
{
  "questions": [
    {
      "type": "mcq",
      "question_text": "What is overfitting?",
      "hint": "High variance on test data.",
      "explanation": "Overfitting happens when a model learns noise.",
      "options": [
        {"text": "Model fits training data too well", "is_correct": true},
        {"text": "Model underperforms on training data", "is_correct": false}
      ]
    }
  ]
}
```
Hope this is helpful!"""

    parsed = extract_json(raw_ai_response)
    assert "questions" in parsed
    assert len(parsed["questions"]) == 1
    assert parsed["questions"][0]["type"] == "mcq"
    assert parsed["questions"][0]["question_text"] == "What is overfitting?"
    assert len(parsed["questions"][0]["options"]) == 2
    assert parsed["questions"][0]["options"][0]["is_correct"] is True


def test_quiz_extract_from_raw_text():
    from app.services.quiz_service import _extract_questions_from_raw_text

    raw_text = """
1. What does CPU stand for?
A) Central Processing Unit
B) Computer Personal Unit
C) Central Performance Utility
D) Core Processing Unit
Answer: A
Explanation: CPU stands for Central Processing Unit.

2. Which memory is volatile?
A) ROM
B) RAM
C) Hard Drive
D) Flash Drive
Answer: B
Explanation: RAM loses its state when power is lost.
"""
    extracted = _extract_questions_from_raw_text(raw_text)
    assert len(extracted) == 2
    assert "CPU" in extracted[0]["question_text"]
    assert len(extracted[0]["options"]) == 4
    assert extracted[0]["options"][0]["is_correct"] is True
    assert extracted[0]["options"][1]["is_correct"] is False
    assert "volatile" in extracted[1]["question_text"]
    assert extracted[1]["options"][1]["text"] == "RAM"
    assert extracted[1]["options"][1]["is_correct"] is True


def test_quiz_synthesize_fallback_questions():
    from app.services.quiz_service import _synthesize_fallback_questions

    synthesized = _synthesize_fallback_questions(
        topic="Operating Systems",
        difficulty="medium",
        default_qtype="mcq",
        needed=8,
        existing_count=2,
        hints_enabled=True,
    )
    assert len(synthesized) == 8
    for q in synthesized:
        assert "Operating Systems" in q["question_text"]
        assert len(q["options"]) >= 2
        assert any(opt["is_correct"] for opt in q["options"])
        assert q["explanation"] is not None
        assert q["hint"] is not None
