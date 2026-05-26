from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uuid
from app.database import get_db
from app.utils.deps import get_current_user, require_write, DataAccessContext
from app.models.user import User
from app.models.transaction import Transaction, CategoryType, TransactionType
from app.models.card import CreditCard
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut, TransactionListOut

router = APIRouter()


@router.get("", response_model=TransactionListOut)
async def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    card_id: Optional[uuid.UUID] = None,
    statement_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    transaction_type: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    search: Optional[str] = None,
    is_emi: Optional[bool] = None,
    min_amount: Optional[Decimal] = None,
    max_amount: Optional[Decimal] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [Transaction.user_id == current_user.id, Transaction.is_excluded == False]

    if card_id:
        filters.append(Transaction.card_id == card_id)
    if statement_id:
        filters.append(Transaction.statement_id == statement_id)
    if category:
        filters.append(Transaction.category == category)
    if transaction_type:
        filters.append(Transaction.transaction_type == transaction_type)
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if is_emi is not None:
        filters.append(Transaction.is_emi == is_emi)
    if min_amount is not None:
        filters.append(Transaction.amount >= min_amount)
    if max_amount is not None:
        filters.append(Transaction.amount <= max_amount)
    if search:
        filters.append(
            or_(
                Transaction.description.ilike(f"%{search}%"),
                Transaction.merchant_name.ilike(f"%{search}%"),
            )
        )

    count_q = select(func.count()).select_from(Transaction).where(and_(*filters))
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    sum_q = select(func.sum(Transaction.amount)).where(and_(*filters))
    sum_result = await db.execute(sum_q)
    total_amount = sum_result.scalar() or Decimal(0)

    q = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.transaction_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    items = result.scalars().all()

    return TransactionListOut(
        items=items, total=total, total_amount=total_amount,
        page=page, page_size=page_size,
    )


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    payload: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    ctx: DataAccessContext = Depends(require_write),
):
    tx = Transaction(**payload.model_dump(), user_id=current_user.id, is_manual=True)
    db.add(tx)
    await db.flush()

    # ── Auto-update card outstanding / available when a transaction is linked to a card ──
    # Spending types increase outstanding (reduce available); payment/credit types do the reverse.
    if payload.card_id and not getattr(payload, 'is_excluded', False):
        card_res = await db.execute(
            select(CreditCard).where(
                CreditCard.id == payload.card_id,
                CreditCard.user_id == current_user.id,
            )
        )
        card = card_res.scalar_one_or_none()
        if card:
            _SPEND_TYPES  = {TransactionType.PURCHASE, TransactionType.EMI,
                              TransactionType.CASH_ADVANCE, TransactionType.FEE,
                              TransactionType.INTEREST}
            _CREDIT_TYPES = {TransactionType.PAYMENT, TransactionType.REFUND,
                              TransactionType.REWARD_REDEMPTION}
            amt = payload.amount
            if payload.transaction_type in _SPEND_TYPES:
                card.current_outstanding = (card.current_outstanding or Decimal(0)) + amt
                card.available_limit     = max(Decimal(0), (card.available_limit or Decimal(0)) - amt)
            elif payload.transaction_type in _CREDIT_TYPES:
                card.current_outstanding = max(Decimal(0), (card.current_outstanding or Decimal(0)) - amt)
                card.available_limit     = min(card.credit_limit,
                                               (card.available_limit or Decimal(0)) + amt)

    return tx


