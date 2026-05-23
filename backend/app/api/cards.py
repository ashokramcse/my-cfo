from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from datetime import datetime, timedelta, timezone
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.card import CreditCard
from app.models.transaction import Transaction, CategoryType
from app.schemas.card import CardCreate, CardUpdate, CardOut, CardListOut
from app.utils.enum_utils import ev

router = APIRouter()


@router.get("", response_model=CardListOut)
async def list_cards(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(CreditCard).where(CreditCard.user_id == current_user.id)
    if status:
        q = q.where(CreditCard.status == status)
    q = q.order_by(CreditCard.created_at.desc())
    result = await db.execute(q)
    cards = result.scalars().all()
    return CardListOut(items=cards, total=len(cards))


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
async def create_card(
    payload: CardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = CreditCard(**payload.model_dump(), user_id=current_user.id)
    # available_limit = credit_limit minus any existing outstanding balance
    card.available_limit = payload.credit_limit - payload.current_outstanding
    db.add(card)
    await db.flush()
    return card


@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.patch("/{card_id}", response_model=CardOut)
async def update_card(
    card_id: uuid.UUID,
    payload: CardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(card, field, value)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.delete(card)


@router.get("/analytics/intelligence")
async def cards_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Portfolio-level credit card intelligence — utilization, spend, insights."""
    cards_res = await db.execute(
        select(CreditCard).where(CreditCard.user_id == current_user.id)
    )
    cards = cards_res.scalars().all()

    total_limit       = sum(float(c.credit_limit or 0) for c in cards)
    total_outstanding = sum(float(c.current_outstanding or 0) for c in cards)
    total_available   = sum(float(c.available_limit or 0) for c in cards)
    overall_util      = round(total_outstanding / total_limit * 100, 1) if total_limit > 0 else 0

    # 30-day spending from transactions
    thirty_ago = datetime.now(timezone.utc) - timedelta(days=30)
    spend_res = await db.execute(
        select(func.sum(Transaction.amount))
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= thirty_ago,
        )
    )
    monthly_spend = float(spend_res.scalar() or 0)

    # Spending by category
    cat_res = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"))
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= thirty_ago,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(6)
    )
    top_categories = [
        {"category": ev(r.category), "amount": float(r.total)}
        for r in cat_res
    ]

    # Per-card details
    card_cards = []
    for c in cards:
        util = round(float(c.current_outstanding or 0) / float(c.credit_limit) * 100, 1) if c.credit_limit else 0
        util_status = "GOOD" if util < 30 else "WARNING" if util < 70 else "CRITICAL"
        days_to_due = None
        if c.due_date_day:
            from datetime import date
            today = date.today()
            due = today.replace(day=c.due_date_day)
            if due < today:
                import calendar
                last_day = calendar.monthrange(today.year, today.month + 1 if today.month < 12 else 1)[1]
                due = (today.replace(day=1) + timedelta(days=32)).replace(day=c.due_date_day)
            days_to_due = (due - today).days

        card_cards.append({
            "id":                  str(c.id),
            "nickname":            c.nickname,
            "bank_name":           c.bank_name,
            "last_four":           c.last_four,
            "credit_limit":        float(c.credit_limit or 0),
            "current_outstanding": float(c.current_outstanding or 0),
            "available_limit":     float(c.available_limit or 0),
            "utilization_pct":     util,
            "utilization_status":  util_status,
            "due_date_day":        c.due_date_day,
            "days_to_due":         days_to_due,
            "billing_cycle_day":   c.billing_cycle_day,
            "annual_fee":          float(c.annual_fee or 0),
            "reward_program":      c.reward_program,
            "card_color":          c.card_color,
        })

    # Insights
    insights = []
    if overall_util > 70:
        insights.append({
            "severity": "CRITICAL",
            "title": f"High CC Utilization ({overall_util:.0f}%)",
            "body": "Credit utilization above 70% severely impacts your credit score. "
                    "Pay down outstanding balances before your next billing cycle.",
            "action": "cards",
        })
    elif overall_util > 30:
        insights.append({
            "severity": "WARNING",
            "title": f"CC Utilization at {overall_util:.0f}%",
            "body": "Keep utilization below 30% for a healthy credit score. "
                    "Consider spreading spending across cards or making mid-cycle payments.",
            "action": "cards",
        })

    maxed = [c for c in card_cards if c["utilization_pct"] >= 90]
    if maxed:
        insights.append({
            "severity": "CRITICAL",
            "title": f"{len(maxed)} Card(s) Nearly Maxed Out",
            "body": f"{', '.join(c['nickname'] for c in maxed[:2])} {'are' if len(maxed) > 1 else 'is'} "
                    "near limit. This blocks emergency spend capacity and hurts credit score.",
            "action": "cards",
        })

    due_soon = [c for c in card_cards if c["days_to_due"] is not None and 0 <= c["days_to_due"] <= 5]
    if due_soon:
        insights.append({
            "severity": "WARNING",
            "title": f"Payment Due in {min(c['days_to_due'] for c in due_soon)} Day(s)",
            "body": f"{', '.join(c['nickname'] for c in due_soon[:2])} — missing the due date triggers "
                    "late fees and interest. Pay at least the minimum now.",
            "action": "cards",
        })

    return {
        "total_limit":        round(total_limit, 2),
        "total_outstanding":  round(total_outstanding, 2),
        "total_available":    round(total_available, 2),
        "overall_utilization": overall_util,
        "monthly_spend":      round(monthly_spend, 2),
        "card_count":         len(cards),
        "top_categories":     top_categories,
        "cards":              card_cards,
        "insights":           insights,
    }


@router.get("/{card_id}/utilization")
async def card_utilization(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    utilization = float(card.current_outstanding / card.credit_limit * 100) if card.credit_limit else 0
    return {
        "card_id": card_id,
        "credit_limit": float(card.credit_limit),
        "current_outstanding": float(card.current_outstanding),
        "available_limit": float(card.available_limit),
        "utilization_pct": round(utilization, 2),
        "status": "GOOD" if utilization < 30 else "WARNING" if utilization < 70 else "CRITICAL",
    }
