import uuid

import litellm
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import extract_json, resolve_api_key
from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.repositories.roadmap_repository import RoadmapRepository
from app.schemas.roadmap import RoadmapGenerateRequest


def _build_prompt(data: RoadmapGenerateRequest) -> str:
    return f"""You are a career/learning roadmap generator for a student platform. Create a \
DETAILED, comprehensive, step-by-step roadmap for someone who wants to become: "{data.topic}".

Cover the full journey from a beginner starting point to job-ready/proficient. Break it into \
5-8 sequential phases (e.g. Foundations, Core Skills, Specialization, Projects, Job Prep — \
adapt phase names to the actual topic). Each phase must have 3-6 concrete steps. Each step \
needs a clear, actionable title, a 1-2 sentence description of what to actually do, and 2-4 \
specific resources or resource TYPES to use (e.g. "freeCodeCamp's Python course", "build 2 \
portfolio projects", "read the official docs") — do not invent fake URLs, just name real, \
well-known resource types or platforms. Also estimate a realistic duration per phase.

Respond with ONLY valid JSON (no markdown code fences, no commentary), in exactly this shape:
{{
  "title": "Roadmap title, e.g. 'Data Scientist Roadmap'",
  "phases": [
    {{
      "order": 1,
      "title": "Phase title",
      "duration_estimate": "e.g. '4-6 weeks'",
      "description": "One sentence on what this phase achieves.",
      "steps": [
        {{
          "title": "Step title",
          "description": "What to actually do.",
          "resources": ["...", "..."]
        }}
      ]
    }}
  ]
}}"""


class RoadmapService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = RoadmapRepository(db)

    async def generate(self, user_id: uuid.UUID, data: RoadmapGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["roadmap"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['roadmap']} roadmaps. Try again tomorrow.",
            )

        prompt = _build_prompt(data)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await litellm.acompletion(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
            )
            parsed = extract_json(response.choices[0].message.content)
        except Exception as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"The AI could not generate the roadmap: {e}")

        phases = parsed.get("phases")
        if not phases:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return a valid roadmap. Please try again.")

        title = parsed.get("title") or f"{data.topic.strip().title()} Roadmap"
        return await self.repo.create(user_id, title, data.topic, {"phases": phases})

    async def list_roadmaps(self, user_id: uuid.UUID):
        return await self.repo.list_roadmaps(user_id)

    async def get_roadmap(self, roadmap_id: uuid.UUID, user_id: uuid.UUID):
        rm = await self.repo.get_roadmap(roadmap_id, user_id)
        if rm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found.")
        return rm

    async def delete_roadmap(self, roadmap_id: uuid.UUID, user_id: uuid.UUID):
        rm = await self.repo.get_roadmap(roadmap_id, user_id)
        if rm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found.")
        await self.repo.soft_delete(rm)
