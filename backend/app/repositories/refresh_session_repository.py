import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.identity import RefreshSession


def _hash_token(token: str) -> str:
    # Refresh tokens are bearer secrets — never store them plaintext, same
    # principle as passwords. SHA-256 is fine here (not a password, it's
    # already high-entropy random-looking JWT text, so no need for Argon2's
    # slow hashing — we just need a fast, irreversible lookup key).
    return hashlib.sha256(token.encode()).hexdigest()


class RefreshSessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: uuid.UUID, refresh_token: str) -> RefreshSession:
        session = RefreshSession(
            user_id=user_id,
            refresh_token_hash=_hash_token(refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_active_by_token(self, refresh_token: str) -> RefreshSession | None:
        token_hash = _hash_token(refresh_token)
        result = await self.db.execute(
            select(RefreshSession).where(
                RefreshSession.refresh_token_hash == token_hash,
                RefreshSession.revoked_at.is_(None),
            )
        )
        session = result.scalar_one_or_none()
        if session and session.expires_at < datetime.now(timezone.utc):
            return None
        return session

    async def revoke(self, session: RefreshSession) -> None:
        session.revoked_at = datetime.now(timezone.utc)
        await self.db.commit()
