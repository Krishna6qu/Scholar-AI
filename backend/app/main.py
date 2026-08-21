from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.core.security_headers import SecurityHeadersMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    logger.info(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode")
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    openapi_url=f"{settings.API_V1_PREFIX}/openapi.json",
    docs_url=f"{settings.API_V1_PREFIX}/docs",
    lifespan=lifespan,
)

# Wires up the @limiter.limit(...) decorators already used in app/api/v1/auth.py.
# Without this, slowapi still counts requests (the decorator holds its own
# reference to `limiter`), but a request that actually exceeds the limit
# raises RateLimitExceeded with no handler registered — FastAPI turns that
# into an unhandled 500 instead of a proper 429. This was a real bug: hitting
# a rate limit produced a server error rather than a clean "too many
# requests" response.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# SecurityHeadersMiddleware was defined but never registered anywhere — the
# security headers it adds (X-Frame-Options, nosniff, HSTS, etc.) were
# silently never being sent on any response.
app.add_middleware(SecurityHeadersMiddleware, is_production=settings.ENVIRONMENT == "production")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root() -> dict:
    return {"message": f"{settings.APP_NAME} API — see {settings.API_V1_PREFIX}/docs"}
