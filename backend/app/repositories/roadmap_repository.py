import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.roadmap_progress import step_key
from app.models.roadmap import Roadmap


class RoadmapRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def count_today(self, owner_id: uuid.UUID) -> int:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(Roadmap).where(
                Roadmap.owner_id == owner_id,
                Roadmap.created_at >= today_start,
                Roadmap.deleted_at.is_(None),
            )
        )
        return result.scalar_one()

    async def create(self, owner_id: uuid.UUID, title: str, topic: str, structure: dict[str, Any]) -> Roadmap:
        rm = Roadmap(owner_id=owner_id, title=title, topic=topic, json_structure=structure)
        self.db.add(rm)
        await self.db.commit()
        await self.db.refresh(rm)
        return rm

    async def list_roadmaps(self, owner_id: uuid.UUID, limit: int = 50) -> list[Roadmap]:
        result = await self.db.execute(
            select(Roadmap)
            .where(Roadmap.owner_id == owner_id, Roadmap.deleted_at.is_(None))
            .order_by(Roadmap.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_roadmap(self, roadmap_id: uuid.UUID, owner_id: uuid.UUID) -> Roadmap | None:
        result = await self.db.execute(
            select(Roadmap).where(
                Roadmap.id == roadmap_id, Roadmap.owner_id == owner_id, Roadmap.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, rm: Roadmap) -> None:
        rm.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()

    async def toggle_step(
        self,
        rm: Roadmap,
        phase_index: int,
        step_index: int,
        is_completed: bool,
    ) -> Roadmap:
        phases = rm.json_structure.get("phases", [])
        if phase_index >= len(phases):
            raise ValueError("phase_index out of range")
        steps = phases[phase_index].get("steps", [])
        if step_index >= len(steps):
            raise ValueError("step_index out of range")

        progress = dict(rm.step_progress or {})
        progress[step_key(phase_index, step_index)] = is_completed
        rm.step_progress = progress
        await self.db.commit()
        await self.db.refresh(rm)
        return rm
