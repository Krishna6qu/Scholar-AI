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
    High-performance wrapper around litellm.acompletion with automatic model failover,
    rapid transient retry, and adaptive token limit recovery.
    """
    if "max_tokens" not in kwargs:
        kwargs["max_tokens"] = 2200

    # Build prioritized candidate model chain
    candidate_models = [model]
    if model.startswith("openrouter/"):
        for fallback in (
            "openrouter/google/gemini-2.5-flash",
            "openrouter/openai/gpt-4o-mini",
            "openrouter/meta-llama/llama-3.1-8b-instruct",
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
                err_str = str(e)

                # Intercept OpenRouter credit cap error and adapt max_tokens dynamically
                if "fewer max_tokens" in err_str or "can only afford" in err_str or "402" in err_str:
                    match = re.search(r"can only afford (\d+)", err_str)
                    affordable = int(match.group(1)) - 100 if match else None
                    current_max = kwargs.get("max_tokens", 2200)
                    new_max = max(600, affordable if affordable else int(current_max * 0.6))
                    logger.warning(
                        f"OpenRouter credit cap hit. Automatically adapting max_tokens from {current_max} to {new_max} and retrying."
                    )
                    kwargs["max_tokens"] = new_max
                    try:
                        return await litellm.acompletion(
                            model=current_model, messages=messages, api_key=model_key, **kwargs
                        )
                    except Exception as inner_e:
                        last_exc = inner_e

                logger.warning(f"AI provider failed on '{current_model}': {e}. Failing over to next model.")
                break

    assert last_exc is not None
    raise last_exc


def _sanitize_json_escapes(s: str) -> str:
    """Escapes invalid backslashes (e.g. from LaTeX formulas, unescaped characters, or markdown)
    so standard JSON parsers do not fail with JSONDecodeError: Invalid \\escape."""
    return re.sub(r'\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})', r'\\\\', s)


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
        # Also try sanitizing escapes on repaired string
        sanitized = _sanitize_json_escapes(repaired)
        try:
            return json.loads(sanitized, strict=False)
        except Exception:
            return None


def _safe_json_loads(text: str) -> dict | None:
    """Multi-stage robust JSON decoder that handles raw text, invalid escapes, and truncation."""
    try:
        return json.loads(text, strict=False)
    except Exception:
        sanitized = _sanitize_json_escapes(text)
        try:
            return json.loads(sanitized, strict=False)
        except Exception:
            repaired = _repair_json(sanitized)
            if repaired is not None:
                return repaired
            return None


def extract_json(raw: str) -> dict:
    """Extract JSON from raw AI response, handling markdown code fences,
    introductory/trailing text, invalid backslash escapes (LaTeX/markdown),
    unescaped control characters, and truncated tokens."""
    stripped = raw.strip()
    # 1. Try finding JSON inside markdown code fence
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", stripped)
    if fence_match:
        res = _safe_json_loads(fence_match.group(1).strip())
        if res is not None:
            return res

    # 2. Try finding outermost object or array
    brace_match = re.search(r"(\{[\s\S]*\}|\[[\s\S]*\])", stripped)
    if brace_match:
        res = _safe_json_loads(brace_match.group(1).strip())
        if res is not None:
            return res

    # 3. Direct parse with basic cleanup and repair fallback
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", stripped)
    res = _safe_json_loads(cleaned)
    if res is not None:
        return res

    # Fallback to json.loads to raise original decode error if completely unparseable
    return json.loads(cleaned, strict=False)


def ai_error_response(e: Exception, what: str) -> tuple[int, str]:
    """Builds a (status_code, message) pair for an AI-call failure."""
    err_str = str(e).lower()
    if "402" in err_str or "credit" in err_str or "fewer max_tokens" in err_str:
        return (
            402,
            "AI provider credit limit reached. Please visit https://openrouter.ai/settings/credits "
            "to check your balance or add credits.",
        )
    if isinstance(e, RETRYABLE_EXCEPTIONS):
        return (
            503,
            f"The AI provider is temporarily unavailable after several retries — this is "
            f"usually a brief spike in demand on their end. Please try again in a moment. ({e})",
        )
    return (502, f"The AI provider could not {what}: {e}")
