from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.loan import Loan
from app.utils.enum_utils import ev
from app.schemas.loan import LoanCreate, LoanUpdate, LoanOut
from app.services.financial_context import build_financial_context

router = APIRouter()

LOAN_TYPE_LABELS = {
    "HOME": "Home Loan", "PERSONAL": "Personal Loan",
    "VEHICLE": "Vehicle Loan", "EDUCATION": "Education Loan",
    "GOLD": "Gold Loan", "BUSINESS": "Business Loan",
    "BNPL": "Buy Now Pay Later", "INFORMAL": "Informal / Family",
    "OTHER": "Other",
}
LOAN_TYPE_COLORS = {
    "HOME":      "#3B82F6", "PERSONAL": "#EF4444",
    "VEHICLE":   "#F59E0B", "EDUCATION": "#8B5CF6",
    "GOLD":      "#D97706", "BUSINESS":  "#10B981",
    "BNPL":      "#EC4899", "INFORMAL":  "#6B7280",
    "OTHER":     "#9CA3AF",
}
HIGH_INTEREST_THRESHOLD = 12.0   # % p.a.
RISKY_THRESHOLD = 18.0


def _amortization_schedule(loans: list, months: int = 12) -> list:
    """Compute aggregated principal + interest per month for next N months."""
    balances   = {str(l.id): float(l.outstanding_balance or 0) for l in loans}
    remaining  = {str(l.id): (l.remaining_months or l.tenure_months or 999) for l in loans}
    today      = date.today()
    schedule   = []

    for m in range(months):
        ref_date = today + relativedelta(months=m + 1)
        label = ref_date.strftime("%b %y")
        month_interest = 0.0
        month_principal = 0.0
        month_emi = 0.0

        for loan in loans:
            lid = str(loan.id)
            bal = balances[lid]
            rem = remaining[lid]
            if bal <= 0 or rem <= 0 or not loan.emi_amount:
                continue
            rate = float(loan.interest_rate or 0)
            monthly_rate = rate / 100 / 12
            emi = float(loan.emi_amount)
            interest = bal * monthly_rate
            principal = min(emi - interest, bal)
            if principal < 0:
                principal = 0
            balances[lid]  -= principal
            remaining[lid] -= 1
            month_interest  += interest
            month_principal += principal
            month_emi       += emi

        schedule.append({
            "month":     label,
            "interest":  round(month_interest, 2),
            "principal": round(month_principal, 2),
            "emi":       round(month_emi, 2),
        })

    return schedule


def _loan_insights(loans: list, total_outstanding: float, total_emi: float,
                   monthly_income_est: float) -> list:
    insights = []
    active = [l for l in loans if l.status == "ACTIVE"]

    # High-interest debt
    high_int = [l for l in active
                if float(l.interest_rate or 0) >= HIGH_INTEREST_THRESHOLD]
    if high_int:
        hi_total = sum(float(l.outstanding_balance or 0) for l in high_int)
        names = ", ".join(
            l.nickname or LOAN_TYPE_LABELS.get(ev(l.loan_type), "Loan")
            for l in sorted(high_int, key=lambda x: float(x.interest_rate), reverse=True)[:2]
        )
        insights.append({
            "severity": "CRITICAL" if any(float(l.interest_rate or 0) >= RISKY_THRESHOLD
                                          for l in high_int) else "WARNING",
            "title": f"High-Interest Debt: ₹{hi_total:,.0f}",
            "body": f"{names} carry rates ≥ {HIGH_INTEREST_THRESHOLD}%. "
                    "Prioritise prepayment or refinancing to cut interest leakage.",
            "action": "loans",
        })

    # Overdue
    overdue = [l for l in loans if l.status == "OVERDUE"]
    if overdue:
        owed = sum(float(l.outstanding_balance or 0) for l in overdue)
        insights.append({
            "severity": "CRITICAL",
            "title": f"{len(overdue)} Overdue Loan(s)",
            "body": f"₹{owed:,.0f} outstanding on overdue loans. "
                    "Late payments damage credit score and attract penalties.",
            "action": "loans",
        })

    # EMI burden
    if monthly_income_est > 0:
        burden_pct = total_emi / monthly_income_est * 100
        if burden_pct > 50:
            insights.append({
                "severity": "CRITICAL",
                "title": f"EMI Burden at {burden_pct:.0f}% of Income",
                "body": "Your EMIs exceed 50% of estimated monthly income. "
                        "This is unsustainable — consider prepaying or restructuring.",
                "action": "loans",
            })
        elif burden_pct > 35:
            insights.append({
                "severity": "WARNING",
                "title": f"High EMI Burden: {burden_pct:.0f}%",
                "body": "EMIs are 35–50% of estimated income. "
                        "Keep discretionary spending low and build an emergency fund.",
                "action": "loans",
            })

    # Prepayment opportunity (loans with < 2 years remaining and no penalty)
    pp_candidates = [
        l for l in active
        if (l.remaining_months or 999) <= 24
        and float(l.prepayment_penalty or 0) == 0
        and float(l.outstanding_balance or 0) > 50000
    ]
    if pp_candidates:
        pp_total = sum(float(l.outstanding_balance or 0) for l in pp_candidates)
        insights.append({
            "severity": "INFO",
            "title": f"Prepayment Opportunity: ₹{pp_total:,.0f}",
            "body": f"{len(pp_candidates)} loan(s) ending within 2 years with no prepayment "
                    "penalty. Foreclosing early can save significant interest.",
            "action": "loans",
        })

    # Informal debt reminder
    informal = [l for l in active if ev(l.loan_type) == "INFORMAL"]
    if informal:
        inf_total = sum(float(l.outstanding_balance or 0) for l in informal)
        insights.append({
            "severity": "INFO",
            "title": "Informal Debts Pending",
            "body": f"₹{inf_total:,.0f} owed informally (family/friends). "
                    "Track repayments here to maintain trust.",
            "action": "loans",
        })

    return insights[:6]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[LoanOut])
