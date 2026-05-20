from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.insight import Insight
from app.schemas.insight import InsightOut
import uuid

router = APIRouter()


@router.get("", response_model=List[InsightOut])
async def list_insights(
    unread_only: bool = Query(False),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [Insight.user_id == current_user.id, Insight.is_dismissed == False]
    if unread_only:
        filters.append(Insight.is_read == False)

    result = await db.execute(
        select(Insight).where(and_(*filters))
        .order_by(Insight.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.patch("/{insight_id}/read")
async def mark_read(
    insight_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.user_id == current_user.id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    insight.is_read = True
    await db.commit()
    return {"status": "ok"}


@router.patch("/{insight_id}/dismiss")
async def dismiss(
    insight_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insight).where(Insight.id == insight_id, Insight.user_id == current_user.id)
    )
    insight = result.scalar_one_or_none()
    if not insight:
        raise HTTPException(status_code=404, detail="Insight not found")
    insight.is_dismissed = True
    await db.commit()
    return {"status": "ok"}


@router.post("/generate")
async def generate_insights(
    current_user: User = Depends(get_current_user),
):
    from app.workers.tasks import generate_insights_task
    task = generate_insights_task.delay(str(current_user.id))
    return {"task_id": task.id, "message": "Insight generation started"}
