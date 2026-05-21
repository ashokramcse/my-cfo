from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from decimal import Decimal
from datetime import datetime

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.bank_account import BankAccount
from app.models.investment import Investment
from app.models.loan import Loan
from app.models.asset import Asset
from app.models.card import CreditCard
from app.models.net_worth import NetWorthSnapshot

router = APIRouter()


async def _compute_net_worth(db: AsyncSession, user_id) -> dict:
    """Calculate current net worth from all sources."""
    bank_res = await db.execute(select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.is_active == True))
    bank_balance = sum(float(a.current_balance or 0) for a in bank_res.scalars().all())

    inv_res = await db.execute(select(Investment).where(Investment.user_id == user_id))
    investment_value = sum(float(i.current_value or 0) for i in inv_res.scalars().all())
    total_invested = sum(float(i.invested_amount or 0) for i in (await db.execute(select(Investment).where(Investment.user_id == user_id))).scalars().all())

    asset_res = await db.execute(select(Asset).where(Asset.user_id == user_id))
    assets = asset_res.scalars().all()
    asset_value = sum(float(a.current_value or 0) for a in assets)

    loan_res = await db.execute(select(Loan).where(Loan.user_id == user_id, Loan.status == "ACTIVE"))
    loan_outstanding = sum(float(l.outstanding_balance or 0) for l in loan_res.scalars().all())

    card_res = await db.execute(select(CreditCard).where(CreditCard.user_id == user_id))
    cc_outstanding = sum(float(c.current_outstanding or 0) for c in card_res.scalars().all())

    total_assets = bank_balance + investment_value + asset_value
    total_liabilities = loan_outstanding + cc_outstanding
    net_worth = total_assets - total_liabilities

    return {
        "bank_balance": bank_balance,
        "investment_value": investment_value,
        "total_invested": total_invested,
        "investment_pnl": investment_value - total_invested,
        "asset_value": asset_value,
        "total_assets": total_assets,
        "credit_card_outstanding": cc_outstanding,
        "loan_outstanding": loan_outstanding,
        "total_liabilities": total_liabilities,
        "net_worth": net_worth,
    }


@router.get("/current")
async def get_current_net_worth(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = await _compute_net_worth(db, current_user.id)

    # Get last snapshot for change calculation
    last_snap = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    last = last_snap.scalar_one_or_none()
    if last:
        prev_nw = float(last.net_worth or 0)
        data["change_amount"] = data["net_worth"] - prev_nw
        data["change_pct"] = ((data["net_worth"] - prev_nw) / abs(prev_nw) * 100) if prev_nw != 0 else 0
    else:
        data["change_amount"] = 0
        data["change_pct"] = 0

    return data


@router.post("/snapshot")
async def take_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Take a manual net worth snapshot (also called by scheduler)."""
    data = await _compute_net_worth(db, current_user.id)

    last_snap = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    last = last_snap.scalar_one_or_none()
    prev_nw = float(last.net_worth or 0) if last else 0
    change = data["net_worth"] - prev_nw
    change_pct = (change / abs(prev_nw) * 100) if prev_nw != 0 else 0

    snap = NetWorthSnapshot(
        user_id=current_user.id,
        bank_balance=data["bank_balance"],
        investment_value=data["investment_value"],
        asset_value=data["asset_value"],
        total_assets=data["total_assets"],
        credit_card_outstanding=data["credit_card_outstanding"],
        loan_outstanding=data["loan_outstanding"],
        total_liabilities=data["total_liabilities"],
        net_worth=data["net_worth"],
        change_amount=change,
        change_pct=change_pct,
    )
    db.add(snap)
    await db.commit()
    await db.refresh(snap)
    return {"ok": True, "net_worth": data["net_worth"], "snapshot_id": str(snap.id)}


@router.get("/history")
async def net_worth_history(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(months * 4)  # ~weekly snapshots
    )
    snaps = result.scalars().all()
    return [
        {
            "date": s.snapshot_date.isoformat(),
            "net_worth": float(s.net_worth or 0),
            "total_assets": float(s.total_assets or 0),
            "total_liabilities": float(s.total_liabilities or 0),
            "change_amount": float(s.change_amount or 0),
            "change_pct": float(s.change_pct or 0),
        }
        for s in reversed(snaps)
    ]
