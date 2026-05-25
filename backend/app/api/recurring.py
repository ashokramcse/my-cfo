"""
Recurring Payments & Commitments Engine
========================================
Aggregates recurring financial commitments from existing tables:
  - Investments (SIPs)
  - EMIs (credit card EMIs)
  - Loans (loan EMIs)
  - Insurance (premiums)
  - BankTransactions (detected subscriptions & utilities)
  - IncomeSources (recurring income)
  - Friends/EMI (lending repayments)

No separate database model — everything is computed on-the-fly.
"""

from __future__ import annotations

import math
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bank_transaction import BankTransaction, BankTxType
from app.models.emi import EMI, EMIOwnerType, EMIStatus
from app.models.income import IncomeSource
from app.models.insurance import Insurance, PremiumFrequency
from app.models.investment import Investment, SIPStatus
from app.models.loan import Loan, LoanStatus
from app.models.user import User
from app.utils.deps import get_current_user
from app.utils.enum_utils import ev

router = APIRouter()

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

KNOWN_SUBSCRIPTION_KEYWORDS: List[str] = [
    "netflix",
    "spotify",
    "amazon prime",
    "hotstar",
    "zee5",
    "sonyliv",
    "youtube premium",
    "swiggy",
    "zomato",
    "notion",
    "slack",
    "github",
    "google one",
    "icloud",
    "dropbox",
    "adobe",
    "microsoft 365",
    "gym",
    "fitness",
]

UTILITY_KEYWORDS: List[str] = [
    "electricity",
    "tata power",
    "bescom",
    "msedcl",
    "torrent power",
    "water",
    "bwssb",
    "jal board",
    "internet",
    "broadband",
    "airtel",
    "jio",
    "vi ",
    "vodafone",
    "bsnl",
    "act fibernet",
    "hathway",
    "d2h",
    "tata sky",
    "dish tv",
    "mobile recharge",
    "gas",
    "indane",
    "hp gas",
    "bharat gas",
]

DEFAULT_MONTHLY_INCOME = 50_000.0

# ---------------------------------------------------------------------------
# Helper: frequency multipliers for monthly equivalent
# ---------------------------------------------------------------------------

FREQ_TO_MONTHLY: Dict[str, float] = {
    "MONTHLY": 1.0,
    "QUARTERLY": 1 / 3,
    "HALF_YEARLY": 1 / 6,
    "YEARLY": 1 / 12,
    "SINGLE": 0.0,
    "WEEKLY": 52 / 12,
    "FORTNIGHTLY": 26 / 12,
}


def to_monthly(amount: float, frequency: str) -> float:
    return amount * FREQ_TO_MONTHLY.get(frequency, 1.0)


def to_annual(monthly: float) -> float:
    return monthly * 12


# ---------------------------------------------------------------------------
# Helper: next occurrence of a day-of-month date
# ---------------------------------------------------------------------------

def next_occurrence(day: int, reference: date) -> date:
    """Return the next date on which `day` falls, on or after `reference`."""
    day = max(1, min(day, 28))
    candidate = reference.replace(day=day)
    if candidate < reference:
        # Roll forward one month
        month = reference.month + 1
        year = reference.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        candidate = date(year, month, day)
    return candidate


def add_months(d: date, n: int) -> date:
    month = d.month + n
    year = d.year + (month - 1) // 12
    month = ((month - 1) % 12) + 1
    day = min(d.day, 28)
    return date(year, month, day)


# ---------------------------------------------------------------------------
# Helper: build a RecurringItem dict
# ---------------------------------------------------------------------------

def make_item(
    *,
    id: str,
    name: str,
    amount: float,
    frequency: str,
    next_date: Optional[date],
    source: str,
    source_id: str,
    status: str,
    emoji: str,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "id": id,
        "name": name,
        "amount": round(amount, 2),
        "frequency": frequency,
        "next_date": next_date.isoformat() if next_date else None,
        "source": source,
        "source_id": source_id,
        "status": status,
        "emoji": emoji,
        "monthly_equivalent": round(to_monthly(amount, frequency), 2),
        **(metadata or {}),
    }


# ---------------------------------------------------------------------------
# Data fetchers
# ---------------------------------------------------------------------------

