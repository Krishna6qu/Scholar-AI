import uuid

import litellm
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import extract_json, resolve_api_key
from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.repositories.file_repository import FileRepository
from app.repositories.flashcard_repository import FlashcardRepository
from app.schemas.flashcard import FlashcardGenerateRequest


def _build_prompt(data: FlashcardGenerateRequest, file_context: str | None) -> str:
    context_block = (
        f"\n\nBase the flashcards on this material the student uploaded:\n{file_context}"
        if file_context
        else ""
    )
    return f"""You are a flashcard-generation engine for a study app. Create exactly {data.count} \
flashcards on the topic: "{data.topic}".{context_block}

Each flashcard should test one clear concept — front is a question or term, back is a concise, \
accurate answer or definition. Avoid overly long backs (2-3 sentences max).

Respond with ONLY valid JSON (no markdown code fences, no commentary), in exactly this shape:
{{
  "title": "Short title for this flashcard set",
  "cards": [
    {{"front": "...", "back": "..."}}
  ]
}}"""


class FlashcardService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = FlashcardRepository(db)
        self.files = FileRepository(db)

    async def generate(self, user_id: uuid.UUID, data: FlashcardGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["flashcards"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['flashcards']} flashcard sets. Try again tomorrow.",
            )

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
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The AI could not generate flashcards: {e}")

        cards = parsed.get("cards", [])
        if not cards:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return any flashcards. Please try again.")

        title = parsed.get("title") or f"{data.topic.strip().title()} Flashcards"
        fc_set = await self.repo.create_set(user_id, title, data.source_chat_id)
        await self.repo.add_items(fc_set.id, cards)
        return await self.repo.get_set(fc_set.id, user_id)

    async def list_sets(self, user_id: uuid.UUID):
        return await self.repo.list_sets(user_id)

    async def get_set(self, flashcard_id: uuid.UUID, user_id: uuid.UUID):
        fc_set = await self.repo.get_set(flashcard_id, user_id)
        if fc_set is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Flashcard set not found.")
        return fc_set

    async def delete_set(self, flashcard_id: uuid.UUID, user_id: uuid.UUID):
        fc_set = await self.repo.get_set(flashcard_id, user_id)
        if fc_set is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Flashcard set not found.")
        await self.repo.soft_delete(fc_set)
