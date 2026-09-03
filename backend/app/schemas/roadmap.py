import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RoadmapGenerateRequest(BaseModel):
    topic: str = Field(
        min_length=3,
        max_length=300,
        description="What the student wants to become or learn, e.g. 'Data Scientist' or 'Full-Stack Web Developer'.",
    )


class RoadmapStepToggleRequest(BaseModel):
    phase_index: int = Field(ge=0)
    step_index: int = Field(ge=0)
    is_completed: bool


class RoadmapSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    topic: str
    created_at: datetime
    progress_percentage: float = 0.0


class RoadmapDetail(RoadmapSummary):
    json_structure: dict[str, Any]


class RoadmapStepToggleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    progress_percentage: float
    json_structure: dict[str, Any]
