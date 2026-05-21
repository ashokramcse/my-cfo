from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.emi import EMI, EMIPayment, EMIStatus, EMIOwnerType
from app.models.friend import Friend
from app.schemas.emi import EMICreate, EMIUpdate, EMIOut, EMIPaymentCreate, EMIPaymentOut

router = APIRouter()


async def _refresh_friend_totals(db: AsyncSession, friend_id: uuid.UUID):
    """Recompute and persist aggregated totals for a friend after EMI changes."""
    result = await db.execute(
        select(
            func.sum(EMI.total_amount).label("total"),
            func.sum(EMI.amount_collected).label("collected"),
            func.count().label("count"),
        ).where(EMI.friend_id == friend_id, EMI.status == EMIStatus.ACTIVE)
    )
    row = result.one()
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


def _build_payments(emi: EMI) -> list[EMIPayment]:
    payments = []
    start = emi.start_date or emi.purchase_date
    for i in range(1, emi.tenure_months + 1):
        due = start.replace(day=min(start.day, 28)) + timedelta(days=30 * i)
        payments.append(EMIPayment(
            emi_id=emi.id,
            user_id=emi.user_id,
            installment_no=i,
            due_date=due,
            expected_amount=emi.monthly_emi,
            is_paid=i <= emi.paid_months,
            paid_date=due if i <= emi.paid_months else None,
            paid_amount=emi.monthly_emi if i <= emi.paid_months else Decimal(0),
        ))
    return payments


@router.get("", response_model=list[EMIOut])
async def list_emis(
    status: Optional[str] = None,
    owner_type: Optional[str] = None,
    card_id: Optional[uuid.UUID] = None,
    friend_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [EMI.user_id == current_user.id]
    if status:
        filters.append(EMI.status == status)
    if owner_type:
        filters.append(EMI.owner_type == owner_type)
    if card_id:
        filters.append(EMI.card_id == card_id)
    if friend_id:
        filters.append(EMI.friend_id == friend_id)

    q = (
        select(EMI)
        .where(and_(*filters))
        .options(selectinload(EMI.payments))
        .order_by(EMI.next_due_date.asc().nullslast())
    )
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=EMIOut, status_code=201)
async def create_emi(
    payload: EMICreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    start = data.pop("start_date", None) or data["purchase_date"]
    data.pop("end_date", None)
    data.pop("next_due_date", None)
    data.pop("total_interest", None)
    data.pop("remaining_months", None)
    data.pop("amount_remaining", None)
    data.pop("amount_paid", None)
    data.pop("paid_months", None)

    total_interest = float(data["total_amount"]) - float(data["purchase_amount"])
    remaining_months = data["tenure_months"]
    amount_remaining = data["total_amount"]

    from dateutil.relativedelta import relativedelta
    end_date = start + relativedelta(months=data["tenure_months"])
    next_due = start + relativedelta(months=1)

    emi = EMI(
        **data,
        user_id=current_user.id,
        total_interest=max(0, total_interest),
        remaining_months=remaining_months,
        amount_remaining=amount_remaining,
        start_date=start,
        end_date=end_date,
        next_due_date=next_due,
    )
    db.add(emi)
    await db.flush()

    payments = _build_payments(emi)
    for p in payments:
        db.add(p)

    if emi.friend_id:
        await _refresh_friend_totals(db, emi.friend_id)

    await db.commit()
    result = await db.execute(
        select(EMI).options(selectinload(EMI.payments)).where(EMI.id == emi.id)
    )
    return result.scalar_one()


@router.get("/{emi_id}", response_model=EMIOut)
async def get_emi(
    emi_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EMI).where(EMI.id == emi_id, EMI.user_id == current_user.id)
        .options(selectinload(EMI.payments))
    )
    emi = result.scalar_one_or_none()
    if not emi:
        raise HTTPException(status_code=404, detail="EMI not found")
    return emi


