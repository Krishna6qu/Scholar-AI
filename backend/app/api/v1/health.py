from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter()


@router.get("/health", tags=["health"])
async def health_check() -> dict:
    """Basic liveness check — no DB dependency, always returns fast."""
    return {"status": "ok", "service": "scholarai-backend"}


@router.get("/health/db", tags=["health"])
async def health_check_db(db: AsyncSession = Depends(get_db)) -> dict:
    """Readiness check — confirms the app can actually reach Postgres."""
    await db.execute(text("SELECT 1"))
    return {"status": "ok", "database": "reachable"}
