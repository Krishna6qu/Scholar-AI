"""
Central application configuration.

All environment-dependent values are read here, once, via pydantic-settings.
Nothing else in the codebase should call os.environ directly — import `settings`
from this module instead, so there is a single source of truth and Phase 11's
config validation has one place to check.
"""
import os
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "ScholarAI"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # --- Security ---
    SECRET_KEY: str = Field(..., description="Used to sign JWTs. Must be set in .env, never committed.")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    ALGORITHM: str = "HS256"

    # --- Database ---
    DATABASE_URL: str = Field(..., description="postgresql+asyncpg://user:pass@host:5432/scholarai")

    # --- Redis ---
    REDIS_URL: str = "redis://localhost:6379/0"

    # --- Qdrant ---
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_COLLECTION: str = "scholarai_chunks"

    # --- S3 / storage ---
    # Works with real AWS S3 (leave S3_ENDPOINT_URL blank) or any S3-compatible
    # provider like Cloudflare R2 or Backblaze B2 (set S3_ENDPOINT_URL to
    # their endpoint) — same boto3 client either way.
    S3_BUCKET: str = "scholarai-uploads"
    S3_REGION: str = "auto"
    S3_ENDPOINT_URL: str | None = None
    AWS_ACCESS_KEY_ID: str | None = None
    AWS_SECRET_ACCESS_KEY: str | None = None
    # If unset, file uploads fall back to local disk (uploads/) — fine for
    # local dev, but breaks the moment you run more than one server instance.
    USE_S3_STORAGE: bool = False
    # Interim local storage until Phase 7 builds real S3 upload — files land
    # here on disk in the meantime so attachments work today.
    LOCAL_UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE_MB: int = 20

    # --- AI providers ---
    # LiteLLM (used by the chat service) reads provider keys from os.environ
    # directly — it does NOT know about pydantic-settings or our .env file.
    # We read them here (so they're validated/documented in one place) and
    # export them to the process environment below, so LiteLLM can see them.
    OPENAI_API_KEY: str | None = None
    ANTHROPIC_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    DEFAULT_AI_MODEL: str = "gpt-4o-mini"

    # --- Email (Resend) ---
    # If unset, verification/reset emails are skipped and just logged instead
    # — fine for dev. Set both to actually send real emails.
    RESEND_API_KEY: str | None = None
    RESEND_FROM_EMAIL: str = "ScholarAI <onboarding@resend.dev>"
    FRONTEND_URL: str = "http://localhost:5173"

    # --- CORS ---
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]


@lru_cache
def get_settings() -> Settings:
    """Cached so Settings() is only constructed once per process."""
    s = Settings()

    # Export AI provider keys to the real process environment so LiteLLM
    # (and any other library that reads os.environ directly) can see them.
    for env_var in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"):
        value = getattr(s, env_var)
        if value:
            os.environ[env_var] = value

    return s


settings = get_settings()