@router.patch("/{emi_id}", response_model=EMIOut)
async def update_emi(
    emi_id: uuid.UUID,
    payload: EMIUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EMI).where(EMI.id == emi_id, EMI.user_id == current_user.id)
        .options(selectinload(EMI.payments))
    )
    emi = result.scalar_one_or_none()
    if not emi:
        raise HTTPException(status_code=404, detail="EMI not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(emi, field, value)

    if payload.paid_months is not None:
        emi.remaining_months = emi.tenure_months - payload.paid_months
        emi.amount_remaining = emi.monthly_emi * emi.remaining_months
        if payload.paid_months >= emi.tenure_months:
            emi.status = EMIStatus.COMPLETED

    if emi.friend_id:
        await _refresh_friend_totals(db, emi.friend_id)
    return emi


@router.delete("/{emi_id}", status_code=204)
async def delete_emi(
    emi_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EMI).where(EMI.id == emi_id, EMI.user_id == current_user.id)
    )
    emi = result.scalar_one_or_none()
    if not emi:
        raise HTTPException(status_code=404, detail="EMI not found")
    friend_id = emi.friend_id
    await db.delete(emi)
    if friend_id:
        await db.flush()
        await _refresh_friend_totals(db, friend_id)


@router.post("/{emi_id}/record-payment", response_model=EMIPaymentOut)
async def record_payment(
    emi_id: uuid.UUID,
    installment_no: int,
    paid_amount: Decimal,
    paid_date: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EMI).where(EMI.id == emi_id, EMI.user_id == current_user.id)
        .options(selectinload(EMI.payments))
    )
    emi = result.scalar_one_or_none()
    if not emi:
        raise HTTPException(status_code=404, detail="EMI not found")

    payment_result = await db.execute(
        select(EMIPayment).where(EMIPayment.emi_id == emi_id, EMIPayment.installment_no == installment_no)
    )
    payment = payment_result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Installment not found")

    payment.paid_amount = paid_amount
    payment.paid_date = paid_date or datetime.now(timezone.utc)
    payment.is_paid = True
    payment.is_overdue = payment.paid_date > payment.due_date

    emi.paid_months = installment_no
    emi.amount_paid = (emi.amount_paid or Decimal(0)) + paid_amount
    emi.amount_remaining = max(Decimal(0), (emi.amount_remaining or emi.total_amount) - paid_amount)
    emi.remaining_months = emi.tenure_months - installment_no
    emi.last_collection_date = payment.paid_date

    if emi.owner_type != EMIOwnerType.SELF:
        emi.amount_collected = (emi.amount_collected or Decimal(0)) + paid_amount

    if installment_no >= emi.tenure_months:
        emi.status = EMIStatus.COMPLETED

    if emi.friend_id:
        await _refresh_friend_totals(db, emi.friend_id)

    return payment


@router.get("/analytics/forecast")
async def emi_forecast(
    months_ahead: int = Query(6, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(EMI).where(EMI.user_id == current_user.id, EMI.status == EMIStatus.ACTIVE)
        .options(selectinload(EMI.payments))
    )
    emis = result.scalars().all()

    from datetime import date
    from dateutil.relativedelta import relativedelta
    today = datetime.now(timezone.utc)
    forecast = []

    for m in range(months_ahead):
        month = today + relativedelta(months=m)
        month_key = month.strftime("%Y-%m")
        total = Decimal(0)
        emi_list = []

        for emi in emis:
            if emi.start_date and emi.end_date:
                # Compare year-month ordinals to avoid datetime/timezone edge cases
                start_ord = emi.start_date.year * 12 + emi.start_date.month
                end_ord = emi.end_date.year * 12 + emi.end_date.month
                month_ord = month.year * 12 + month.month
                if start_ord <= month_ord <= end_ord:
                    total += emi.monthly_emi
                    emi_list.append({"id": str(emi.id), "product": emi.product_name, "amount": float(emi.monthly_emi)})

        forecast.append({"month": month_key, "total": float(total), "emis": emi_list})

    return forecast