async def list_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan)
        .where(Loan.user_id == current_user.id)
        .order_by(Loan.outstanding_balance.desc())
    )
    return result.scalars().all()


@router.post("", response_model=LoanOut)
async def create_loan(
    data: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = Loan(user_id=current_user.id, **data.model_dump())
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.patch("/{loan_id}", response_model=LoanOut)
async def update_loan(
    loan_id: uuid.UUID,
    data: LoanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.delete("/{loan_id}")
async def delete_loan(
    loan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    await db.delete(loan)
    await db.commit()
    return {"ok": True}


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/summary")
async def loan_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.user_id == current_user.id)
    )
    loans = result.scalars().all()
    active = [l for l in loans if l.status == "ACTIVE"]
    total_monthly_emi = sum(float(l.emi_amount or 0) for l in active)

    # DTI calculation — pull monthly income from income sources
    from app.models.income import IncomeSource
    inc_res = await db.execute(
        select(IncomeSource).where(
            IncomeSource.user_id == current_user.id,
            IncomeSource.is_active.is_(True),
        )
    )
    sources = inc_res.scalars().all()
    monthly_income = sum(float(s.monthly_amount or 0) for s in sources)
    dti_pct = (total_monthly_emi / monthly_income * 100) if monthly_income > 0 else None
    if dti_pct is not None:
        if dti_pct < 35:
            dti_status = "healthy"
        elif dti_pct < 50:
            dti_status = "warning"
        else:
            dti_status = "critical"
    else:
        dti_status = "unknown"

    return {
        "total_outstanding":  sum(float(l.outstanding_balance or 0) for l in active),
        "total_monthly_emi":  total_monthly_emi,
        "total_principal":    sum(float(l.principal_amount or 0) for l in loans),
        "total_paid":         sum(float(l.total_paid or 0) for l in loans),
        "active_count":       len(active),
        "total_count":        len(loans),
        "monthly_income":     monthly_income,
        "dti_pct":            round(dti_pct, 1) if dti_pct is not None else None,
        "dti_status":         dti_status,
    }


@router.get("/analytics/intelligence")
async def loan_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.user_id == current_user.id)
    )
    loans = result.scalars().all()
    active = [l for l in loans if l.status == "ACTIVE"]

    # ── Totals ────────────────────────────────────────────────────────────────
    total_outstanding = sum(float(l.outstanding_balance or 0) for l in active)
    total_monthly_emi = sum(float(l.emi_amount or 0) for l in active)
    total_principal   = sum(float(l.principal_amount or 0) for l in loans)
    total_paid        = sum(float(l.total_paid or 0) for l in loans)
    total_interest    = sum(float(l.total_interest_paid or 0) for l in loans)
    secured_total     = sum(float(l.outstanding_balance or 0) for l in active if l.is_secured)
    unsecured_total   = total_outstanding - secured_total

    # Weighted average interest rate
    if total_outstanding > 0:
        weighted_rate = sum(
            float(l.outstanding_balance or 0) * float(l.interest_rate or 0)
            for l in active
        ) / total_outstanding
    else:
        weighted_rate = 0.0

    # ── By loan type ──────────────────────────────────────────────────────────
    by_type_map: dict = {}
    for loan in active:
        t = ev(loan.loan_type)
        if t not in by_type_map:
            by_type_map[t] = {
                "type": t, "label": LOAN_TYPE_LABELS.get(t, t),
                "color": LOAN_TYPE_COLORS.get(t, "#6B7280"),
                "outstanding": 0.0, "emi": 0.0, "count": 0,
            }
        by_type_map[t]["outstanding"] += float(loan.outstanding_balance or 0)
        by_type_map[t]["emi"] += float(loan.emi_amount or 0)
        by_type_map[t]["count"] += 1

    for entry in by_type_map.values():
        entry["pct"] = (round(entry["outstanding"] / total_outstanding * 100, 1)
                        if total_outstanding > 0 else 0)

    by_type = sorted(by_type_map.values(), key=lambda x: -x["outstanding"])

    # ── Per-loan cards ────────────────────────────────────────────────────────
    loan_cards = []
    for loan in sorted(active, key=lambda l: float(l.outstanding_balance or 0), reverse=True):
        principal = float(loan.principal_amount or 0)
        paid      = float(loan.total_paid or 0)
        outstanding = float(loan.outstanding_balance or 0)
        paid_pct  = round(paid / principal * 100, 1) if principal > 0 else 0

        loan_cards.append({
            "id":             str(loan.id),
            "name":           loan.nickname or LOAN_TYPE_LABELS.get(ev(loan.loan_type), "Loan"),
            "lender":         loan.lender_name,
            "type":           ev(loan.loan_type),
            "label":          LOAN_TYPE_LABELS.get(ev(loan.loan_type), ""),
            "color":          LOAN_TYPE_COLORS.get(ev(loan.loan_type), "#6B7280"),
            "principal":      principal,
            "outstanding":    outstanding,
            "paid":           paid,
            "paid_pct":       paid_pct,
            "emi":            float(loan.emi_amount or 0),
            "interest_rate":  float(loan.interest_rate or 0),
            "remaining_months": loan.remaining_months,
            "tenure_months":  loan.tenure_months,
            "emi_due_day":    loan.emi_due_day,
            "status":         str(loan.status),
            "is_secured":     loan.is_secured,
            "prepayment_penalty": float(loan.prepayment_penalty or 0),
            "notes":          loan.notes,
        })

    # ── Amortization schedule (12 months) ─────────────────────────────────────
    amortization = _amortization_schedule(active, months=12)

    # ── High interest loans ───────────────────────────────────────────────────
    high_interest = [
        {
            "name":  l.nickname or LOAN_TYPE_LABELS.get(ev(l.loan_type), "Loan"),
            "rate":  float(l.interest_rate or 0),
            "outstanding": float(l.outstanding_balance or 0),
        }
        for l in sorted(active, key=lambda x: float(x.interest_rate or 0), reverse=True)
        if float(l.interest_rate or 0) >= HIGH_INTEREST_THRESHOLD
    ]

    # ── Get real monthly income from shared financial context ─────────────────
    fin_ctx = await build_financial_context(db, current_user.id)
    monthly_income_est = fin_ctx["monthly_net"]

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = _loan_insights(loans, total_outstanding, total_monthly_emi, monthly_income_est)

    return {
        "total_outstanding":  round(total_outstanding, 2),
        "total_monthly_emi":  round(total_monthly_emi, 2),
        "total_principal":    round(total_principal, 2),
        "total_paid":         round(total_paid, 2),
        "total_interest_paid": round(total_interest, 2),
        "weighted_avg_rate":  round(weighted_rate, 2),
        "secured_total":      round(secured_total, 2),
        "unsecured_total":    round(unsecured_total, 2),
        "active_count":       len(active),
        "by_type":            by_type,
        "loan_cards":         loan_cards,
        "amortization":       amortization,
        "high_interest":      high_interest,
        "insights":           insights,
        "monthly_income":     round(monthly_income_est, 2),
    }
