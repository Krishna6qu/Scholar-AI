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
    if model.startswith("openrouter/") or "luna" in model:
        return settings.OPENROUTER_API_KEY
    if model.startswith("gemini/") or model.startswith("vertex_ai/"):
        return settings.GEMINI_API_KEY
    if model.startswith("claude") or model.startswith("anthropic/"):
        return settings.ANTHROPIC_API_KEY
    if model.startswith("gpt") or model.startswith("openai/"):
        return settings.OPENAI_API_KEY
    return None


async def acompletion_with_retry(
    *, model: str, messages: list[dict], api_key: str | None, max_retries: int = 2, **kwargs
):
    """
    High-performance wrapper around litellm.acompletion with automatic model failover
    and rapid transient retry. Retries transient errors with low latency (<= 2s)
    and automatically falls back to secondary fast models if the primary provider blips.
    """
    if "max_tokens" not in kwargs:
        kwargs["max_tokens"] = 1500

    # Build prioritized candidate model chain
    candidate_models = [model]
    if model.startswith("openrouter/"):
        for fallback in (
            "openrouter/google/gemini-2.5-flash",
            "openrouter/openai/gpt-4o-mini",
            "openrouter/deepseek/deepseek-chat",
        ):
            if fallback not in candidate_models:
                candidate_models.append(fallback)

    last_exc: Exception | None = None
    for current_model in candidate_models:
        model_key = api_key or resolve_api_key(current_model)
        for attempt in range(max_retries):
            try:
                return await litellm.acompletion(model=current_model, messages=messages, api_key=model_key, **kwargs)
            except RETRYABLE_EXCEPTIONS as e:
                last_exc = e
                if attempt == max_retries - 1:
                    logger.warning(f"AI model '{current_model}' exhausted retries: {e}. Trying fallback if available.")
                    break

                # Quick backoff capped at 2.0s max so user requests never hang
                delay = min(0.8 + random.uniform(0.2, 0.6), 2.0)
                logger.info(
                    f"AI provider transient pause on '{current_model}' "
                    f"(attempt {attempt + 1}/{max_retries}), retrying in {delay:.1f}s"
                )
                await asyncio.sleep(delay)
            except Exception as e:
                last_exc = e
                logger.warning(f"AI provider failed on '{current_model}': {e}. Failing over to next model.")
                break

    assert last_exc is not None
    raise last_exc


def _repair_json(text: str) -> dict | None:
    """Attempts to gracefully repair and close a JSON string that was truncated by token limits."""
    start = text.find("{")
    if start == -1:
        start = text.find("[")
    if start == -1:
        return None
    s = text[start:].strip()

    stack = []
    in_string = False
    escape = False
    for ch in s:
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if not in_string:
            if ch == "{":
                stack.append("}")
            elif ch == "[":
                stack.append("]")
            elif ch in ("}", "]"):
                if stack and stack[-1] == ch:
                    stack.pop()

    repaired = s
    if in_string:
        repaired += '"'
    # Strip any trailing comma
    repaired = re.sub(r",\s*$", "", repaired)
    for closer in reversed(stack):
        repaired += closer

    try:
        return json.loads(repaired, strict=False)
    except Exception:
        return None


def extract_json(raw: str) -> dict:
    """Extract JSON from raw AI response, handling markdown code fences,
    introductory/trailing text, unescaped control characters, and truncated tokens."""
    stripped = raw.strip()
    # 1. Try finding JSON inside markdown code fence
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", stripped)
    if fence_match:
        content = fence_match.group(1).strip()
        try:
            return json.loads(content, strict=False)
        except Exception:
            repaired = _repair_json(content)
            if repaired is not None:
                return repaired

    # 2. Try finding outermost object or array
    brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", stripped)
    if brace_match:
        try:
            return json.loads(brace_match.group(1).strip(), strict=False)
        except Exception:
            repaired = _repair_json(brace_match.group(1).strip())
            if repaired is not None:
                return repaired

    # 3. Direct parse with basic cleanup and repair fallback
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", stripped)
    try:
        return json.loads(cleaned, strict=False)
    except Exception:
        repaired = _repair_json(cleaned)
        if repaired is not None:
            return repaired
        raise


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
