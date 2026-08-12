from pydantic import BaseModel


class FeatureUsage(BaseModel):
    used: int
    limit: int


class UsageResponse(BaseModel):
    quiz: FeatureUsage
    flashcards: FeatureUsage
    mindmap: FeatureUsage
    roadmap: FeatureUsage
