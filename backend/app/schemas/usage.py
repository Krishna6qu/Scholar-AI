from pydantic import BaseModel


class FeatureUsage(BaseModel):
    used: int
    limit: int


class UsageResponse(BaseModel):
    quiz: FeatureUsage
    flashcards: FeatureUsage
    mindmap: FeatureUsage
    roadmap: FeatureUsage
    note: FeatureUsage
    resets_in_hours: int = 5
    any_limit_reached: bool = False
    limit_reached_features: list[str] = []
