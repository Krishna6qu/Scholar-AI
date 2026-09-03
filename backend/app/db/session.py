from collections.abc import AsyncGenerator
from urllib.parse import urlparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings


def _build_connect_args(database_url: str) -> dict:
    """
    asyncpg doesn't accept a `?sslmode=` query param (that's a psycopg2-ism) —
    it wants ssl passed as a connect_arg instead. Hosted Postgres providers
    require SSL; local dev typically does not.

    When connecting through Supabase's PgBouncer pooler (port 6543, transaction
    mode), asyncpg's server-side prepared statement cache must be disabled or
    you'll hit DuplicatePreparedStatementError under concurrent load.
    """
    # Strip the SQLAlchemy driver suffix so urlparse sees a normal postgres URL.
    normalized = database_url.replace("postgresql+asyncpg://", "postgresql://")
    parsed = urlparse(normalized)
    host = parsed.hostname or ""
    port = parsed.port

    is_local = host in ("localhost", "127.0.0.1")
    if is_local:
        return {}

    args: dict = {"ssl": "require"}

    # PgBouncer transaction pooling (Supabase pooler on 6543) — not host-specific.
    if port == 6543:
        args["statement_cache_size"] = 0
        args["prepared_statement_cache_size"] = 0

    return args


_connect_args = _build_connect_args(settings.DATABASE_URL)

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a session per request, always closed after."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
