import pytest
from app.core.ai_utils import extract_json, _sanitize_json_escapes, ai_error_response


def test_sanitize_json_escapes():
    # Valid escapes should remain unchanged
    valid = r'{"escapes": "\"hello\"\n\t\r\\\/ \u0041"}'
    assert _sanitize_json_escapes(valid) == valid

    # Invalid escapes like LaTeX math symbols or file paths should be safely escaped
    raw_latex = r'{"latex": "\psi + \lambda = \hbar \sqrt{x}"}'
    sanitized = _sanitize_json_escapes(raw_latex)
    assert r"\\psi" in sanitized
    assert r"\\lambda" in sanitized
    assert r"\\hbar" in sanitized
    assert r"\\sqrt" in sanitized


def test_extract_json_with_latex_and_markdown():
    raw = r"""Here is your revision material:
```json
{
  "title": "Quantum Mechanics",
  "content": "The wavefunction \psi(x) represents probability amplitude. De Broglie wavelength is \lambda = \frac{h}{p}."
}
```
Hope this helps!"""
    data = extract_json(raw)
    assert data["title"] == "Quantum Mechanics"
    assert "wavefunction" in data["content"]
    assert r"\psi" in data["content"]


def test_extract_json_truncated():
    raw_truncated = '{"title": "Truncated Topic", "content": "This content ends abruptly'
    data = extract_json(raw_truncated)
    assert data["title"] == "Truncated Topic"
    assert "abruptly" in data["content"]


def test_ai_error_response_credit_limit():
    exc = Exception("OpenrouterException: This request requires more credits, or fewer max_tokens. You requested up to 5000 tokens, but can only afford 2000.")
    status_code, msg = ai_error_response(exc, "generate notes")
    assert status_code == 402
    assert "credit limit reached" in msg
