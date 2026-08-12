import json
import re

from app.core.config import settings


def resolve_api_key(model: str) -> str | None:
    if model.startswith("gemini/") or model.startswith("vertex_ai/"):
        return settings.GEMINI_API_KEY
    if model.startswith("claude") or model.startswith("anthropic/"):
        return settings.ANTHROPIC_API_KEY
    if model.startswith("gpt") or model.startswith("openai/"):
        return settings.OPENAI_API_KEY
    return None


def extract_json(raw: str) -> dict:
    """Models sometimes wrap JSON in markdown code fences despite instructions
    not to — strip those before parsing. strict=False also tolerates literal
    control characters (e.g. raw newlines) inside string values, which models
    occasionally produce in longer text fields like notes content."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return json.loads(cleaned, strict=False)
