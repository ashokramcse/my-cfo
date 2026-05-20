from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.friend import Friend
from app.models.emi import EMI, EMIStatus, EMIOwnerType
from app.schemas.friend import FriendCreate, FriendUpdate, FriendOut

router = APIRouter()


async def _refresh_friend_totals(db: AsyncSession, friend_id: uuid.UUID):
    result = await db.execute(
        select(
            func.sum(EMI.total_amount).label("total"),
            func.sum(EMI.amount_collected).label("collected"),
            func.count().label("count"),
        ).where(EMI.friend_id == friend_id, EMI.status == EMIStatus.ACTIVE)
    )
    row = result.one()
    from decimal import Decimal
    total = row.total or Decimal(0)
    collected = row.collected or Decimal(0)
    pending = total - collected

    friend_result = await db.execute(select(Friend).where(Friend.id == friend_id))
    friend = friend_result.scalar_one_or_none()
    if friend:
        friend.total_emi_amount = total
        friend.total_collected = collected
        friend.total_pending = pending
        friend.active_emi_count = row.count or 0
        friend.risk_level = "HIGH" if pending > 50000 else "MEDIUM" if pending > 10000 else "LOW"


@router.get("", response_model=list[FriendOut])
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friend).where(Friend.user_id == current_user.id, Friend.is_active == True)
        .order_by(Friend.total_pending.desc())
    )
    return result.scalars().all()


@router.post("", response_model=FriendOut, status_code=201)
async def create_friend(
    payload: FriendCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friend = Friend(**payload.model_dump(), user_id=current_user.id)
    db.add(friend)
    await db.flush()
    return friend


@router.get("/{friend_id}", response_model=FriendOut)
async def get_friend(
    friend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friend).where(Friend.id == friend_id, Friend.user_id == current_user.id)
    )
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    return friend


@router.patch("/{friend_id}", response_model=FriendOut)
async def update_friend(
    friend_id: uuid.UUID,
    payload: FriendUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friend).where(Friend.id == friend_id, Friend.user_id == current_user.id)
    )
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(friend, field, value)
    return friend


@router.delete("/{friend_id}", status_code=204)
async def delete_friend(
    friend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friend).where(Friend.id == friend_id, Friend.user_id == current_user.id)
    )
    friend = result.scalar_one_or_none()
    if not friend:
        raise HTTPException(status_code=404, detail="Friend not found")
    await db.delete(friend)


@router.get("/{friend_id}/emis")
async def friend_emis(
    friend_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Friend).where(Friend.id == friend_id, Friend.user_id == current_user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Friend not found")

    emi_result = await db.execute(
        select(EMI).where(EMI.friend_id == friend_id, EMI.user_id == current_user.id)
        .options(selectinload(EMI.payments))
        .order_by(EMI.next_due_date.asc())
    )
    return emi_result.scalars().all()


@router.get("/analytics/intelligence-dashboard")
async def friend_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    friends_result = await db.execute(
        select(Friend).where(Friend.user_id == current_user.id, Friend.is_active == True)
    )
    friends = friends_result.scalars().all()

    from decimal import Decimal
    total_receivable = sum(f.total_pending for f in friends)
    high_risk = [f for f in friends if f.risk_level == "HIGH"]
    medium_risk = [f for f in friends if f.risk_level == "MEDIUM"]

    emis_result = await db.execute(
        select(EMI).where(
            EMI.user_id == current_user.id,
            EMI.owner_type.in_([EMIOwnerType.FRIEND, EMIOwnerType.FAMILY]),
            EMI.status == EMIStatus.ACTIVE,
        )
    )
    friend_emis = emis_result.scalars().all()

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    upcoming_7d = [e for e in friend_emis if e.next_due_date and e.next_due_date <= now + timedelta(days=7)]

    return {
        "total_receivable": float(total_receivable),
        "total_friends": len(friends),
        "high_risk_count": len(high_risk),
        "medium_risk_count": len(medium_risk),
        "active_friend_emis": len(friend_emis),
        "upcoming_7days": len(upcoming_7d),
        "top_debtors": [
            {"name": f.name, "pending": float(f.total_pending), "risk": f.risk_level}
            for f in sorted(friends, key=lambda x: x.total_pending, reverse=True)[:5]
        ],
        "upcoming_collections": [
            {
                "emi_id": str(e.id),
                "product": e.product_name,
                "due_date": e.next_due_date.isoformat() if e.next_due_date else None,
                "amount": float(e.monthly_emi),
                "friend_id": str(e.friend_id) if e.friend_id else None,
            }
            for e in upcoming_7d
        ],
    }
