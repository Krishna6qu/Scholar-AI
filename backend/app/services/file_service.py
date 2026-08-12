import io
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.storage import get_storage_backend
from app.models.files import ProcessingStatus
from app.repositories.file_repository import FileRepository

SUPPORTED_TEXT_EXTENSIONS = {".txt", ".md", ".csv"}
SUPPORTED_PDF_EXTENSIONS = {".pdf"}


def _extract_text(contents: bytes, extension: str) -> str | None:
    if extension in SUPPORTED_TEXT_EXTENSIONS:
        return contents.decode("utf-8", errors="ignore")

    if extension in SUPPORTED_PDF_EXTENSIONS:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(contents))
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    # DOCX/PPTX/XLSX extraction is real Phase 7 work (needs python-docx,
    # python-pptx, openpyxl) — not wired up yet. File still uploads and
    # attaches, it just won't have readable content for the AI yet.
    return None


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FileRepository(db)
        self.storage = get_storage_backend()

    async def upload(self, owner_id: uuid.UUID, chat_id: uuid.UUID | None, upload: UploadFile):
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        contents = await upload.read()
        if len(contents) > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB limit.",
            )

        extension = Path(upload.filename or "").suffix.lower()
        storage_key = await self.storage.save(contents, extension)

        file = await self.repo.create_file(
            owner_id=owner_id,
            chat_id=chat_id,
            file_name=Path(storage_key).name,
            original_name=upload.filename or storage_key,
            mime_type=upload.content_type or "application/octet-stream",
            file_extension=extension,
            file_size=len(contents),
            storage_key=storage_key,
            storage_provider="s3" if settings.USE_S3_STORAGE else "local",
            processing_status=ProcessingStatus.processing,
        )

        try:
            text = _extract_text(contents, extension)
        except Exception:
            text = None

        if text:
            await self.repo.add_chunk(file.id, text)
            await self.repo.set_status(file, ProcessingStatus.ready)
        else:
            # Not a failure — just an unsupported type for extraction right
            # now. The file is still stored and attached to the chat.
            await self.repo.set_status(file, ProcessingStatus.ready)

        return file

    async def read_content(self, storage_key: str) -> bytes:
        return await self.storage.read(storage_key)
