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

    async def create(
        self,
        user_id: uuid.UUID,
        refresh_token: str,
        device_name: str | None = None,
        browser: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> RefreshSession:
        session = RefreshSession(
            user_id=user_id,
            refresh_token_hash=_hash_token(refresh_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            device_name=device_name,
            browser=browser,
            ip_address=ip_address,
            user_agent=user_agent,
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

    async def list_active_for_user(self, user_id: uuid.UUID) -> list[RefreshSession]:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(RefreshSession)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
                RefreshSession.expires_at > now,
            )
            .order_by(RefreshSession.created_at.desc())
        )
        return list(result.scalars().all())

    async def revoke(self, session: RefreshSession) -> None:
        session.revoked_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def revoke_all_for_user(self, user_id: uuid.UUID) -> int:
        now = datetime.now(timezone.utc)
        result = await self.db.execute(
            select(RefreshSession).where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
        )
        sessions = list(result.scalars().all())
        for s in sessions:
            s.revoked_at = now
        await self.db.commit()
        return len(sessions)

    async def revoke_others_for_user(self, user_id: uuid.UUID, current_token: str | None = None) -> int:
        now = datetime.now(timezone.utc)
        current_hash = _hash_token(current_token) if current_token else None
        result = await self.db.execute(
            select(RefreshSession).where(
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
        )
        sessions = list(result.scalars().all())
        count = 0
        for s in sessions:
            if current_hash and s.refresh_token_hash == current_hash:
                continue
            s.revoked_at = now
            count += 1
        await self.db.commit()
        return count

    async def revoke_by_id(self, user_id: uuid.UUID, session_id: uuid.UUID) -> bool:
        result = await self.db.execute(
            select(RefreshSession).where(
                RefreshSession.id == session_id,
                RefreshSession.user_id == user_id,
                RefreshSession.revoked_at.is_(None),
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.revoked_at = datetime.now(timezone.utc)
            await self.db.commit()
            return True
        return False