@router.get("/{tx_id}", response_model=TransactionOut)
async def get_transaction(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return tx


@router.patch("/{tx_id}", response_model=TransactionOut)
async def update_transaction(
    tx_id: uuid.UUID,
    payload: TransactionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(tx, field, value)
    return tx


@router.delete("/{tx_id}", status_code=204)
async def delete_transaction(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction).where(Transaction.id == tx_id, Transaction.user_id == current_user.id)
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)


@router.get("/analytics/category-breakdown")
async def category_breakdown(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(Transaction.category, func.sum(Transaction.amount).label("total"), func.count().label("count"))
        .where(and_(*filters))
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
    )
    result = await db.execute(q)
    rows = result.all()
    grand_total = sum(r.total for r in rows) or Decimal(1)

    return [
        {
            "category": r.category,
            "amount": float(r.total),
            "count": r.count,
            "percentage": round(float(r.total / grand_total * 100), 1),
        }
        for r in rows
    ]


@router.get("/analytics/monthly-trend")
async def monthly_trend(
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import text
    q = text("""
        SELECT
            TO_CHAR(transaction_date, 'YYYY-MM') AS month,
            SUM(CASE WHEN transaction_type = 'PURCHASE' THEN amount ELSE 0 END) AS spend,
            SUM(CASE WHEN transaction_type = 'PAYMENT' THEN amount ELSE 0 END) AS payments,
            SUM(CASE WHEN transaction_type = 'EMI' THEN amount ELSE 0 END) AS emi,
            SUM(CASE WHEN transaction_type IN ('FEE', 'INTEREST') THEN amount ELSE 0 END) AS fees
        FROM transactions
        WHERE user_id = :user_id
          AND is_excluded = false
          AND transaction_date >= NOW() - INTERVAL ':months months'
        GROUP BY month
        ORDER BY month DESC
        LIMIT :months
    """)
    result = await db.execute(q, {"user_id": current_user.id, "months": months})
    rows = result.fetchall()
    return [
        {
            "month": r.month,
            "spend": float(r.spend or 0),
            "payments": float(r.payments or 0),
            "emi": float(r.emi or 0),
            "fees": float(r.fees or 0),
        }
        for r in rows
    ]


# ── New Analytics Endpoints ────────────────────────────────────────────────────

@router.get("/analytics/spend-by-card")
async def spend_by_card(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Total spend grouped by card for the given date range."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)

    q = (
        select(
            Transaction.card_id,
            CreditCard.nickname,
            CreditCard.bank_name,
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .join(CreditCard, CreditCard.id == Transaction.card_id)
        .where(and_(*filters))
        .group_by(Transaction.card_id, CreditCard.nickname, CreditCard.bank_name)
        .order_by(func.sum(Transaction.amount).desc())
    )
    result = await db.execute(q)
    rows = result.all()
    grand_total = sum(r.total for r in rows) or Decimal(1)
    return [
        {
            "card_id": str(r.card_id),
            "card_name": r.nickname or r.bank_name or "Card",
            "bank_name": r.bank_name,
            "total": float(r.total),
            "count": r.count,
            "percentage": round(float(r.total / grand_total * 100), 1),
        }
        for r in rows
    ]


@router.get("/analytics/merchant-breakdown")
async def merchant_breakdown(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Top merchants by spend with optional card + date filters."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
        Transaction.merchant_name != None,
        Transaction.merchant_name != "",
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(
            Transaction.merchant_name,
            Transaction.category,
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(and_(*filters))
        .group_by(Transaction.merchant_name, Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(limit)
    )
    result = await db.execute(q)
    rows = result.all()
    grand_total = sum(r.total for r in rows) or Decimal(1)
    return [
        {
            "merchant": r.merchant_name,
            "category": r.category,
            "total": float(r.total),
            "count": r.count,
            "percentage": round(float(r.total / grand_total * 100), 1),
        }
        for r in rows
    ]


@router.get("/analytics/day-of-week")
async def day_of_week_spend(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Spend aggregated by day of week (0=Mon … 6=Sun)."""
    from sqlalchemy import text, bindparam
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(
            func.extract("dow", Transaction.transaction_date).label("dow"),
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(and_(*filters))
        .group_by(func.extract("dow", Transaction.transaction_date))
        .order_by(func.extract("dow", Transaction.transaction_date))
    )
    result = await db.execute(q)
    rows = result.all()
    day_names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    data = {int(r.dow): {"total": float(r.total), "count": r.count} for r in rows}
    return [
        {
            "dow": i,
            "day": day_names[i],
            "total": data.get(i, {}).get("total", 0),
            "count": data.get(i, {}).get("count", 0),
        }
        for i in range(7)
    ]


@router.get("/analytics/weekend-vs-weekday")
async def weekend_vs_weekday(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compare weekend spend vs weekday spend."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    # dow: 0=Sun, 6=Sat in PostgreSQL extract
    from sqlalchemy import case
    q = (
        select(
            func.sum(case(
                (func.extract("dow", Transaction.transaction_date).in_([0, 6]), Transaction.amount),
                else_=0
            )).label("weekend_total"),
            func.count(case(
                (func.extract("dow", Transaction.transaction_date).in_([0, 6]), 1),
                else_=None
            )).label("weekend_count"),
            func.sum(case(
                (func.extract("dow", Transaction.transaction_date).in_([1, 2, 3, 4, 5]), Transaction.amount),
                else_=0
            )).label("weekday_total"),
            func.count(case(
                (func.extract("dow", Transaction.transaction_date).in_([1, 2, 3, 4, 5]), 1),
                else_=None
            )).label("weekday_count"),
        )
        .where(and_(*filters))
    )
    result = await db.execute(q)
    r = result.one()
    wknd = float(r.weekend_total or 0)
    wkdy = float(r.weekday_total or 0)
    wknd_cnt = r.weekend_count or 0
    wkdy_cnt = r.weekday_count or 0
    total = wknd + wkdy or 1
    return {
        "weekend": {
            "total": wknd,
            "count": wknd_cnt,
            "avg_per_tx": round(wknd / wknd_cnt, 2) if wknd_cnt else 0,
            "percentage": round(wknd / total * 100, 1),
        },
        "weekday": {
            "total": wkdy,
            "count": wkdy_cnt,
            "avg_per_tx": round(wkdy / wkdy_cnt, 2) if wkdy_cnt else 0,
            "percentage": round(wkdy / total * 100, 1),
        },
    }


@router.get("/analytics/month-over-month")
async def month_over_month(
    months: int = Query(6, ge=2, le=24),
    card_id: Optional[uuid.UUID] = None,
    category: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Month-over-month spend comparison with % change."""
    from sqlalchemy import text
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if card_id:
        filters.append(Transaction.card_id == card_id)
    if category:
        filters.append(Transaction.category == category)

    q = (
        select(
            func.to_char(Transaction.transaction_date, "YYYY-MM").label("month"),
            func.sum(Transaction.amount).label("total"),
            func.count().label("count"),
        )
        .where(and_(*filters))
        .group_by(func.to_char(Transaction.transaction_date, "YYYY-MM"))
        .order_by(func.to_char(Transaction.transaction_date, "YYYY-MM").desc())
        .limit(months)
    )
    result = await db.execute(q)
    rows = list(reversed(result.all()))
    out = []
    for i, r in enumerate(rows):
        prev = rows[i - 1].total if i > 0 else None
        change_pct = round(float((r.total - prev) / prev * 100), 1) if prev else None
        out.append({
            "month": r.month,
            "total": float(r.total),
            "count": r.count,
            "change_pct": change_pct,
        })
    return out


@router.get("/analytics/large-transactions")
async def large_transactions(
    min_amount: float = Query(5000, ge=0),
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Transactions above a threshold amount."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.amount >= Decimal(str(min_amount)),
        Transaction.transaction_type == TransactionType.PURCHASE,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.amount.desc())
        .limit(limit)
    )
    result = await db.execute(q)
    txs = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "date": t.transaction_date.isoformat() if t.transaction_date else None,
            "description": t.description,
            "merchant_name": t.merchant_name,
            "amount": float(t.amount),
            "category": t.category,
            "card_id": str(t.card_id) if t.card_id else None,
        }
        for t in txs
    ]


@router.get("/analytics/refunds")
async def refunds_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """All refund and reversal transactions."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type == TransactionType.REFUND,
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.transaction_date.desc())
    )
    result = await db.execute(q)
    txs = result.scalars().all()
    total = sum(float(t.amount) for t in txs)
    return {
        "total_refunded": total,
        "count": len(txs),
        "transactions": [
            {
                "id": str(t.id),
                "date": t.transaction_date.isoformat() if t.transaction_date else None,
                "description": t.description,
                "merchant_name": t.merchant_name,
                "amount": float(t.amount),
                "category": t.category,
                "card_id": str(t.card_id) if t.card_id else None,
            }
            for t in txs
        ],
    }


@router.get("/analytics/hidden-charges")
async def hidden_charges_report(
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fee, interest and hidden charge transactions."""
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.is_excluded == False,
        Transaction.transaction_type.in_([TransactionType.FEE, TransactionType.INTEREST]),
    ]
    if date_from:
        filters.append(Transaction.transaction_date >= date_from)
    if date_to:
        filters.append(Transaction.transaction_date <= date_to)
    if card_id:
        filters.append(Transaction.card_id == card_id)

    q = (
        select(Transaction)
        .where(and_(*filters))
        .order_by(Transaction.amount.desc())
    )
    result = await db.execute(q)
    txs = result.scalars().all()
    total = sum(float(t.amount) for t in txs)
    return {
        "total_charges": total,
        "count": len(txs),
        "transactions": [
            {
                "id": str(t.id),
                "date": t.transaction_date.isoformat() if t.transaction_date else None,
                "description": t.description,
                "merchant_name": t.merchant_name,
                "amount": float(t.amount),
                "transaction_type": t.transaction_type,
                "card_id": str(t.card_id) if t.card_id else None,
            }
            for t in txs
        ],
    }
