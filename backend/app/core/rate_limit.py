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
import socket
from urllib.parse import urlparse

from loguru import logger
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

from app.core.config import settings


def _resolve_storage_uri(raw_url: str | None) -> str:
    """Safely determines the rate limiting storage URI.

    If REDIS_URL points to an unreachable host (e.g. an expired Upstash
    cluster, bad DNS, or network partition), this function catches the failure
    at startup and falls back to in-memory rate limiting ('memory://'). This
    guarantees that Redis downtime or DNS misconfigurations never crash
    critical auth endpoints (login, register, token refresh).
    """
    if not raw_url or raw_url in ("redis://localhost:6379/0", "memory://"):
        logger.info(
            "Rate limiting using in-memory storage (local/default). "
            "Set a reachable REDIS_URL in production to share limits across worker processes."
        )
        return "memory://"

    url_str = raw_url.strip()

    # Reject non-redis schemes like https:// (common mistake when copying Upstash REST URLs)
    if not (url_str.startswith("redis://") or url_str.startswith("rediss://")):
        logger.warning(
            f"Rate limiting: REDIS_URL scheme is not redis:// or rediss:// (got: '{url_str[:25]}...'). "
            "Note: Upstash REST URLs (https://...) cannot be used as Redis TCP endpoints. "
            "Falling back to in-memory rate limiting."
        )
        return "memory://"

    try:
        parsed = urlparse(url_str)
        host = parsed.hostname
        port = parsed.port or (6380 if parsed.scheme == "rediss" else 6379)

        if not host:
            logger.warning(f"Rate limiting: Could not parse hostname from REDIS_URL '{url_str}'. Falling back to memory://")
            return "memory://"

        # Probe DNS resolution and TCP handshake with a strict 1.5s timeout
        sock = socket.create_connection((host, port), timeout=1.5)
        sock.close()

        # Optional: if redis package is available, verify authentication / ping
        try:
            import redis

            client = redis.from_url(url_str, socket_timeout=1.5, socket_connect_timeout=1.5)
            client.ping()
            client.close()
        except ImportError:
            pass  # socket connection succeeded; limits library handles redis
        except Exception as ping_err:
            logger.warning(
                f"Rate limiting: TCP port reachable on {host}:{port}, but Redis PING failed ({ping_err}). "
                "Falling back to in-memory rate limiting to protect authentication routes."
            )
            return "memory://"

        logger.info(f"Rate limiting: Successfully connected to Redis storage at {host}:{port}.")
        return url_str

    except (socket.gaierror, socket.timeout, ConnectionRefusedError, OSError) as net_err:
        logger.warning(
            f"Rate limiting: Redis endpoint '{raw_url}' is unreachable ({type(net_err).__name__}: {net_err}). "
            "Falling back to in-memory storage so user login, registration, and API traffic remain 100% operational."
        )
        return "memory://"
    except Exception as exc:
        logger.warning(
            f"Rate limiting: Unexpected error testing Redis endpoint '{raw_url}' ({exc}). "
            "Falling back to in-memory storage."
        )
        return "memory://"


storage_uri = _resolve_storage_uri(settings.REDIS_URL)

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    in_memory_fallback_enabled=True,
    swallow_errors=True,
)

# Re-exported so app/main.py doesn't need its own import of slowapi's private
# handler name — this is the handler that turns a RateLimitExceeded
# exception into a proper 429 response instead of an unhandled 500.
rate_limit_exceeded_handler = _rate_limit_exceeded_handler
