from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate, AssetOut

router = APIRouter()


@router.get("", response_model=List[AssetOut])
async def list_assets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset)
        .where(Asset.user_id == current_user.id)
        .order_by(Asset.current_value.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AssetOut)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = Asset(user_id=current_user.id, **data.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    data: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == current_user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == current_user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    return {"ok": True}
