import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.study import ShortNote


class NoteRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, owner_id: uuid.UUID, title: str, content: str, source_chat_id: uuid.UUID | None
    ) -> ShortNote:
        note = ShortNote(owner_id=owner_id, title=title, content=content, source_chat_id=source_chat_id)
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def list_notes(self, owner_id: uuid.UUID) -> list[ShortNote]:
        result = await self.db.execute(
            select(ShortNote)
            .where(ShortNote.owner_id == owner_id, ShortNote.deleted_at.is_(None))
            .order_by(ShortNote.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_note(self, note_id: uuid.UUID, owner_id: uuid.UUID) -> ShortNote | None:
        result = await self.db.execute(
            select(ShortNote).where(
                ShortNote.id == note_id, ShortNote.owner_id == owner_id, ShortNote.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    async def soft_delete(self, note: ShortNote) -> None:
        note.deleted_at = datetime.now(timezone.utc)
        await self.db.commit()
