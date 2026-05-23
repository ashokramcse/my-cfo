"""
Canonical Financial Context Service
Single source of truth for net worth and financial snapshot computation.
Consumed by: Net Worth API, AI CFO, Goals Intelligence, Loans Intelligence.
"""

def _ev(enum_val) -> str:
    """Return the string value of an enum (handles both StrEnum and repr-style enums)."""
    return getattr(enum_val, 'value', str(enum_val)).upper()
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime, timedelta
import math

from app.models.bank_account import BankAccount
from app.models.investment import Investment
from app.models.loan import Loan, LoanStatus
from app.models.asset import Asset
from app.models.card import CreditCard
from app.models.emi import EMI, EMIStatus
from app.models.income import IncomeSource
from app.models.insurance import Insurance, PremiumFrequency
from app.models.goal import Goal
from app.models.friend import Friend
from app.models.bank_transaction import BankTransaction, BankTxType
from app.models.transaction import Transaction, CategoryType

LIQUID_ACCOUNT_TYPES  = {"SAVINGS", "CURRENT", "SALARY", "WALLET", "UPI", "CASH"}
SEMI_LIQUID_TYPES     = {"FD", "RD"}
LIQUID_INV_TYPES      = {"STOCKS", "ETF", "CRYPTO", "MUTUAL_FUND"}
ILLIQUID_INV_TYPES    = {"PPF", "EPF", "NPS", "SGB", "BONDS"}

FREQ_MULTIPLIER = {
    "MONTHLY": 12, "QUARTERLY": 4, "HALF_YEARLY": 2, "YEARLY": 1, "SINGLE": 0
}

