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
    assert "EXACTLY 3 questions" in prompt


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