async def fetch_investment_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Investment).where(
            and_(
                Investment.user_id == user_id,
                Investment.is_sip == True,
                Investment.sip_amount > 0,
            )
        )
    )
    investments = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for inv in investments:
        sip_status = ev(inv.sip_status)
        if sip_status == "STOPPED":
            continue
        status = "ACTIVE" if sip_status == "ACTIVE" else "PAUSED"
        sip_day = inv.sip_date or 1
        next_date = next_occurrence(sip_day, today) if status == "ACTIVE" else None
        items.append(
            make_item(
                id=str(inv.id),
                name=inv.name,
                amount=float(inv.sip_amount or 0),
                frequency="MONTHLY",
                next_date=next_date,
                source="investment",
                source_id=str(inv.id),
                status=status,
                emoji="📈",
                metadata={
                    "investment_type": ev(inv.investment_type),
                    "broker": inv.broker,
                    "platform": inv.platform,
                },
            )
        )
    return items


async def fetch_emi_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    """Card EMIs where owner_type is SELF — genuine monthly liabilities."""
    result = await db.execute(
        select(EMI).where(
            and_(
                EMI.user_id == user_id,
                EMI.status == EMIStatus.ACTIVE,
                EMI.owner_type == EMIOwnerType.SELF,
            )
        )
    )
    emis = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for emi in emis:
        next_due: Optional[date] = None
        if emi.next_due_date:
            next_due = (
                emi.next_due_date.date()
                if hasattr(emi.next_due_date, "date")
                else emi.next_due_date
            )
        items.append(
            make_item(
                id=str(emi.id),
                name=emi.product_name,
                amount=float(emi.monthly_emi or 0),
                frequency="MONTHLY",
                next_date=next_due,
                source="emi",
                source_id=str(emi.id),
                status="ACTIVE",
                emoji="💳",
                metadata={
                    "remaining_months": emi.remaining_months,
                    "is_no_cost_emi": emi.is_no_cost_emi,
                    "merchant_name": emi.merchant_name,
                },
            )
        )
    return items


async def fetch_loan_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Loan).where(
            and_(
                Loan.user_id == user_id,
                Loan.status == LoanStatus.ACTIVE,
                Loan.emi_amount > 0,
            )
        )
    )
    loans = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for loan in loans:
        due_day = loan.emi_due_day or 5
        next_due = next_occurrence(due_day, today)
        loan_label = f"{ev(loan.loan_type).replace('_', ' ').title()} — {loan.lender_name}"
        if loan.nickname:
            loan_label = loan.nickname
        items.append(
            make_item(
                id=str(loan.id),
                name=loan_label,
                amount=float(loan.emi_amount or 0),
                frequency="MONTHLY",
                next_date=next_due,
                source="loan",
                source_id=str(loan.id),
                status="ACTIVE",
                emoji="🏦",
                metadata={
                    "loan_type": ev(loan.loan_type),
                    "lender": loan.lender_name,
                    "outstanding": float(loan.outstanding_balance or 0),
                    "remaining_months": loan.remaining_months,
                    "interest_rate": float(loan.interest_rate or 0),
                },
            )
        )
    return items


async def fetch_insurance_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(Insurance).where(
            and_(
                Insurance.user_id == user_id,
                Insurance.is_active == True,
            )
        )
    )
    policies = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for policy in policies:
        freq = ev(policy.premium_frequency)
        if freq == "SINGLE":
            continue
        next_renewal: Optional[date] = policy.renewal_date
        if next_renewal and next_renewal < today:
            # Advance to next renewal based on frequency
            months_map = {
                "MONTHLY": 1,
                "QUARTERLY": 3,
                "HALF_YEARLY": 6,
                "YEARLY": 12,
            }
            step = months_map.get(freq, 12)
            while next_renewal < today:
                next_renewal = add_months(next_renewal, step)
        items.append(
            make_item(
                id=str(policy.id),
                name=policy.policy_name,
                amount=float(policy.premium_amount or 0),
                frequency=freq,
                next_date=next_renewal,
                source="insurance",
                source_id=str(policy.id),
                status="ACTIVE",
                emoji="🛡️",
                metadata={
                    "insurance_type": ev(policy.insurance_type),
                    "insurer": policy.insurer,
                    "sum_assured": float(policy.sum_assured or 0),
                },
            )
        )
    return items


