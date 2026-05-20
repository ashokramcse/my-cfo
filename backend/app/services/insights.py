"""
AI-powered financial insight generation engine.
Rule-based insights + optional Ollama LLM integration.
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List
import logging

logger = logging.getLogger(__name__)


INSIGHT_TEMPLATES = {
    "OVERSPEND_FOOD": {
        "type": "OVERSPEND",
        "severity": "WARNING",
        "title": "Overspending on Food & Dining",
        "body": "You spent ₹{amount} on food this month, which is {pct}% higher than your 3-month average. Consider meal planning to reduce this.",
    },
    "HIGH_UTILIZATION": {
        "type": "UTILIZATION_RISK",
        "severity": "CRITICAL",
        "title": "Credit Utilization Too High",
        "body": "Your {card} utilization is at {pct}%. High utilization can hurt your credit score. Try to keep it below 30%.",
    },
    "EMI_BURDEN": {
        "type": "EMI_RISK",
        "severity": "WARNING",
        "title": "Heavy EMI Burden Detected",
        "body": "Your total monthly EMI of ₹{amount} is consuming {pct}% of your typical monthly spend. This may strain cash flow.",
    },
    "FRIEND_OVERDUE": {
        "type": "FRIEND_RISK",
        "severity": "WARNING",
        "title": "Friend EMI Payment Overdue",
        "body": "{name}'s EMI payment of ₹{amount} for {product} is overdue by {days} days. Consider sending a reminder.",
    },
    "INTEREST_LEAKAGE": {
        "type": "INTEREST_ALERT",
        "severity": "WARNING",
        "title": "Interest Charges Detected",
        "body": "You were charged ₹{amount} in interest on {card}. Paying the full outstanding before due date eliminates this.",
    },
    "DUE_DATE_UPCOMING": {
        "type": "DUE_DATE",
        "severity": "INFO",
        "title": "Payment Due Soon",
        "body": "₹{amount} is due on {card} in {days} days. Auto-pay setup can help you avoid late fees.",
    },
    "CASHBACK_OPPORTUNITY": {
        "type": "OPPORTUNITY",
        "severity": "INFO",
        "title": "Optimize Cashback",
        "body": "You spent ₹{amount} on {category} using {card}. Your {better_card} offers better rewards for this category.",
    },
    "SUBSCRIPTION_DETECTED": {
        "type": "SUBSCRIPTION",
        "severity": "INFO",
        "title": "Recurring Subscription Detected",
        "body": "Detected {count} active subscriptions totalling ₹{amount}/month. Review if all are in use.",
    },
}


async def generate_insights_for_user(user_id: str, db) -> List[dict]:
    """Generate rule-based insights. Called by Celery worker."""
    from sqlalchemy import select, func, and_
    from app.models.transaction import Transaction, TransactionType, CategoryType
    from app.models.card import CreditCard
    from app.models.emi import EMI, EMIStatus, EMIOwnerType
    from app.models.emi import EMIPayment
    from app.models.friend import Friend
    from app.models.insight import Insight
    import uuid

    insights_to_create = []
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    prev_month = (month_start - timedelta(days=1)).replace(day=1)

    # 1. High utilization alert
    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == user_id, CreditCard.status == "ACTIVE")
    )
    for card in cards_result.scalars().all():
        if card.credit_limit > 0:
            util = float(card.current_outstanding / card.credit_limit * 100)
            if util > 70:
                insights_to_create.append({
                    "insight_type": "UTILIZATION_RISK",
                    "severity": "CRITICAL" if util > 90 else "WARNING",
                    "title": INSIGHT_TEMPLATES["HIGH_UTILIZATION"]["title"],
                    "body": INSIGHT_TEMPLATES["HIGH_UTILIZATION"]["body"].format(
                        card=card.nickname, pct=round(util, 1)
                    ),
                    "metadata": {"card_id": str(card.id), "utilization": util},
                })

    # 2. EMI burden analysis
    emi_result = await db.execute(
        select(func.sum(EMI.monthly_emi)).where(
            EMI.user_id == user_id, EMI.status == EMIStatus.ACTIVE
        )
    )
    total_emi = emi_result.scalar() or Decimal(0)

    spend_result = await db.execute(
        select(func.avg(Transaction.amount)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= prev_month,
            Transaction.transaction_date < month_start,
            Transaction.transaction_type == TransactionType.PURCHASE,
        )
    )
    avg_monthly = spend_result.scalar() or Decimal(1)

    if total_emi > 0 and avg_monthly > 0:
        emi_pct = float(total_emi / avg_monthly * 100)
        if emi_pct > 40:
            insights_to_create.append({
                "insight_type": "EMI_RISK",
                "severity": "WARNING",
                "title": INSIGHT_TEMPLATES["EMI_BURDEN"]["title"],
                "body": INSIGHT_TEMPLATES["EMI_BURDEN"]["body"].format(
                    amount=int(total_emi), pct=round(emi_pct, 1)
                ),
                "metadata": {"total_emi": float(total_emi), "pct": emi_pct},
            })

    # 3. Food overspend
    food_current = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= month_start,
            Transaction.category.in_(["FOOD", "DINING", "GROCERIES"]),
            Transaction.transaction_type == TransactionType.PURCHASE,
        )
    )
    food_amount = food_current.scalar() or Decimal(0)

    food_prev = await db.execute(
        select(func.sum(Transaction.amount)).where(
            Transaction.user_id == user_id,
            Transaction.transaction_date >= prev_month,
            Transaction.transaction_date < month_start,
            Transaction.category.in_(["FOOD", "DINING", "GROCERIES"]),
            Transaction.transaction_type == TransactionType.PURCHASE,
        )
    )
    food_prev_amount = food_prev.scalar() or Decimal(1)

    if food_prev_amount > 0:
        food_pct = float((food_amount - food_prev_amount) / food_prev_amount * 100)
        if food_pct > 30 and food_amount > 2000:
            insights_to_create.append({
                "insight_type": "OVERSPEND",
                "severity": "WARNING",
                "title": INSIGHT_TEMPLATES["OVERSPEND_FOOD"]["title"],
                "body": INSIGHT_TEMPLATES["OVERSPEND_FOOD"]["body"].format(
                    amount=int(food_amount), pct=round(food_pct, 1)
                ),
                "metadata": {"food_amount": float(food_amount), "pct": food_pct},
            })

    # 4. Upcoming dues (3 days)
    cards_result2 = await db.execute(
        select(CreditCard).where(CreditCard.user_id == user_id, CreditCard.status == "ACTIVE")
    )
    for card in cards_result2.scalars().all():
        due_day = card.due_date_day
        candidate = now.replace(day=min(due_day, 28))
        if candidate < now:
            from dateutil.relativedelta import relativedelta
            candidate += relativedelta(months=1)
        days_until = (candidate - now).days
        if 0 <= days_until <= 5 and card.current_outstanding > 0:
            insights_to_create.append({
                "insight_type": "DUE_DATE",
                "severity": "INFO",
                "title": INSIGHT_TEMPLATES["DUE_DATE_UPCOMING"]["title"],
                "body": INSIGHT_TEMPLATES["DUE_DATE_UPCOMING"]["body"].format(
                    amount=int(card.current_outstanding), card=card.nickname, days=days_until
                ),
                "metadata": {"card_id": str(card.id), "days": days_until},
            })

    # Save insights (skip duplicates from same day)
    created = []
    for data in insights_to_create:
        existing = await db.execute(
            select(Insight).where(
                Insight.user_id == user_id,
                Insight.insight_type == data["insight_type"],
                Insight.created_at >= now.replace(hour=0, minute=0, second=0),
            )
        )
        if not existing.scalar_one_or_none():
            insight = Insight(user_id=user_id, **data)
            db.add(insight)
            created.append(data)

    return created
