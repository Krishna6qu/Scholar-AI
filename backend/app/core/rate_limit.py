"""
Rate limiting for abuse-prone endpoints (login, register, refresh).

IMPORTANT: slowapi's default storage is in-process memory. That's fine for a
single uvicorn process, but the moment you run multiple worker processes
(which you need for real traffic — see gunicorn_conf.py), each worker has
its own separate counter, so the "5 per minute" limit actually becomes
"5 per minute PER WORKER" — e.g. 20 per minute across 4 workers. To get a
real, shared limit across all workers, this needs Redis. We use it
automatically if REDIS_URL is configured; otherwise we fall back to
in-memory and log a warning, since that's still much better than nothing
for local dev / a single-instance deployment.
"""
from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from app.core.config import settings

if settings.REDIS_URL and settings.REDIS_URL != "redis://localhost:6379/0":
    storage_uri = settings.REDIS_URL
else:
    storage_uri = "memory://"
    logger.warning(
        "Rate limiting is using in-memory storage — limits are per-process, not "
        "global. Set REDIS_URL in production so limits work correctly across "
        "multiple worker processes."
    )

limiter = Limiter(key_func=get_remote_address, storage_uri=storage_uri)

# Re-exported so app/main.py doesn't need its own import of slowapi's private
# handler name — this is the handler that turns a RateLimitExceeded
# exception into a proper 429 response instead of an unhandled 500.
rate_limit_exceeded_handler = _rate_limit_exceeded_handler
