from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# asyncpg doesn't accept a `?sslmode=` query param (that's a psycopg2-ism) — it
# wants ssl passed as a connect_arg instead. Hosted Postgres providers like Neon
# require SSL, so detect that case and set it explicitly rather than relying on
# the URL string.
_connect_args = {"ssl": "require"} if "neon.tech" in settings.DATABASE_URL else {}

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
