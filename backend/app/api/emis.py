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


def _build_payments(emi: EMI, already_paid: int = 0) -> list[EMIPayment]:
    """Build installment schedule.  already_paid pre-marks the first N installments
    as paid so historical/imported EMIs don't start at zero."""
    from dateutil.relativedelta import relativedelta as _rd
    payments = []
    start = emi.start_date or emi.purchase_date
    # Use relativedelta (not timedelta) so due dates are exactly month-aligned
    # and match what create_emi stores in next_due_date.
    base = start.replace(day=min(start.day, 28))
    for i in range(1, emi.tenure_months + 1):
        due = base + _rd(months=i)
        pre_paid = i <= already_paid
        payments.append(EMIPayment(
            emi_id=emi.id,
            user_id=emi.user_id,
            installment_no=i,
            due_date=due,
            expected_amount=emi.monthly_emi,
            is_paid=pre_paid,
            paid_date=due if pre_paid else None,
            paid_amount=emi.monthly_emi if pre_paid else Decimal(0),
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
    # paid_months at creation: honour it so historical / imported EMIs start correctly.
    # _build_payments() uses emi.paid_months to pre-mark already-paid installments.
    initial_paid_months = int(data.pop("paid_months", None) or 0)

    total_interest = float(data["total_amount"]) - float(data["purchase_amount"])
    remaining_months = data["tenure_months"] - initial_paid_months
    # Use total_amount - pre-paid portion (not monthly_emi * months) to avoid
    # integer-rounding drift when monthly_emi doesn't divide evenly into total_amount
    pre_paid_amount = data["monthly_emi"] * initial_paid_months if initial_paid_months > 0 else Decimal(0)
    amount_remaining = max(Decimal(0), data["total_amount"] - pre_paid_amount)

    from dateutil.relativedelta import relativedelta
    end_date = start + relativedelta(months=data["tenure_months"])
    # next_due points to the first unpaid installment
    next_due = start + relativedelta(months=initial_paid_months + 1)

    emi = EMI(
        **data,
        user_id=current_user.id,
        total_interest=max(0, total_interest),
        paid_months=initial_paid_months,
        remaining_months=remaining_months,
        amount_remaining=amount_remaining,
        start_date=start,
        end_date=end_date,
        next_due_date=next_due,
    )
    db.add(emi)
    await db.flush()

    # Pass initial_paid_months explicitly — avoids async lazy-load of expired attribute
    payments = _build_payments(emi, already_paid=initial_paid_months)
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
        # Derive from total_amount not monthly_emi*months to avoid rounding drift
        paid_so_far = emi.monthly_emi * payload.paid_months
        emi.amount_remaining = max(Decimal(0), emi.total_amount - paid_so_far)
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

    # Accumulate — don't overwrite — so two partial payments can together satisfy an installment.
    previous_paid = payment.paid_amount or Decimal(0)
    payment.paid_amount = previous_paid + paid_amount
    payment.paid_date = paid_date or datetime.now(timezone.utc)
    payment.is_paid = payment.paid_amount >= payment.expected_amount
    payment.is_overdue = payment.paid_date > payment.due_date

    emi.amount_paid = (emi.amount_paid or Decimal(0)) + paid_amount
    emi.amount_remaining = max(Decimal(0), (emi.amount_remaining or emi.total_amount) - paid_amount)
    emi.last_collection_date = payment.paid_date

    # Recompute paid_months as the TRUE count of fully-paid installments (not installment_no)
    # This handles out-of-order payments correctly — e.g. if you pay #4 before #1,
    # paid_months should NOT jump to 4; it should reflect what's actually been paid.
    all_payments_res = await db.execute(
        select(EMIPayment).where(EMIPayment.emi_id == emi_id)
    )
    all_payments = all_payments_res.scalars().all()
    fully_paid_count = sum(1 for p in all_payments if p.is_paid)
    emi.paid_months = fully_paid_count
    emi.remaining_months = emi.tenure_months - fully_paid_count

    # next_due_date = due_date of the EARLIEST unpaid installment (not next sequential)
    unpaid = sorted(
        [p for p in all_payments if not p.is_paid],
        key=lambda p: p.installment_no,
    )
    if unpaid:
        emi.next_due_date = unpaid[0].due_date
    elif installment_no >= emi.tenure_months:
        emi.next_due_date = None  # all paid

    if emi.owner_type != EMIOwnerType.SELF:
        emi.amount_collected = (emi.amount_collected or Decimal(0)) + paid_amount

    if fully_paid_count >= emi.tenure_months:
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
