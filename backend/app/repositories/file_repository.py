import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.files import DocumentChunk, ProcessingStatus, UploadedFile


class FileRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, file_id: uuid.UUID, owner_id: uuid.UUID) -> UploadedFile | None:
        result = await self.db.execute(
            select(UploadedFile).where(
                UploadedFile.id == file_id,
                UploadedFile.owner_id == owner_id,
                UploadedFile.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def get_files_for_chat(self, chat_id: uuid.UUID) -> list[UploadedFile]:
        result = await self.db.execute(
            select(UploadedFile)
            .where(UploadedFile.chat_id == chat_id, UploadedFile.deleted_at.is_(None))
            .order_by(UploadedFile.created_at)
        )
        return list(result.scalars().all())

    async def create_file(self, **kwargs) -> UploadedFile:
        file = UploadedFile(**kwargs)
        self.db.add(file)
        await self.db.commit()
        await self.db.refresh(file)
        return file

    async def set_status(self, file: UploadedFile, status: ProcessingStatus) -> None:
        file.processing_status = status
        await self.db.commit()

    async def add_chunk(self, file_id: uuid.UUID, content: str) -> DocumentChunk:
        chunk = DocumentChunk(file_id=file_id, chunk_index=0, content=content)
        self.db.add(chunk)
        await self.db.commit()
        return chunk

    async def get_chat_context_text(self, chat_id: uuid.UUID) -> str | None:
        """
        Returns concatenated extracted text of every file attached to a chat.
        No chunking/embeddings/retrieval yet (that's the real Phase 7 RAG
        pipeline) — this just feeds the whole extracted document to the model
        directly, which works fine for reasonably sized files.
        """
        result = await self.db.execute(
            select(UploadedFile.original_name, DocumentChunk.content)
            .join(DocumentChunk, DocumentChunk.file_id == UploadedFile.id)
            .where(UploadedFile.chat_id == chat_id, UploadedFile.deleted_at.is_(None))
        )
        rows = result.all()
        if not rows:
            return None

        parts = [f"--- File: {name} ---\n{content}" for name, content in rows]
        return "\n\n".join(parts)

    async def get_file_with_content(self, file_id: uuid.UUID, owner_id: uuid.UUID):
        result = await self.db.execute(
            select(UploadedFile).where(
                UploadedFile.id == file_id,
                UploadedFile.owner_id == owner_id,
                UploadedFile.deleted_at.is_(None),
            )
        )
        file = result.scalar_one_or_none()
        if file is None:
            return None, None

        chunk_result = await self.db.execute(
            select(DocumentChunk.content).where(DocumentChunk.file_id == file_id)
        )
        content = chunk_result.scalar_one_or_none()
        return file, content
