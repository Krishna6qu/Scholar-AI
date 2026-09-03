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
    return f"""You are an elite educational mind-map architect. Create an in-depth, \
comprehensive, deeply structured mind map on: "{data.topic}".{context_block}

Requirements for Depth & Comprehensiveness:
1. Deep Hierarchy: Structure as a multi-tier tree reaching 4 to 5 levels of depth:
   - Level 1: Root Node (Central Theme / Subject)
   - Level 2: 4-6 Core Thematic Pillars (Major Branches)
   - Level 3: 3-5 Sub-disciplines or Sub-concepts per Pillar
   - Level 4: 2-4 Concrete Principles, Mechanisms, or Components per Sub-concept
   - Level 5 (where applicable): Key Formulas, Specific Real-World Examples, or Critical Nuances
2. High-Yield Descriptions: Keep node "name" concise and impactful (2-5 words). For EVERY node, \
provide a substantial "description" (2-3 detailed sentences explaining the core concept, its mechanism, \
and why it matters, so students learn deeply upon clicking each node).
3. Ensure all leaf nodes have "children": [].

Respond with ONLY valid JSON (no markdown code fences, no commentary), in this exact format:
{{
  "title": "{data.topic.strip().title()} Deep Mind Map",
  "root": {{
    "name": "Central Topic",
    "description": "Comprehensive explanation of the overarching subject.",
    "children": [
      {{
        "name": "Core Pillar",
        "description": "Detailed explanation of this foundational branch.",
        "children": [
          {{
            "name": "Sub-Concept",
            "description": "Deep dive into this specific area.",
            "children": [
              {{
                "name": "Core Principle",
                "description": "Specific mechanism, formula, or law.",
                "children": [
                  {{
                    "name": "Concrete Example / Application",
                    "description": "Real-world manifestation and practical takeaway.",
                    "children": []
                  }}
                ]
              }}
            ]
          }}
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
                f"You've reached today's limit of {DAILY_LIMITS['mindmap']} mind maps. Features resume after 5 hours.",
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
                max_tokens=5000,
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

    async def list_maps(self, user_id: uuid.UUID, limit: int = 50):
        return await self.repo.list_maps(user_id, limit)

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

    async def mark_complete(self, map_id: uuid.UUID, user_id: uuid.UUID):
        mm = await self.repo.get_map(map_id, user_id)
        if mm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Mind map not found.")
        return await self.repo.mark_viewed(mm)
