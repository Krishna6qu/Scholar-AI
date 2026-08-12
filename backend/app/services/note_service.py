import uuid

import litellm
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import extract_json, resolve_api_key
from app.core.config import settings
from app.repositories.file_repository import FileRepository
from app.repositories.note_repository import NoteRepository
from app.schemas.note import NoteGenerateRequest


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
        file_context = None
        if data.source_chat_id:
            file_context = await self.files.get_chat_context_text(data.source_chat_id)

        prompt = _build_prompt(data, file_context)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
            )
            parsed = extract_json(response.choices[0].message.content)
        except Exception as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The AI could not generate notes: {e}")

        content = parsed.get("content")
        if not content:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return any notes. Please try again.")

        title = parsed.get("title") or f"{data.topic.strip().title()} Notes"
        return await self.repo.create(user_id, title, content, data.source_chat_id)

    async def list_notes(self, user_id: uuid.UUID):
        return await self.repo.list_notes(user_id)

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
