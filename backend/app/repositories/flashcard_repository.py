import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.study import Flashcard, FlashcardItem


class FlashcardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def count_today(self, owner_id: uuid.UUID) -> int:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        result = await self.db.execute(
            select(func.count()).select_from(Flashcard).where(
                Flashcard.owner_id == owner_id, Flashcard.created_at >= today_start
            )
        )
        return result.scalar_one()

    async def create_set(
        self, owner_id: uuid.UUID, title: str, source_chat_id: uuid.UUID | None
    ) -> Flashcard:
        fc = Flashcard(owner_id=owner_id, title=title, source_chat_id=source_chat_id)
        self.db.add(fc)
        await self.db.commit()
        await self.db.refresh(fc)
        return fc

    async def add_items(self, flashcard_id: uuid.UUID, items: list[dict]) -> None:
        for i, item in enumerate(items):
            self.db.add(
                FlashcardItem(
                    flashcard_id=flashcard_id,
                    front_text=item["front"],
                    back_text=item["back"],
                    order_number=i,
                )
            )
        await self.db.commit()

    async def list_sets(self, owner_id: uuid.UUID) -> list[Flashcard]:
        result = await self.db.execute(
            select(Flashcard)
            .where(Flashcard.owner_id == owner_id, Flashcard.deleted_at.is_(None))
            .order_by(Flashcard.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_set(self, flashcard_id: uuid.UUID, owner_id: uuid.UUID) -> Flashcard | None:
        result = await self.db.execute(
            select(Flashcard)
            .where(
                Flashcard.id == flashcard_id,
                Flashcard.owner_id == owner_id,
                Flashcard.deleted_at.is_(None),
            )
            .options(selectinload(Flashcard.items))
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, fc: Flashcard) -> None:
        fc.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
