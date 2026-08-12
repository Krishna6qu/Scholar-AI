import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study import MindMap


class MindMapRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def count_today(self, owner_id: uuid.UUID) -> int:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(MindMap).where(
                MindMap.owner_id == owner_id, MindMap.created_at >= today_start
            )
        )
        return result.scalar_one()

    async def create(
        self, owner_id: uuid.UUID, title: str, structure: dict[str, Any], source_chat_id: uuid.UUID | None
    ) -> MindMap:
        mm = MindMap(owner_id=owner_id, title=title, json_structure=structure, source_chat_id=source_chat_id)
        self.db.add(mm)
        await self.db.commit()
        await self.db.refresh(mm)
        return mm

    async def list_maps(self, owner_id: uuid.UUID) -> list[MindMap]:
        result = await self.db.execute(
            select(MindMap)
            .where(MindMap.owner_id == owner_id, MindMap.deleted_at.is_(None))
            .order_by(MindMap.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_map(self, map_id: uuid.UUID, owner_id: uuid.UUID) -> MindMap | None:
        result = await self.db.execute(
            select(MindMap).where(
                MindMap.id == map_id, MindMap.owner_id == owner_id, MindMap.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, mm: MindMap) -> None:
        mm.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
