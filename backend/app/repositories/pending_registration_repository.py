from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import PendingRegistration


class PendingRegistrationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_email(self, email: str) -> PendingRegistration | None:
        result = await self.db.execute(
            select(PendingRegistration).where(PendingRegistration.email == email)
        )
        return result.scalar_one_or_none()

    async def upsert(self, pending: PendingRegistration) -> PendingRegistration:
        """Create a new pending row, or replace an existing one for the same
        email — re-registering (or resending) always starts a fresh code
        and resets the attempt counter."""
        existing = await self.get_by_email(pending.email)
        if existing:
            existing.full_name = pending.full_name
            existing.username = pending.username
            existing.password_hash = pending.password_hash
            existing.otp_code_hash = pending.otp_code_hash
            existing.attempts = 0
            existing.expires_at = pending.expires_at
            await self.db.commit()
            await self.db.refresh(existing)
            return existing

        self.db.add(pending)
        await self.db.commit()
        await self.db.refresh(pending)
        return pending

    async def increment_attempts(self, pending: PendingRegistration) -> int:
        pending.attempts += 1
        await self.db.commit()
        await self.db.refresh(pending)
        return pending.attempts

    async def delete(self, pending: PendingRegistration) -> None:
        await self.db.delete(pending)
        await self.db.commit()

    async def delete_by_email(self, email: str) -> None:
        await self.db.execute(delete(PendingRegistration).where(PendingRegistration.email == email))
        await self.db.commit()
