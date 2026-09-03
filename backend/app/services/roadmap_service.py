import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ai_utils import acompletion_with_retry, ai_error_response, extract_json, resolve_api_key
from app.core.config import settings
from app.core.limits import DAILY_LIMITS
from app.core.roadmap_progress import compute_progress, enrich_structure
from app.repositories.roadmap_repository import RoadmapRepository
from app.schemas.roadmap import RoadmapDetail, RoadmapGenerateRequest, RoadmapStepToggleRequest, RoadmapSummary


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


def _to_summary(rm) -> RoadmapSummary:
    return RoadmapSummary(
        id=rm.id,
        title=rm.title,
        topic=rm.topic,
        created_at=rm.created_at,
        progress_percentage=compute_progress(rm.json_structure, rm.step_progress),
    )


def _to_detail(rm) -> RoadmapDetail:
    return RoadmapDetail(
        id=rm.id,
        title=rm.title,
        topic=rm.topic,
        created_at=rm.created_at,
        progress_percentage=compute_progress(rm.json_structure, rm.step_progress),
        json_structure=enrich_structure(rm.json_structure, rm.step_progress),
    )


class RoadmapService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = RoadmapRepository(db)

    async def generate(self, user_id: uuid.UUID, data: RoadmapGenerateRequest):
        today_count = await self.repo.count_today(user_id)
        if today_count >= DAILY_LIMITS["roadmap"]:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                f"You've reached today's limit of {DAILY_LIMITS['roadmap']} roadmaps. Features resume after 5 hours.",
            )

        prompt = _build_prompt(data)
        model = settings.DEFAULT_AI_MODEL

        try:
            response = await acompletion_with_retry(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                api_key=resolve_api_key(model),
            )
            parsed = extract_json(response.choices[0].message.content)
        except Exception as e:
            status_code, message = ai_error_response(e, "generate the roadmap")
            raise HTTPException(status_code, message)

        phases = parsed.get("phases")
        if not phases:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, "The AI did not return a valid roadmap. Please try again.")

        title = parsed.get("title") or f"{data.topic.strip().title()} Roadmap"
        rm = await self.repo.create(user_id, title, data.topic, {"phases": phases})
        return _to_detail(rm)

    async def list_roadmaps(self, user_id: uuid.UUID, limit: int = 50) -> list[RoadmapSummary]:
        roadmaps = await self.repo.list_roadmaps(user_id, limit)
        return [_to_summary(rm) for rm in roadmaps]

    async def get_roadmap(self, roadmap_id: uuid.UUID, user_id: uuid.UUID) -> RoadmapDetail:
        rm = await self.repo.get_roadmap(roadmap_id, user_id)
        if rm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found.")
        return _to_detail(rm)

    async def delete_roadmap(self, roadmap_id: uuid.UUID, user_id: uuid.UUID):
        rm = await self.repo.get_roadmap(roadmap_id, user_id)
        if rm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found.")
        await self.repo.soft_delete(rm)

    async def toggle_step(
        self, roadmap_id: uuid.UUID, user_id: uuid.UUID, data: RoadmapStepToggleRequest
    ) -> RoadmapDetail:
        rm = await self.repo.get_roadmap(roadmap_id, user_id)
        if rm is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Roadmap not found.")
        try:
            rm = await self.repo.toggle_step(rm, data.phase_index, data.step_index, data.is_completed)
        except ValueError as e:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
        return _to_detail(rm)
