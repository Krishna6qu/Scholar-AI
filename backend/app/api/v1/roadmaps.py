import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.roadmap import RoadmapDetail, RoadmapGenerateRequest, RoadmapSummary
from app.services.roadmap_service import RoadmapService

router = APIRouter()


@router.post("", response_model=RoadmapDetail, status_code=status.HTTP_201_CREATED)
async def generate_roadmap(
    data: RoadmapGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await RoadmapService(db).generate(current_user.id, data)


@router.get("", response_model=list[RoadmapSummary])
async def list_roadmaps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await RoadmapService(db).list_roadmaps(current_user.id)


@router.get("/{roadmap_id}", response_model=RoadmapDetail)
async def get_roadmap(
    roadmap_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await RoadmapService(db).get_roadmap(roadmap_id, current_user.id)


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_roadmap(
    roadmap_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await RoadmapService(db).delete_roadmap(roadmap_id, current_user.id)
