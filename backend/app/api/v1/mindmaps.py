import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user
from app.db.session import get_db
from app.models.identity import User
from app.schemas.mindmap import MindMapDetail, MindMapGenerateRequest, MindMapSummary
from app.services.mindmap_service import MindMapService

router = APIRouter()


@router.post("", response_model=MindMapDetail, status_code=status.HTTP_201_CREATED)
async def generate_mindmap(
    data: MindMapGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await MindMapService(db).generate(current_user.id, data)


@router.get("", response_model=list[MindMapSummary])
async def list_mindmaps(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await MindMapService(db).list_maps(current_user.id)


@router.get("/{map_id}", response_model=MindMapDetail)
async def get_mindmap(
    map_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await MindMapService(db).get_map(map_id, current_user.id)


@router.delete("/{map_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_mindmap(
    map_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await MindMapService(db).delete_map(map_id, current_user.id)
