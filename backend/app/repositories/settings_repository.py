import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.misc import UserSettings


class SettingsRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(self, user_id: uuid.UUID) -> UserSettings:
        result = await self.db.execute(select(UserSettings).where(UserSettings.user_id == user_id))
        row = result.scalar_one_or_none()
        if row is None:
            row = UserSettings(user_id=user_id)
            self.db.add(row)
            await self.db.commit()
            await self.db.refresh(row)
        return row

    async def update(self, row: UserSettings, data: dict) -> UserSettings:
        for key, value in data.items():
            setattr(row, key, value)
        await self.db.commit()
        await self.db.refresh(row)
        return row
