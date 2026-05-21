from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from decimal import Decimal
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.investment import Investment
from app.schemas.investment import InvestmentCreate, InvestmentUpdate, InvestmentOut

router = APIRouter()


@router.get("", response_model=List[InvestmentOut])
async def list_investments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment)
        .where(Investment.user_id == current_user.id)
        .order_by(Investment.investment_type, Investment.name)
    )
    return result.scalars().all()


@router.post("", response_model=InvestmentOut)
async def create_investment(
    data: InvestmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    # Auto-compute current_value if not provided
    units = payload.get("units") or Decimal("0")
    current_price = payload.get("current_price") or Decimal("0")
    payload["current_value"] = units * current_price
    if payload["current_value"] == 0 and payload.get("invested_amount"):
        payload["current_value"] = payload["invested_amount"]

    investment = Investment(user_id=current_user.id, **payload)
    db.add(investment)
    await db.commit()
    await db.refresh(investment)
    return investment


@router.patch("/{investment_id}", response_model=InvestmentOut)
async def update_investment(
    investment_id: uuid.UUID,
    data: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(Investment.id == investment_id, Investment.user_id == current_user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(inv, field, value)

    # Recalc pnl if price/units updated
    if "current_price" in updates or "units" in updates:
        inv.current_value = (inv.units or Decimal("0")) * (inv.current_price or Decimal("0"))
        inv.unrealized_pnl = inv.current_value - (inv.invested_amount or Decimal("0"))

    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/{investment_id}")
async def delete_investment(
    investment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(Investment.id == investment_id, Investment.user_id == current_user.id)
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    await db.delete(inv)
    await db.commit()
    return {"ok": True}


@router.get("/analytics/summary")
async def investment_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id)
    )
    investments = result.scalars().all()

    total_invested = sum(float(i.invested_amount or 0) for i in investments)
    total_current = sum(float(i.current_value or 0) for i in investments)
    total_pnl = total_current - total_invested
    pnl_pct = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    by_type: dict = {}
    for inv in investments:
        t = inv.investment_type
        if t not in by_type:
            by_type[t] = {"type": t, "invested": 0, "current": 0, "count": 0}
        by_type[t]["invested"] += float(inv.invested_amount or 0)
        by_type[t]["current"] += float(inv.current_value or 0)
        by_type[t]["count"] += 1

    return {
        "total_invested": total_invested,
        "total_current_value": total_current,
        "total_pnl": total_pnl,
        "pnl_pct": round(pnl_pct, 2),
        "by_type": list(by_type.values()),
    }