def _detect_recurring_txns(
    transactions: List[Any],
    keyword_set: List[str],
    fallback_category_check: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Group transactions by merchant_name, then detect those with:
      - 2+ occurrences
      - similar amounts (within 5% variance)
      - 25-35 day intervals between consecutive transactions
    Also include any transaction whose merchant/description contains a known keyword.
    Returns list of dicts: {merchant, amount, last_date, interval_days, is_keyword_match}
    """
    by_merchant: Dict[str, List[Any]] = defaultdict(list)
    for tx in transactions:
        key = (tx.merchant_name or tx.description or "").strip().lower()
        if key:
            by_merchant[key].append(tx)

    detected: Dict[str, Dict[str, Any]] = {}

    for merchant_key, txns in by_merchant.items():
        # Sort by date ascending
        txns_sorted = sorted(
            txns,
            key=lambda t: t.transaction_date if hasattr(t.transaction_date, "date") else t.transaction_date,
        )

        # Check keyword match
        is_keyword = any(kw in merchant_key for kw in keyword_set)

        # Check interval regularity (need 2+)
        if len(txns_sorted) >= 2:
            amounts = [float(t.amount) for t in txns_sorted]
            avg_amount = sum(amounts) / len(amounts)
            amount_ok = all(
                abs(a - avg_amount) / max(avg_amount, 0.01) <= 0.05 for a in amounts
            )

            dates = []
            for t in txns_sorted:
                d = t.transaction_date
                dates.append(d.date() if hasattr(d, "date") else d)

            intervals = [
                (dates[i] - dates[i - 1]).days for i in range(1, len(dates))
            ]
            interval_ok = all(25 <= iv <= 35 for iv in intervals) if intervals else False

            if (amount_ok and interval_ok) or is_keyword:
                last_date = dates[-1]
                avg_interval = (
                    int(sum(intervals) / len(intervals)) if intervals else 30
                )
                next_date_est = last_date + timedelta(days=avg_interval)
                detected[merchant_key] = {
                    "merchant": merchant_key,
                    "amount": round(avg_amount, 2),
                    "last_date": last_date,
                    "next_date": next_date_est,
                    "interval_days": avg_interval,
                    "is_keyword_match": is_keyword,
                    "occurrence_count": len(txns_sorted),
                    "source_ids": [str(t.id) for t in txns_sorted],
                }
        elif is_keyword and txns_sorted:
            # Keyword match with single occurrence — still include
            t = txns_sorted[-1]
            d = t.transaction_date
            last_date = d.date() if hasattr(d, "date") else d
            detected[merchant_key] = {
                "merchant": merchant_key,
                "amount": round(float(t.amount), 2),
                "last_date": last_date,
                "next_date": last_date + timedelta(days=30),
                "interval_days": 30,
                "is_keyword_match": True,
                "occurrence_count": 1,
                "source_ids": [str(t.id)],
            }

    return list(detected.values())


async def fetch_subscription_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    result = await db.execute(
        select(BankTransaction).where(
            and_(
                BankTransaction.user_id == user_id,
                BankTransaction.tx_type == BankTxType.DEBIT,
                BankTransaction.transaction_date >= cutoff,
            )
        )
    )
    transactions = result.scalars().all()

    detected = _detect_recurring_txns(transactions, KNOWN_SUBSCRIPTION_KEYWORDS)

    # Exclude anything that looks like a utility
    items: List[Dict[str, Any]] = []
    for d in detected:
        merchant = d["merchant"]
        if any(uk in merchant for uk in UTILITY_KEYWORDS):
            continue
        display_name = merchant.title()
        items.append(
            make_item(
                id=f"sub_{merchant.replace(' ', '_')}",
                name=display_name,
                amount=d["amount"],
                frequency="MONTHLY",
                next_date=d["next_date"],
                source="bank_transaction",
                source_id=d["source_ids"][-1] if d["source_ids"] else "",
                status="ACTIVE",
                emoji="📦",
                metadata={
                    "is_keyword_match": d["is_keyword_match"],
                    "occurrence_count": d["occurrence_count"],
                    "last_seen": d["last_date"].isoformat(),
                    "interval_days": d["interval_days"],
                },
            )
        )
    return items


async def fetch_utility_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    result = await db.execute(
        select(BankTransaction).where(
            and_(
                BankTransaction.user_id == user_id,
                BankTransaction.tx_type == BankTxType.DEBIT,
                BankTransaction.transaction_date >= cutoff,
            )
        )
    )
    transactions = result.scalars().all()

    detected = _detect_recurring_txns(transactions, UTILITY_KEYWORDS)

    items: List[Dict[str, Any]] = []
    for d in detected:
        display_name = d["merchant"].title()
        items.append(
            make_item(
                id=f"util_{d['merchant'].replace(' ', '_')}",
                name=display_name,
                amount=d["amount"],
                frequency="MONTHLY",
                next_date=d["next_date"],
                source="bank_transaction",
                source_id=d["source_ids"][-1] if d["source_ids"] else "",
                status="ACTIVE",
                emoji="💡",
                metadata={
                    "is_keyword_match": d["is_keyword_match"],
                    "occurrence_count": d["occurrence_count"],
                    "last_seen": d["last_date"].isoformat(),
                    "interval_days": d["interval_days"],
                },
            )
        )
    return items


async def fetch_lending_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    """EMIs where owner_type is FRIEND/FAMILY — amounts being collected from others."""
    result = await db.execute(
        select(EMI).where(
            and_(
                EMI.user_id == user_id,
                EMI.status == EMIStatus.ACTIVE,
                EMI.owner_type.in_([EMIOwnerType.FRIEND, EMIOwnerType.FAMILY]),
            )
        )
    )
    emis = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for emi in emis:
        next_due: Optional[date] = None
        if emi.next_due_date:
            next_due = (
                emi.next_due_date.date()
                if hasattr(emi.next_due_date, "date")
                else emi.next_due_date
            )
        owner_label = ev(emi.owner_type).title()
        items.append(
            make_item(
                id=str(emi.id),
                name=f"{emi.product_name} ({owner_label})",
                amount=float(emi.monthly_emi or 0),
                frequency="MONTHLY",
                next_date=next_due,
                source="emi_lending",
                source_id=str(emi.id),
                status="ACTIVE",
                emoji="🤝",
                metadata={
                    "owner_type": ev(emi.owner_type),
                    "reminder_day": emi.reminder_day,
                    "amount_collected": float(emi.amount_collected or 0),
                },
            )
        )
    return items


async def fetch_income_items(
    db: AsyncSession, user_id: UUID, today: date
) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(IncomeSource).where(
            and_(
                IncomeSource.user_id == user_id,
                IncomeSource.is_active == True,
            )
        )
    )
    sources = result.scalars().all()

    items: List[Dict[str, Any]] = []
    for src in sources:
        items.append(
            make_item(
                id=str(src.id),
                name=src.name,
                amount=float(src.monthly_amount or 0),
                frequency="MONTHLY",
                next_date=today.replace(day=1) if today.day > 1 else today,
                source="income",
                source_id=str(src.id),
                status="ACTIVE",
                emoji="💰",
                metadata={
                    "income_type": ev(src.income_type),
                    "employer": src.employer,
                    "is_variable": src.is_variable,
                },
            )
        )
    return items


# ---------------------------------------------------------------------------
# Core aggregation
# ---------------------------------------------------------------------------

async def build_all_groups(
    db: AsyncSession, user_id: UUID, today: date
) -> Tuple[List[Dict[str, Any]], float]:
    """
    Returns (groups, estimated_monthly_income).
    """
    investment_items, emi_items, loan_items, insurance_items, subscription_items, utility_items, lending_items, income_items = (
        await fetch_investment_items(db, user_id, today),
        await fetch_emi_items(db, user_id, today),
        await fetch_loan_items(db, user_id, today),
        await fetch_insurance_items(db, user_id, today),
        await fetch_subscription_items(db, user_id, today),
        await fetch_utility_items(db, user_id, today),
        await fetch_lending_items(db, user_id, today),
        await fetch_income_items(db, user_id, today),
    )

    # Estimate monthly income
    monthly_income: float = DEFAULT_MONTHLY_INCOME
    if income_items:
        monthly_income = sum(
            i["monthly_equivalent"] for i in income_items
        ) or DEFAULT_MONTHLY_INCOME

    def group_monthly(items: List[Dict[str, Any]]) -> float:
        return sum(i["monthly_equivalent"] for i in items)

    groups: List[Dict[str, Any]] = []

    def add_group(
        gid: str,
        label: str,
        emoji: str,
        color: str,
        items: List[Dict[str, Any]],
    ) -> None:
        monthly = round(group_monthly(items), 2)
        groups.append(
            {
                "id": gid,
                "label": label,
                "emoji": emoji,
                "color": color,
                "monthly": monthly,
                "annual": round(to_annual(monthly), 2),
                "items": sorted(items, key=lambda x: x["name"]),
            }
        )

    # Liabilities = card EMIs + loan EMIs
    all_liabilities = emi_items + loan_items

    # ── Cross-group deduplication ──────────────────────────────────────────
    # Bank-transaction-detected items (subscriptions, utilities) must not
    # repeat items that already appear in structured groups (investments,
    # liabilities, insurance, lending).  Match by normalised name + amount.
    structured_names: set[str] = set()
    for item in investment_items + all_liabilities + insurance_items + lending_items:
        structured_names.add(item["name"].strip().lower())

    def _dedup_bank_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove bank-detected items whose name already exists in a structured group."""
        out = []
        for item in items:
            key = item["name"].strip().lower()
            if key not in structured_names:
                out.append(item)
        return out

    subscription_items = _dedup_bank_items(subscription_items)
    utility_items = _dedup_bank_items(utility_items)

    # Also dedup between subscriptions and utilities — subscriptions take priority
    sub_names = {i["name"].strip().lower() for i in subscription_items}
    utility_items = [i for i in utility_items if i["name"].strip().lower() not in sub_names]

    add_group("investments", "Investments", "📈", "#10B981", investment_items)
    add_group("liabilities", "Liabilities", "💳", "#EF4444", all_liabilities)
    add_group("subscriptions", "Subscriptions", "📦", "#8B5CF6", subscription_items)
    add_group("insurance", "Insurance", "🛡️", "#3B82F6", insurance_items)
    add_group("utilities", "Utilities", "💡", "#F59E0B", utility_items)
    add_group("lending", "Lending / Collections", "🤝", "#6366F1", lending_items)
    add_group("income", "Income", "💰", "#14B8A6", income_items)

    return groups, monthly_income


def compute_upcoming(
    groups: List[Dict[str, Any]], horizon_days: int, today: date
) -> List[Dict[str, Any]]:
    cutoff = today + timedelta(days=horizon_days)
    upcoming: List[Dict[str, Any]] = []
    # Dedup key: (normalised name, amount, next_date) — same item can appear in
    # multiple groups when bank-transaction detection and structured data overlap
    seen: set[tuple] = set()

    for group in groups:
        for item in group["items"]:
            nd = item.get("next_date")
            if nd:
                nd_date = date.fromisoformat(nd) if isinstance(nd, str) else nd
                if today <= nd_date <= cutoff:
                    dedup_key = (
                        item.get("name", "").strip().lower(),
                        round(float(item.get("amount", 0)), 0),
                        str(nd_date),
                    )
                    if dedup_key in seen:
                        continue
                    seen.add(dedup_key)
                    upcoming.append(
                        {
                            **item,
                            "group_id": group["id"],
                            "group_label": group["label"],
                            "group_color": group["color"],
                        }
                    )
    return sorted(upcoming, key=lambda x: x["next_date"] or "9999-12-31")


def compute_monthly_forecast(
    groups: List[Dict[str, Any]], today: date, months: int = 6
) -> List[Dict[str, Any]]:
    forecast: List[Dict[str, Any]] = []
    # Exclude income group from outgoing commitments
    outgoing_groups = [g for g in groups if g["id"] != "income"]
    total_monthly = sum(g["monthly"] for g in outgoing_groups)

    for i in range(months):
        target = add_months(today, i)
        forecast.append(
            {
                "month": target.strftime("%Y-%m"),
                "label": target.strftime("%b %Y"),
                "total": round(total_monthly, 2),
            }
        )
    return forecast


def compute_health(burden_pct: float) -> str:
    if burden_pct < 50:
        return "HEALTHY"
    if burden_pct < 75:
        return "MODERATE"
    return "STRESSED"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/summary")
async def get_recurring_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Full structured summary of all recurring financial commitments."""
    try:
        today = datetime.now(timezone.utc).date()
        groups, monthly_income = await build_all_groups(db, current_user.id, today)

        outgoing_groups = [g for g in groups if g["id"] != "income"]
        total_monthly = round(sum(g["monthly"] for g in outgoing_groups), 2)
        total_annual = round(to_annual(total_monthly), 2)

        burden_pct = round((total_monthly / monthly_income * 100) if monthly_income else 0.0, 1)
        health = compute_health(burden_pct)

        upcoming = compute_upcoming(groups, 30, today)
        monthly_forecast = compute_monthly_forecast(groups, today, 6)

        return {
            "total_monthly": total_monthly,
            "total_annual": total_annual,
            "groups": groups,
            "upcoming": upcoming,
            "monthly_forecast": monthly_forecast,
            "burden_pct": burden_pct,
            "health": health,
            "estimated_monthly_income": round(monthly_income, 2),
            "as_of": today.isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/upcoming")
async def get_upcoming_commitments(
    days: int = Query(default=30, ge=1, le=365, description="Horizon in days"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """Return all recurring items due within the next N days, sorted by date."""
    try:
        today = datetime.now(timezone.utc).date()
        groups, _ = await build_all_groups(db, current_user.id, today)
        upcoming = compute_upcoming(groups, days, today)
        return {
            "days": days,
            "count": len(upcoming),
            "items": upcoming,
            "as_of": today.isoformat(),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/calendar")
async def get_recurring_calendar(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Dict[str, Any]:
    """
    Monthly calendar view for the next 3 months.
    Returns a dict keyed by ISO date, each with a list of items due that day.
    """
    try:
        today = datetime.now(timezone.utc).date()
        groups, _ = await build_all_groups(db, current_user.id, today)

        # Expand recurring items across the next 3 months
        horizon_end = add_months(today, 3)
        calendar: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

        for group in groups:
            for item in group["items"]:
                nd = item.get("next_date")
                if not nd:
                    continue
                nd_date = date.fromisoformat(nd) if isinstance(nd, str) else nd
                freq = item.get("frequency", "MONTHLY")

                # Generate all occurrences within horizon
                current_date = nd_date
                while current_date <= horizon_end:
                    if current_date >= today:
                        day_key = current_date.isoformat()
                        calendar[day_key].append(
                            {
                                "id": item["id"],
                                "name": item["name"],
                                "amount": item["amount"],
                                "emoji": item["emoji"],
                                "group_id": group["id"],
                                "group_label": group["label"],
                                "group_color": group["color"],
                                "source": item["source"],
                                "status": item["status"],
                            }
                        )

                    # Advance to next occurrence
                    if freq == "MONTHLY":
                        current_date = add_months(current_date, 1)
                    elif freq == "QUARTERLY":
                        current_date = add_months(current_date, 3)
                    elif freq == "HALF_YEARLY":
                        current_date = add_months(current_date, 6)
                    elif freq == "YEARLY":
                        current_date = add_months(current_date, 12)
                    elif freq == "WEEKLY":
                        current_date = current_date + timedelta(weeks=1)
                    else:
                        # Non-repeating within horizon
                        break

        # Sort items within each day by amount descending
        sorted_calendar: Dict[str, Any] = {}
        for day_key in sorted(calendar.keys()):
            day_items = sorted(calendar[day_key], key=lambda x: -x["amount"])
            sorted_calendar[day_key] = {
                "date": day_key,
                "total": round(sum(i["amount"] for i in day_items), 2),
                "items": day_items,
            }

        return {
            "from": today.isoformat(),
            "to": horizon_end.isoformat(),
            "days_with_payments": len(sorted_calendar),
            "calendar": sorted_calendar,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
