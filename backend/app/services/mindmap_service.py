import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import acompletion_with_retry, ai_error_response, extract_json, resolve_api_key
from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.repositories.file_repository import FileRepository
from app.repositories.mindmap_repository import MindMapRepository
from app.schemas.mindmap import MindMapGenerateRequest


def _build_prompt(data: MindMapGenerateRequest, file_context: str | None) -> str:
    context_block = (
        f"\n\nBase the mind map on this material the student uploaded:\n{file_context}"
        if file_context
        else ""
    )
    return f"""You are a mind-map generation engine for a study app. Create a mind map on the \
topic: "{data.topic}".{context_block}

Structure it as a tree: one root node (the central topic), 3-6 main branches (key subtopics), \
and each branch may have 2-5 leaf nodes (specific details/facts). Keep node NAMES short — a few \
words each, not full sentences — but give every single node (root, branches, and leaves) a \
"description" field of 1-3 sentences explaining that concept in more depth, since a student will \
click on any node to read it. Maximum 3 levels deep total (root, branch, leaf).

Respond with ONLY valid JSON (no markdown code fences, no commentary), in exactly this shape:
{{
  "title": "Short title for this mind map",
  "root": {{
    "name": "Central topic",
    "description": "1-3 sentences explaining the central topic.",
    "children": [
      {{
        "name": "Main branch",
        "description": "1-3 sentences explaining this branch.",
        "children": [
          {{"name": "Leaf detail", "description": "1-3 sentences explaining this detail.", "children": []}}
        ]
      }}
    ]
  }}
}}"""


class MindMapService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = MindMapRepository(db)
        self.files = FileRepository(db)

    async def generate(self, user_id: uuid.UUID, data: MindMapGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["mindmap"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['mindmap']} mind maps. Try again tomorrow.",
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
            )
            parsed = extract_json(response.choices[0].message.content)
        except Exception as e:
            status_code, message = ai_error_response(e, "generate the mind map")
            raise HTTPException(status_code, message)

        root = parsed.get("root")
        if not root:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return a valid mind map. Please try again.")

        title = parsed.get("title") or f"{data.topic.strip().title()} Mind Map"
        return await self.repo.create(user_id, title, root, data.source_chat_id)

    async def list_maps(self, user_id: uuid.UUID):
        return await self.repo.list_maps(user_id)

    async def get_map(self, map_id: uuid.UUID, user_id: uuid.UUID):
        mm = await self.repo.get_map(map_id, user_id)
        if mm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mind map not found.")
        return mm

    async def delete_map(self, map_id: uuid.UUID, user_id: uuid.UUID):
        mm = await self.repo.get_map(map_id, user_id)
        if mm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mind map not found.")
        await self.repo.soft_delete(mm)
