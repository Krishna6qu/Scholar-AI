import re
import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import acompletion_with_retry, ai_error_response, extract_json, resolve_api_key
from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.repositories.file_repository import FileRepository
from app.repositories.note_repository import NoteRepository
from app.schemas.note import NoteGenerateRequest


def _extract_notes_from_raw_text(raw: str, default_topic: str) -> tuple[str, str]:
    """Fallback parser that extracts title and markdown content when the AI outputs
    malformed JSON, unescaped quotes, or raw markdown."""
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json|markdown)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    cleaned = cleaned.strip()

    title_match = re.search(r'"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', cleaned)
    title = title_match.group(1) if title_match else f"{default_topic.strip().title()} Notes"

    content_match = re.search(r'"content"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"|\}\s*$)', cleaned)
    if not content_match:
        content_match = re.search(r'"content"\s*:\s*"([\s\S]*)', cleaned)

    if content_match:
        content = content_match.group(1).rstrip('"\n\r\t }')
        content = content.replace(r"\n", "\n").replace(r"\"", '"').replace(r"\\", "\\")
    else:
        content = cleaned
        h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
        if h1_match:
            title = h1_match.group(1).strip()

    return content, title


def _build_prompt(data: NoteGenerateRequest, file_context: str | None) -> str:
    context_block = (
        f"\n\nBase the notes on this material the student uploaded:\n{file_context}"
        if file_context
        else ""
    )
    return f"""You are a study-notes generator. Write concise, well-structured revision notes on \
the topic: "{data.topic}".{context_block}

Use markdown: headings for sections, bullet points for key facts, **bold** for terms worth \
memorizing. Keep it dense and skimmable — this is for last-minute revision, not a full essay. \
Aim for the length a student could review in 3-5 minutes.

Respond with ONLY valid JSON (no markdown code fences around the JSON itself, no commentary), \
in exactly this shape:
{{
  "title": "Short title for these notes",
  "content": "The full notes, written in markdown."
}}"""


class NoteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = NoteRepository(db)
        self.files = FileRepository(db)

    async def generate(self, user_id: uuid.UUID, data: NoteGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["note"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['note']} revision notes. Features resume after 5 hours.",
            )

        file_context = None
        if data.source_chat_id:
            file_context = await self.files.get_chat_context_text(data.source_chat_id)

        prompt = _build_prompt(data, file_context)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
                max_tokens=2200,
            )
            raw_text = response.choices[0].message.content
        except Exception as e:
            status_code, message = ai_error_response(e, "generate notes")
            raise HTTPException(status_code, message)

        parsed = None
        try:
            parsed = extract_json(raw_text)
        except Exception:
            pass

        content = None
        title = None
        if isinstance(parsed, dict):
            content = (
                parsed.get("content")
                or parsed.get("notes")
                or parsed.get("text")
                or parsed.get("markdown")
                or parsed.get("summary")
            )
            title = parsed.get("title")

        if not content:
            fallback_content, fallback_title = _extract_notes_from_raw_text(raw_text, data.topic)
            content = fallback_content
            title = title or fallback_title

        if not content or not content.strip():
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return any notes. Please try again.")

        title = title or f"{data.topic.strip().title()} Notes"
        return await self.repo.create(user_id, title, content, data.source_chat_id)

    async def list_notes(self, user_id: uuid.UUID, limit: int = 50):
        return await self.repo.list_notes(user_id, limit)

    async def get_note(self, note_id: uuid.UUID, user_id: uuid.UUID):
        note = await self.repo.get_note(note_id, user_id)
        if note is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
        return note

    async def delete_note(self, note_id: uuid.UUID, user_id: uuid.UUID):
        note = await self.repo.get_note(note_id, user_id)
        if note is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found.")
        await self.repo.soft_delete(note)
