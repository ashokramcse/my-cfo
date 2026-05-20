from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from typing import Optional
from datetime import datetime
from decimal import Decimal
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.transaction import Transaction, CategoryType, TransactionType
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
):
    tx = Transaction(**payload.model_dump(), user_id=current_user.id, is_manual=True)
    db.add(tx)
    await db.flush()
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
