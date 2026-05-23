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
from app.models.bank_account import BankAccount
from app.models.investment import Investment, SIPStatus
from app.models.loan import Loan, LoanStatus
from app.models.asset import Asset
from app.models.income import IncomeSource
from app.models.insurance import Insurance
from app.models.bank_transaction import BankTransaction, BankTxType, BankTxCategory
from app.utils.enum_utils import ev

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


@router.get("/financial-graph")
async def financial_graph(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all data needed for a financial visualization page (D3 force-directed, ECharts Sankey, etc.)."""
    uid = current_user.id

    # ── Fetch all entities ──────────────────────────────────────────────────
    banks_result = await db.execute(
        select(BankAccount).where(BankAccount.user_id == uid, BankAccount.is_active == True)
    )
    banks = banks_result.scalars().all()

    cards_result = await db.execute(
        select(CreditCard).where(CreditCard.user_id == uid, CreditCard.status == "ACTIVE")
    )
    cards = cards_result.scalars().all()

    investments_result = await db.execute(
        select(Investment).where(Investment.user_id == uid)
    )
    investments = investments_result.scalars().all()
    active_investments = [i for i in investments if ev(i.sip_status) == "ACTIVE" or i.current_value > 0]

    loans_result = await db.execute(
        select(Loan).where(Loan.user_id == uid, Loan.status == LoanStatus.ACTIVE)
    )
    loans = loans_result.scalars().all()

    assets_result = await db.execute(
        select(Asset).where(Asset.user_id == uid, Asset.current_value > 100000)
    )
    assets = assets_result.scalars().all()

    income_result = await db.execute(
        select(IncomeSource).where(IncomeSource.user_id == uid)
    )
    income_sources = income_result.scalars().all()

    # ── Nodes ───────────────────────────────────────────────────────────────
    nodes = []

    # Bank nodes
    for b in banks:
        nodes.append({
            "id": str(b.id),
            "type": "bank",
            "label": b.nickname or f"{b.bank_name} {ev(b.account_type)}",
            "value": float(b.current_balance or 0),
            "emoji": "🏦",
            "color": b.account_color or "#0EA5E9",
            "meta": {
                "bank_name": b.bank_name,
                "account_type": ev(b.account_type),
                "last4": b.account_number_last4,
                "is_primary": b.is_primary,
            },
        })

    # Card nodes
    for c in cards:
        nodes.append({
            "id": str(c.id),
            "type": "card",
            "label": c.nickname or f"{c.bank_name} Card",
            "value": float(c.current_outstanding or 0),
            "emoji": "💳",
            "color": "#F97316",
            "meta": {
                "bank_name": c.bank_name,
                "credit_limit": float(c.credit_limit or 0),
                "available_limit": float(c.available_limit or 0),
            },
        })

    # Investment nodes — group by investment_type if > 5 individual investments
    if len(active_investments) > 5:
        # Group by investment_type
        inv_groups: dict[str, dict] = {}
        for inv in active_investments:
            itype = ev(inv.investment_type)
            if itype not in inv_groups:
                inv_groups[itype] = {"value": Decimal(0), "count": 0, "sip_total": Decimal(0)}
            inv_groups[itype]["value"] += inv.current_value or Decimal(0)
            inv_groups[itype]["count"] += 1
            if inv.is_sip and inv.sip_amount:
                inv_groups[itype]["sip_total"] += inv.sip_amount
        for itype, grp in inv_groups.items():
            node_id = f"inv_group_{itype.lower()}"
            nodes.append({
                "id": node_id,
                "type": "investment",
                "label": itype.replace("_", " ").title(),
                "value": float(grp["value"]),
                "emoji": "📈",
                "color": "#10B981",
                "meta": {"grouped": True, "count": grp["count"], "monthly_sip": float(grp["sip_total"])},
            })
    else:
        for inv in active_investments:
            nodes.append({
                "id": str(inv.id),
                "type": "investment",
                "label": inv.name,
                "value": float(inv.current_value or 0),
                "emoji": "📈",
                "color": "#10B981",
                "meta": {
                    "investment_type": ev(inv.investment_type),
                    "is_sip": inv.is_sip,
                    "sip_amount": float(inv.sip_amount or 0),
                    "invested_amount": float(inv.invested_amount or 0),
                },
            })

    # Loan nodes
    for loan in loans:
        nodes.append({
            "id": str(loan.id),
            "type": "loan",
            "label": loan.nickname or f"{loan.lender_name} {ev(loan.loan_type)}",
            "value": float(loan.outstanding_balance or 0),
            "emoji": "⚠️",
            "color": "#EF4444",
            "meta": {
                "loan_type": ev(loan.loan_type),
                "lender": loan.lender_name,
                "emi_amount": float(loan.emi_amount or 0),
                "interest_rate": float(loan.interest_rate or 0),
                "remaining_months": loan.remaining_months,
            },
        })

    # Asset nodes (value > 100k)
    for asset in assets:
        nodes.append({
            "id": str(asset.id),
            "type": "asset",
            "label": asset.name,
            "value": float(asset.current_value or 0),
            "emoji": "🏠",
            "color": "#8B5CF6",
            "meta": {"asset_type": ev(asset.asset_type) if hasattr(asset, "asset_type") else ""},
        })

    # Income nodes
    for src in income_sources:
        nodes.append({
            "id": str(src.id),
            "type": "income",
            "label": src.name,
            "value": float(src.monthly_amount or 0),
            "emoji": "💰",
            "color": "#22C55E",
            "meta": {"income_type": ev(src.income_type) if hasattr(src, "income_type") else ""},
        })

    # Synthetic Net Worth node
    total_assets = sum(float(b.current_balance or 0) for b in banks)
    total_assets += sum(float(i.current_value or 0) for i in active_investments)
    total_assets += sum(float(a.current_value or 0) for a in assets)
    total_liabilities = sum(float(loan.outstanding_balance or 0) for loan in loans)
    total_liabilities += sum(float(c.current_outstanding or 0) for c in cards)
    net_worth_value = total_assets - total_liabilities
    networth_id = "networth_synthetic"
    nodes.append({
        "id": networth_id,
        "type": "networth",
        "label": "Net Worth",
        "value": net_worth_value,
        "emoji": "📊",
        "color": "#6366F1" if net_worth_value >= 0 else "#EF4444",
        "meta": {"total_assets": total_assets, "total_liabilities": total_liabilities},
    })

    # ── Edges ───────────────────────────────────────────────────────────────
    edges = []

    # Determine primary bank for income routing
    primary_bank = next((b for b in banks if b.is_primary), None)
    if primary_bank is None and banks:
        primary_bank = max(banks, key=lambda b: b.current_balance or 0)
    income_target_id = str(primary_bank.id) if primary_bank else None

    # Income → bank
    for src in income_sources:
        if income_target_id:
            edges.append({
                "source": str(src.id),
                "target": income_target_id if len(banks) == 1 or primary_bank else str(banks[0].id),
                "value": float(src.monthly_amount or 0),
                "label": src.name,
                "type": "income_flow",
            })

    # Bank → SIP investments
    sip_source_id = str(primary_bank.id) if primary_bank else (str(banks[0].id) if banks else None)
    if len(active_investments) > 5:
        # grouped — connect to group nodes
        inv_groups_sip: dict[str, Decimal] = {}
        for inv in active_investments:
            if inv.is_sip and inv.sip_amount:
                itype = ev(inv.investment_type)
                inv_groups_sip[itype] = inv_groups_sip.get(itype, Decimal(0)) + (inv.sip_amount or Decimal(0))
        for itype, total_sip in inv_groups_sip.items():
            if sip_source_id:
                edges.append({
                    "source": sip_source_id,
                    "target": f"inv_group_{itype.lower()}",
                    "value": float(total_sip),
                    "label": f"{itype.replace('_', ' ').title()} SIP",
                    "type": "investment",
                })
    else:
        for inv in active_investments:
            if inv.is_sip and inv.sip_amount and sip_source_id:
                edges.append({
                    "source": sip_source_id,
                    "target": str(inv.id),
                    "value": float(inv.sip_amount),
                    "label": f"{inv.name} SIP",
                    "type": "investment",
                })

    # Bank → active loans (EMI)
    for loan in loans:
        if loan.emi_amount and sip_source_id:
            edges.append({
                "source": sip_source_id,
                "target": str(loan.id),
                "value": float(loan.emi_amount),
                "label": f"{loan.nickname or loan.lender_name} EMI",
                "type": "emi",
            })

    # Bank → credit cards (monthly approx = outstanding / 12)
    for card in cards:
        if card.current_outstanding and sip_source_id:
            monthly_approx = float(card.current_outstanding) / 12
            edges.append({
                "source": sip_source_id,
                "target": str(card.id),
                "value": round(monthly_approx, 2),
                "label": f"{card.nickname or card.bank_name} Bill",
                "type": "bill_payment",
            })

    # All banks → Net Worth
    for b in banks:
        edges.append({
            "source": str(b.id),
            "target": networth_id,
            "value": float(b.current_balance or 0),
            "label": b.nickname or b.bank_name,
            "type": "net_flow",
        })

    # All investments → Net Worth
    if len(active_investments) > 5:
        for itype, grp in inv_groups.items():
            edges.append({
                "source": f"inv_group_{itype.lower()}",
                "target": networth_id,
                "value": float(grp["value"]),
                "label": itype.replace("_", " ").title(),
                "type": "investment",
            })
    else:
        for inv in active_investments:
            edges.append({
                "source": str(inv.id),
                "target": networth_id,
                "value": float(inv.current_value or 0),
                "label": inv.name,
                "type": "investment",
            })

    # Loans → Net Worth (negative / liability)
    for loan in loans:
        edges.append({
            "source": str(loan.id),
            "target": networth_id,
            "value": float(loan.outstanding_balance or 0),
            "label": loan.nickname or loan.lender_name,
            "type": "liability",
        })

    # Assets → Net Worth
    for asset in assets:
        edges.append({
            "source": str(asset.id),
            "target": networth_id,
            "value": float(asset.current_value or 0),
            "label": asset.name,
            "type": "asset",
        })

    # ── Sankey ──────────────────────────────────────────────────────────────
    # Estimate monthly income
    monthly_income = sum(float(src.monthly_amount or 0) for src in income_sources)
    if monthly_income == 0 and banks:
        # Estimate from bank credits in last 3 months
        three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)
        credit_result = await db.execute(
            select(func.sum(BankTransaction.amount)).where(
                BankTransaction.user_id == uid,
                BankTransaction.tx_type == BankTxType.CREDIT,
                BankTransaction.category.in_([BankTxCategory.SALARY, BankTxCategory.BUSINESS_INCOME]),
                BankTransaction.transaction_date >= three_months_ago,
            )
        )
        credit_sum = credit_result.scalar() or Decimal(0)
        monthly_income = float(credit_sum) / 3

    # Estimate sankey outflows from bank transactions (last 3 months)
    three_months_ago = datetime.now(timezone.utc) - timedelta(days=90)

    def _cat_sum_query(categories):
        return select(func.sum(BankTransaction.amount)).where(
            BankTransaction.user_id == uid,
            BankTransaction.tx_type == BankTxType.DEBIT,
            BankTransaction.category.in_(categories),
            BankTransaction.transaction_date >= three_months_ago,
        )

    async def _fetch_monthly(categories) -> float:
        res = await db.execute(_cat_sum_query(categories))
        val = res.scalar() or Decimal(0)
        return round(float(val) / 3, 2)

    sip_monthly = sum(
        float(inv.sip_amount or 0) for inv in active_investments if inv.is_sip and inv.sip_amount
    )
    emi_monthly = sum(float(loan.emi_amount or 0) for loan in loans if loan.emi_amount)
    card_monthly = sum(float(c.current_outstanding or 0) / 12 for c in cards)

    subscriptions_monthly = await _fetch_monthly([BankTxCategory.ENTERTAINMENT])
    utilities_monthly = await _fetch_monthly([BankTxCategory.UTILITIES])

    total_outflow = sip_monthly + emi_monthly + card_monthly + subscriptions_monthly + utilities_monthly
    savings_monthly = max(0.0, monthly_income - total_outflow)

    # Build sankey node list
    sankey_node_names = ["Income", "SIP / Investments", "Loan EMIs", "Card Bills", "Subscriptions", "Utilities", "Savings"]
    sankey_nodes = [{"name": n} for n in sankey_node_names]
    income_idx = 0

    sankey_links = []
    if sip_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 1, "value": round(sip_monthly, 2)})
    if emi_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 2, "value": round(emi_monthly, 2)})
    if card_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 3, "value": round(card_monthly, 2)})
    if subscriptions_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 4, "value": round(subscriptions_monthly, 2)})
    if utilities_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 5, "value": round(utilities_monthly, 2)})
    if savings_monthly > 0:
        sankey_links.append({"source": income_idx, "target": 6, "value": round(savings_monthly, 2)})

    sankey = {"nodes": sankey_nodes, "links": sankey_links}

    # ── Summary ─────────────────────────────────────────────────────────────
    total_inflow = monthly_income
    total_outflow_summary = total_outflow

    # Find largest single flow edge (excluding net worth edges)
    flow_edges = [e for e in edges if e["type"] in ("income_flow", "investment", "emi", "bill_payment")]
    largest_flow = None
    if flow_edges:
        largest = max(flow_edges, key=lambda e: e["value"])
        largest_flow = {"label": largest["label"], "amount": largest["value"]}

    summary = {
        "total_inflow": round(total_inflow, 2),
        "total_outflow": round(total_outflow_summary, 2),
        "net_flow": round(total_inflow - total_outflow_summary, 2),
        "largest_flow": largest_flow,
    }

    return {
        "nodes": nodes,
        "edges": edges,
        "sankey": sankey,
        "summary": summary,
    }
