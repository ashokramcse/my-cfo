from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from typing import Optional
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.card import CreditCard
from app.models.transaction import Transaction, TransactionType
from app.models.emi import EMI, EMIStatus, EMIOwnerType
from app.models.friend import Friend
from app.models.statement import Statement
from app.schemas.report import DashboardStats, CardSummary, EMISummary, FriendReceivable, CategorySpend, MonthlyTrend

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Cards
    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == current_user.id, CreditCard.status == "ACTIVE")
    )
    cards = cards_result.scalars().all()

    total_outstanding = sum(c.current_outstanding for c in cards)
    total_limit = sum(c.credit_limit for c in cards)
    total_available = sum(c.available_limit for c in cards)
    utilization = float(total_outstanding / total_limit * 100) if total_limit else 0

    # Monthly spend
    spend_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_type == TransactionType.PURCHASE,
            Transaction.is_excluded == False,
        )
    )
    monthly_spend = spend_result.scalar() or Decimal(0)

    # Monthly payments
    pay_result = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_type == TransactionType.PAYMENT,
        )
    )
    monthly_payments = pay_result.scalar() or Decimal(0)

    # EMI summary
    emis_result = await db.execute(
        select(EMI).where(EMI.user_id == current_user.id, EMI.status == EMIStatus.ACTIVE)
    )
    emis = emis_result.scalars().all()

    monthly_emi = sum(e.monthly_emi for e in emis)
    emi_summary = EMISummary(
        active_count=len(emis),
        total_monthly=monthly_emi,
        total_outstanding=sum(e.amount_remaining or Decimal(0) for e in emis),
        self_emis=sum(1 for e in emis if e.owner_type == EMIOwnerType.SELF),
        friend_emis=sum(1 for e in emis if e.owner_type == EMIOwnerType.FRIEND),
        family_emis=sum(1 for e in emis if e.owner_type == EMIOwnerType.FAMILY),
    )

    # Upcoming dues
    upcoming_dues = []
    next_due_date = None
    next_due_amount = Decimal(0)
    for card in sorted(cards, key=lambda c: c.due_date_day):
        day = card.due_date_day
        candidate = now.replace(day=min(day, 28))
        if candidate < now:
            from dateutil.relativedelta import relativedelta
            candidate = candidate + relativedelta(months=1)
        if next_due_date is None or candidate < next_due_date:
            next_due_date = candidate
            next_due_amount = card.total_due if hasattr(card, 'total_due') else card.current_outstanding

        upcoming_dues.append(CardSummary(
            card_id=str(card.id),
            nickname=card.nickname,
            bank_name=card.bank_name,
            outstanding=card.current_outstanding,
            utilization_pct=Decimal(str(round(float(card.current_outstanding / card.credit_limit * 100) if card.credit_limit else 0, 1))),
            next_due=candidate,
            min_due=Decimal(0),
        ))

    # Friends
    friends_result = await db.execute(
        select(Friend).where(Friend.user_id == current_user.id, Friend.total_pending > 0)
        .order_by(Friend.total_pending.desc()).limit(5)
    )
    friends = friends_result.scalars().all()

    friend_receivables = [
        FriendReceivable(
            friend_id=str(f.id),
            name=f.name,
            total_pending=f.total_pending,
            overdue_count=0,
            next_due=None,
        )
        for f in friends
    ]
    total_receivables = sum(f.total_pending for f in friends)

    # Cashback & interest
    cb_result = await db.execute(
        select(func.sum(Transaction.cashback_amount)).where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= month_start,
        )
    )
    cashback_month = cb_result.scalar() or Decimal(0)

    # Reward points
    rp_total = sum(c.total_reward_points for c in cards)

    # Category spending (this month)
    cat_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label("total"), func.count().label("cnt"))
        .where(
            Transaction.user_id == current_user.id,
            Transaction.transaction_date >= month_start,
            Transaction.transaction_type == TransactionType.PURCHASE,
            Transaction.is_excluded == False,
        )
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(8)
    )
    cat_rows = cat_result.all()
    grand = sum(r.total for r in cat_rows) or Decimal(1)
    category_spending = [
        CategorySpend(
            category=r.category,
            amount=r.total,
            count=r.cnt,
            percentage=Decimal(str(round(float(r.total / grand * 100), 1))),
        )
        for r in cat_rows
    ]

    # Monthly trend (6 months)
    trend_result = await db.execute(text("""
        SELECT
            TO_CHAR(transaction_date, 'YYYY-MM') AS month,
            SUM(CASE WHEN transaction_type = 'PURCHASE' THEN amount ELSE 0 END) AS spend,
            SUM(CASE WHEN transaction_type = 'PAYMENT' THEN amount ELSE 0 END) AS payments,
            SUM(CASE WHEN transaction_type = 'EMI' THEN amount ELSE 0 END) AS emi,
            SUM(CASE WHEN transaction_type IN ('FEE', 'INTEREST') THEN amount ELSE 0 END) AS fees
        FROM transactions
        WHERE user_id = :uid AND is_excluded = false
          AND transaction_date >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month DESC
    """), {"uid": current_user.id})
    trend_rows = trend_result.fetchall()
    monthly_trends = [
        MonthlyTrend(
            month=r.month,
            spend=r.spend or Decimal(0),
            payments=r.payments or Decimal(0),
            emi=r.emi or Decimal(0),
            fees=r.fees or Decimal(0),
        )
        for r in trend_rows
    ]

    # Unread insights
    from app.models.insight import Insight
    insight_result = await db.execute(
        select(func.count()).select_from(Insight).where(
            Insight.user_id == current_user.id, Insight.is_read == False
        )
    )
    unread = insight_result.scalar() or 0

    return DashboardStats(
        total_outstanding=total_outstanding,
        total_credit_limit=total_limit,
        total_available=total_available,
        utilization_pct=Decimal(str(round(utilization, 1))),
        monthly_spend=monthly_spend,
        monthly_payments=monthly_payments,
        monthly_emi_burden=monthly_emi,
        upcoming_dues=upcoming_dues,
        next_due_date=next_due_date,
        next_due_amount=next_due_amount,
        emi_summary=emi_summary,
        friend_receivables=friend_receivables,
        total_receivables=total_receivables,
        cashback_earned_month=cashback_month,
        interest_paid_month=Decimal(0),
        reward_points_balance=rp_total,
        monthly_trends=monthly_trends,
        category_spending=category_spending,
        unread_insights=unread,
    )


@router.get("/spending")
async def spending_report(
    date_from: datetime = Query(default_factory=lambda: datetime.now(timezone.utc).replace(day=1)),
    date_to: datetime = Query(default_factory=lambda: datetime.now(timezone.utc)),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= date_from,
        Transaction.transaction_date <= date_to,
        Transaction.is_excluded == False,
    ]

    result = await db.execute(
        select(func.sum(Transaction.amount), func.count())
        .where(and_(*filters, Transaction.transaction_type == TransactionType.PURCHASE))
    )
    row = result.one()
    total_spend = row[0] or Decimal(0)
    total_tx = row[1]

    # Top merchants
    merchants = await db.execute(
        select(Transaction.merchant_name, func.sum(Transaction.amount).label("total"), func.count().label("cnt"))
        .where(and_(*filters, Transaction.transaction_type == TransactionType.PURCHASE))
        .group_by(Transaction.merchant_name)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(10)
    )

    return {
        "period_from": date_from.isoformat(),
        "period_to": date_to.isoformat(),
        "total_spend": float(total_spend),
        "total_transactions": total_tx,
        "top_merchants": [
            {"merchant": r.merchant_name, "total": float(r.total), "count": r.cnt}
            for r in merchants.all()
        ],
    }
