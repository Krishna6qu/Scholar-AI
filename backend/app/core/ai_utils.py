import asyncio
import json
import random
import re

import litellm
from loguru import logger

from app.core.config import settings

# These are the transient, provider-side failure classes worth retrying —
# "the model is overloaded right now" or "the connection hiccuped", not
# "your API key is wrong" or "your request was malformed". Retrying the
# latter would just waste 3x the time before failing the same way anyway.
# Exported (not underscore-prefixed) so callers can also use it to tell a
# genuinely transient failure apart from a permanent one when writing the
# user-facing error message.
RETRYABLE_EXCEPTIONS = (
    litellm.ServiceUnavailableError,
    litellm.RateLimitError,
    litellm.Timeout,
    litellm.APIConnectionError,
    litellm.InternalServerError,
)


def resolve_api_key(model: str) -> str | None:
    if model.startswith("gemini/") or model.startswith("vertex_ai/"):
        return settings.GEMINI_API_KEY
    if model.startswith("claude") or model.startswith("anthropic/"):
        return settings.ANTHROPIC_API_KEY
    if model.startswith("gpt") or model.startswith("openai/"):
        return settings.OPENAI_API_KEY
    return None


async def acompletion_with_retry(
    *, model: str, messages: list[dict], api_key: str | None, max_retries: int = 3, **kwargs
):
    """
    Thin wrapper around litellm.acompletion that retries transient provider
    errors (503 "model overloaded", rate limits, timeouts, connection blips)
    with exponential backoff + jitter, instead of failing the user's request
    on the first hiccup. Every AI generation call in the app should go
    through this rather than calling litellm.acompletion directly — root
    cause of intermittent "high demand" / 503 failures users would otherwise
    see on every generation feature (chat, quiz, flashcards, notes, mind
    maps, roadmaps), since none of them previously retried at all.
    """
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        try:
            return await litellm.acompletion(model=model, messages=messages, api_key=api_key, **kwargs)
        except RETRYABLE_EXCEPTIONS as e:
            last_exc = e
            if attempt == max_retries - 1:
                break
            delay = (2**attempt) + random.uniform(0, 0.5)
            logger.warning(
                f"AI provider transient error on '{model}' "
                f"(attempt {attempt + 1}/{max_retries}), retrying in {delay:.1f}s: {e}"
            )
            await asyncio.sleep(delay)

    assert last_exc is not None
    raise last_exc


def extract_json(raw: str) -> dict:
    """Models sometimes wrap JSON in markdown code fences despite instructions
    not to — strip those before parsing. strict=False also tolerates literal
    control characters (e.g. raw newlines) inside string values, which models
    occasionally produce in longer text fields like notes content."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip())
    return json.loads(cleaned, strict=False)


def ai_error_response(e: Exception, what: str) -> tuple[int, str]:
    """Builds a (status_code, message) pair for an AI-call failure, after
    acompletion_with_retry has already exhausted its retries. Distinguishes
    a genuinely transient failure (still 503 after 3 attempts — tell the
    user it's worth trying again shortly) from a permanent one (bad request,
    auth, etc. — retrying again won't help, so don't imply it will)."""
    if isinstance(e, RETRYABLE_EXCEPTIONS):
        return (
            503,
            f"The AI provider is temporarily unavailable after several retries — this is "
            f"usually a brief spike in demand on their end. Please try again in a moment. ({e})",
        )
    return (502, f"The AI provider could not {what}: {e}")
