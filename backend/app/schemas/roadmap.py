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


class RoadmapSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    topic: str
    created_at: datetime


class RoadmapDetail(RoadmapSummary):
    json_structure: dict[str, Any]