async def build_financial_context(db: AsyncSession, user_id) -> dict:
    """Full financial snapshot. Single canonical computation for all consumers."""
    today = date.today()

    # ── Bank accounts ─────────────────────────────────────────────────────────
    ba_res = await db.execute(
        select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.is_active == True)
    )
    accounts = ba_res.scalars().all()

    bank_liquid = 0.0
    bank_fd = 0.0
    for acc in accounts:
        bal = float(acc.current_balance or 0)
        atype = str(acc.account_type)
        if atype in LIQUID_ACCOUNT_TYPES:
            bank_liquid += bal
        elif atype in SEMI_LIQUID_TYPES:
            # Use maturity_amount if FD not yet matured, else compound estimate
            if acc.maturity_amount and acc.maturity_date and acc.maturity_date.date() > today:
                bank_fd += float(acc.maturity_amount)
            elif acc.interest_rate and acc.maturity_date and acc.maturity_date.date() > today:
                rate = float(acc.interest_rate) / 100
                years = (acc.maturity_date.date() - today).days / 365
                bank_fd += bal * (1 + rate) ** years
            else:
                bank_fd += bal

    bank_total = bank_liquid + bank_fd

    # ── Investments ───────────────────────────────────────────────────────────
    inv_res = await db.execute(select(Investment).where(Investment.user_id == user_id))
    investments = inv_res.scalars().all()

    total_invested   = sum(float(i.invested_amount or 0) for i in investments)
    investment_value = sum(float(i.current_value or 0) for i in investments)
    investment_pnl   = investment_value - total_invested
    sip_monthly      = sum(float(i.sip_amount or 0) for i in investments
                           if i.is_sip and _ev(i.sip_status) == "ACTIVE")
    liquid_investments = sum(float(i.current_value or 0) for i in investments
                             if _ev(i.investment_type) in LIQUID_INV_TYPES and not i.is_locked)
    pf_nps           = sum(float(i.current_value or 0) for i in investments
                           if _ev(i.investment_type) in ("PPF", "EPF", "NPS"))
    mutual_funds     = sum(float(i.current_value or 0) for i in investments
                           if _ev(i.investment_type) == "MUTUAL_FUND")

    # ── Physical assets ───────────────────────────────────────────────────────
    asset_res = await db.execute(select(Asset).where(Asset.user_id == user_id))
    assets = asset_res.scalars().all()
    real_estate_val = sum(float(a.current_value or 0) for a in assets if _ev(a.asset_type) == "REAL_ESTATE")
    vehicle_val     = sum(float(a.current_value or 0) for a in assets if _ev(a.asset_type) == "VEHICLE")
    physical_val    = sum(float(a.current_value or 0) for a in assets
                          if _ev(a.asset_type) not in ("REAL_ESTATE", "VEHICLE"))
    asset_value     = real_estate_val + vehicle_val + physical_val

    # ── Loans ─────────────────────────────────────────────────────────────────
    loan_res = await db.execute(
        select(Loan).where(Loan.user_id == user_id, Loan.status == LoanStatus.ACTIVE)
    )
    loans = loan_res.scalars().all()
    loan_outstanding = sum(float(l.outstanding_balance or 0) for l in loans)
    monthly_loan_emi = sum(float(l.emi_amount or 0) for l in loans)
    secured_debt     = sum(float(l.outstanding_balance or 0) for l in loans if l.is_secured)
    unsecured_debt   = loan_outstanding - secured_debt

    # ── Credit cards ──────────────────────────────────────────────────────────
    card_res = await db.execute(select(CreditCard).where(CreditCard.user_id == user_id))
    cards = card_res.scalars().all()
    cc_outstanding  = sum(float(c.current_outstanding or 0) for c in cards)
    cc_total_limit  = sum(float(c.credit_limit or 0) for c in cards)
    cc_utilization  = (cc_outstanding / cc_total_limit * 100) if cc_total_limit > 0 else 0.0

    # ── EMIs (credit card EMIs) ───────────────────────────────────────────────
    emi_res = await db.execute(
        select(EMI).where(EMI.user_id == user_id, EMI.status == EMIStatus.ACTIVE)
    )
    emis = emi_res.scalars().all()
    monthly_cc_emi = sum(float(e.monthly_emi or 0) for e in emis)

    # ── Income ────────────────────────────────────────────────────────────────
    inc_res = await db.execute(
        select(IncomeSource).where(IncomeSource.user_id == user_id, IncomeSource.is_active == True)
    )
    income_sources = inc_res.scalars().all()
    monthly_gross = sum(float(s.monthly_amount or 0) for s in income_sources)
    monthly_net   = sum(
        float(s.monthly_amount or 0) * (1 - float(s.tax_deducted_pct or 0) / 100)
        for s in income_sources
    )

    # ── Insurance ─────────────────────────────────────────────────────────────
    ins_res = await db.execute(
        select(Insurance).where(Insurance.user_id == user_id, Insurance.is_active == True)
    )
    insurances = ins_res.scalars().all()
    has_health = any(getattr(i.insurance_type, 'value', str(i.insurance_type)).upper() == "HEALTH" for i in insurances)
    has_term   = any(getattr(i.insurance_type, 'value', str(i.insurance_type)).upper() in ("TERM", "LIFE") for i in insurances)
    monthly_insurance = sum(
        float(i.premium_amount or 0) * FREQ_MULTIPLIER.get(str(i.premium_frequency), 1) / 12
        for i in insurances
    )

    # ── Goals ─────────────────────────────────────────────────────────────────
    goal_res = await db.execute(
        select(Goal).where(Goal.user_id == user_id, Goal.status == "ACTIVE")
    )
    goals = goal_res.scalars().all()
    monthly_goal_contribution = sum(float(g.monthly_contribution or 0) for g in goals)

    # ── Friend receivables (D-08) ────────────────────────────────────────────
    friend_result = await db.execute(
        select(func.sum(Friend.total_pending))
        .where(Friend.user_id == user_id, Friend.is_active == True)
    )
    friend_receivables = float(friend_result.scalar() or 0)

    # ── Bank expense data (D-06) ─────────────────────────────────────────────
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    expense_result = await db.execute(
        select(func.sum(BankTransaction.amount))
        .where(
            BankTransaction.user_id == user_id,
            BankTransaction.tx_type == BankTxType.DEBIT,
            BankTransaction.transaction_date >= thirty_days_ago,
        )
    )
    avg_monthly_expenses = float(expense_result.scalar() or 0)

    # ── CC spending by category (D-12) ────────────────────────────────────────
    cc_spend_result = await db.execute(
        select(Transaction.category, func.sum(Transaction.amount).label('total'))
        .where(Transaction.user_id == user_id, Transaction.transaction_date >= thirty_days_ago)
        .group_by(Transaction.category)
        .order_by(func.sum(Transaction.amount).desc())
        .limit(5)
    )
    top_cc_categories = [{"category": str(r.category), "amount": float(r.total)} for r in cc_spend_result]
    monthly_cc_spend_result = await db.execute(
        select(func.sum(Transaction.amount))
        .where(Transaction.user_id == user_id, Transaction.transaction_date >= thirty_days_ago)
    )
    monthly_cc_spend = float(monthly_cc_spend_result.scalar() or 0)

    # ── Aggregate ─────────────────────────────────────────────────────────────
    total_assets      = bank_total + investment_value + asset_value + friend_receivables
    # CC outstanding already separate from loans - no double-counting
    total_liabilities = loan_outstanding + cc_outstanding
    net_worth         = total_assets - total_liabilities
    liquid_assets     = bank_liquid + liquid_investments
    liquid_net_worth  = liquid_assets - cc_outstanding - unsecured_debt

    monthly_burn  = monthly_loan_emi + monthly_cc_emi
    emergency_months = (liquid_assets / monthly_burn) if monthly_burn > 0 else (12.0 if liquid_assets > 0 else 0.0)

    # ── EMI burden % of income ────────────────────────────────────────────────
    total_monthly_emi_burden = monthly_loan_emi + monthly_cc_emi
    emi_burden_pct = round(total_monthly_emi_burden / monthly_net * 100, 1) if monthly_net > 0 else 0.0
    emi_status = "CRITICAL" if emi_burden_pct > 50 else "WARNING" if emi_burden_pct > 35 else "HEALTHY"

    # ── Monthly surplus (D-06: use real bank debits if available) ────────────
    emi_burden = total_monthly_emi_burden + monthly_insurance + monthly_goal_contribution
    if avg_monthly_expenses > 0:
        monthly_surplus = monthly_net - avg_monthly_expenses
    else:
        monthly_surplus = monthly_net - emi_burden

    # Debt ratio
    debt_ratio       = (total_liabilities / total_assets * 100) if total_assets > 0 else 0.0
    investment_ratio = (investment_value / total_assets * 100) if total_assets > 0 else 0.0

    return {
        # ── Core ──────────────────────────────────────────────────────────────
        "net_worth":          round(net_worth, 2),
        "liquid_net_worth":   round(liquid_net_worth, 2),
        "total_assets":       round(total_assets, 2),
        "total_liabilities":  round(total_liabilities, 2),
        "liquid_assets":      round(liquid_assets, 2),
        "liquid_investments": round(liquid_investments, 2),
        # ── Banking ───────────────────────────────────────────────────────────
        "bank_total":         round(bank_total, 2),
        "bank_liquid":        round(bank_liquid, 2),
        "bank_fd":            round(bank_fd, 2),
        "accounts":           len(accounts),
        # ── Investments ───────────────────────────────────────────────────────
        "investment_value":   round(investment_value, 2),
        "total_invested":     round(total_invested, 2),
        "investment_pnl":     round(investment_pnl, 2),
        "sip_monthly":        round(sip_monthly, 2),
        "pf_nps":             round(pf_nps, 2),
        "mutual_funds":       round(mutual_funds, 2),
        # ── Assets ────────────────────────────────────────────────────────────
        "asset_value":        round(asset_value, 2),
        "real_estate_val":    round(real_estate_val, 2),
        "vehicle_val":        round(vehicle_val, 2),
        # ── Liabilities ───────────────────────────────────────────────────────
        "loan_outstanding":   round(loan_outstanding, 2),
        "cc_outstanding":     round(cc_outstanding, 2),
        "cc_utilization":     round(cc_utilization, 2),
        "monthly_loan_emi":   round(monthly_loan_emi, 2),
        "monthly_cc_emi":     round(monthly_cc_emi, 2),
        "secured_debt":       round(secured_debt, 2),
        "unsecured_debt":     round(unsecured_debt, 2),
        # ── Income ────────────────────────────────────────────────────────────
        "monthly_gross":      round(monthly_gross, 2),
        "monthly_net":        round(monthly_net, 2),
        "income_sources":     len(income_sources),
        "income_names":       [s.name for s in income_sources],
        # ── Insurance ─────────────────────────────────────────────────────────
        "has_health":         has_health,
        "has_term":           has_term,
        "insurance_count":    len(insurances),
        "monthly_insurance":  round(monthly_insurance, 2),
        # ── Goals ─────────────────────────────────────────────────────────────
        "active_goals":       len(goals),
        "goal_names":         [g.name for g in goals],
        "monthly_goal_contribution": round(monthly_goal_contribution, 2),
        # ── Ratios ────────────────────────────────────────────────────────────
        "debt_ratio":         round(debt_ratio, 2),
        "cc_utilization_pct": round(cc_utilization, 2),
        "investment_ratio":   round(investment_ratio, 2),
        "emergency_months":   round(min(emergency_months, 24.0), 1),
        # ── EMI burden ────────────────────────────────────────────────────────
        "emi_burden": {
            "total_monthly": round(total_monthly_emi_burden, 2),
            "pct_of_income": emi_burden_pct,
            "status":        emi_status,
        },
        # ── Cash flow ─────────────────────────────────────────────────────────
        "monthly_surplus":     round(monthly_surplus, 2),
        "monthly_burn":        round(total_monthly_emi_burden + monthly_insurance, 2),
        # ── Banking for net worth view ─────────────────────────────────────────
        "banking": {
            "total_balance": round(bank_total, 2),
            "accounts": len(accounts),
        },
        "investments": {
            "total_invested": round(total_invested, 2),
            "current_value":  round(investment_value, 2),
            "unrealised_pnl": round(investment_pnl, 2),
            "sip_monthly":    round(sip_monthly, 2),
            "count":          len(investments),
        },
        "loans": {
            "total_outstanding": round(loan_outstanding, 2),
            "monthly_emi":       round(monthly_loan_emi, 2),
            "count":             len(loans),
            "lenders":           [l.lender_name for l in loans],
        },
        "assets": {
            "total_value": round(asset_value, 2),
            "count":       len(assets),
        },
        "insurance": {
            "has_health": has_health,
            "has_term":   has_term,
            "count":      len(insurances),
        },
        "goals": {
            "active": len(goals),
            "names":  [g.name for g in goals],
        },
        # ── Friend receivables ────────────────────────────────────────────────
        "friend_receivables": round(friend_receivables, 2),
        # income sub-dict for ai_cfo _fmt_ctx compatibility
        "income": {
            "monthly_gross": round(monthly_gross, 2),
            "monthly_net":   round(monthly_net, 2),
            "sources":       len(income_sources),
            "source_names":  [s.name for s in income_sources],
        },
        # ── Spending context (D-12) ───────────────────────────────────────────
        "spending": {
            "top_categories":      top_cc_categories,
            "monthly_cc_spend":    round(monthly_cc_spend, 2),
            "monthly_bank_debit":  round(avg_monthly_expenses, 2),
        },
    }
