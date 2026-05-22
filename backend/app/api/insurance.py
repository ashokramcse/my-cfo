from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.insurance import Insurance
from pydantic import BaseModel

router = APIRouter()

# ─── Pydantic schemas ─────────────────────────────────────────────────────────
class InsuranceCreate(BaseModel):
    insurance_type: str
    policy_name: str
    insurer: str
    policy_number: Optional[str] = None
    premium_amount: float
    premium_frequency: str = "YEARLY"
    sum_assured: Optional[float] = None
    cover_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    renewal_date: Optional[date] = None
    beneficiary: Optional[str] = None
    is_active: bool = True
    notes: Optional[str] = None

class InsuranceUpdate(BaseModel):
    insurance_type: Optional[str] = None
    policy_name: Optional[str] = None
    insurer: Optional[str] = None
    policy_number: Optional[str] = None
    premium_amount: Optional[float] = None
    premium_frequency: Optional[str] = None
    sum_assured: Optional[float] = None
    cover_amount: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    renewal_date: Optional[date] = None
    beneficiary: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


# ─── Type metadata ────────────────────────────────────────────────────────────
TYPE_LABELS = {
    "HEALTH": "Health",  "TERM": "Term Life",   "LIFE": "Life Insurance",
    "VEHICLE": "Vehicle", "TRAVEL": "Travel",   "PROPERTY": "Property",
    "OTHER": "Other",
}
TYPE_COLORS = {
    "HEALTH": "#EF4444",  "TERM": "#3B82F6",   "LIFE": "#8B5CF6",
    "VEHICLE": "#F59E0B", "TRAVEL": "#10B981", "PROPERTY": "#D97706",
    "OTHER": "#6B7280",
}

# Annualised premium multiplier
FREQ_MULTIPLIER = {
    "MONTHLY": 12, "QUARTERLY": 4, "HALF_YEARLY": 2, "YEARLY": 1, "SINGLE": 0,
}


def _insurance_insights(insurances: list, today: date) -> list:
    insights = []
    active = [i for i in insurances if i.is_active]

    # Check health insurance
    has_health = any(str(i.insurance_type) == "HEALTH" for i in active)
    if not has_health:
        insights.append({
            "severity": "CRITICAL",
            "title": "No Health Insurance",
            "body": "You have no active health insurance. A single hospitalisation can cost "
                    "₹2–10L+. Get a floater plan immediately.",
            "action": "insurance",
        })

    # Check term life
    has_term = any(str(i.insurance_type) in ("TERM", "LIFE") for i in active)
    if not has_term:
        insights.append({
            "severity": "WARNING",
            "title": "No Life / Term Insurance",
            "body": "If you have dependents, a term plan of 15–20× annual income is essential. "
                    "Premiums are lowest when bought young.",
            "action": "insurance",
        })

    # Renewals due within 60 days
    soon = [i for i in active if i.renewal_date and 0 <= (i.renewal_date - today).days <= 60]
    if soon:
        names = ", ".join(i.policy_name for i in soon[:2])
        insights.append({
            "severity": "WARNING",
            "title": f"{len(soon)} Policy Renewal(s) Due Soon",
            "body": f"{names} expire within 60 days. Missing renewal causes a lapse in coverage.",
            "action": "insurance",
        })

    # Expired policies
    expired = [i for i in active if i.renewal_date and (today - i.renewal_date).days > 0]
    if expired:
        insights.append({
            "severity": "CRITICAL",
            "title": f"{len(expired)} Expired Policy(ies)",
            "body": f"{', '.join(i.policy_name for i in expired[:2])} ha{'ve' if len(expired) > 1 else 's'} lapsed. "
                    "Renew or replace immediately to restore coverage.",
            "action": "insurance",
        })

    return insights[:5]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_insurances(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insurance)
        .where(Insurance.user_id == current_user.id)
        .order_by(Insurance.insurance_type, Insurance.renewal_date)
    )
    return result.scalars().all()


@router.post("")
async def create_insurance(
    data: InsuranceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ins = Insurance(user_id=current_user.id, **data.model_dump())
    db.add(ins)
    await db.commit()
    await db.refresh(ins)
    return ins


@router.patch("/{ins_id}")
async def update_insurance(
    ins_id: uuid.UUID,
    data: InsuranceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insurance).where(Insurance.id == ins_id, Insurance.user_id == current_user.id)
    )
    ins = result.scalar_one_or_none()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(ins, field, value)
    await db.commit()
    await db.refresh(ins)
    return ins


@router.delete("/{ins_id}")
async def delete_insurance(
    ins_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insurance).where(Insurance.id == ins_id, Insurance.user_id == current_user.id)
    )
    ins = result.scalar_one_or_none()
    if not ins:
        raise HTTPException(status_code=404, detail="Insurance not found")
    await db.delete(ins)
    await db.commit()
    return {"ok": True}


# ─── Intelligence ─────────────────────────────────────────────────────────────

@router.get("/analytics/intelligence")
async def insurance_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Insurance).where(Insurance.user_id == current_user.id)
    )
    insurances = result.scalars().all()
    today = date.today()
    active = [i for i in insurances if i.is_active]

    # ── Totals ────────────────────────────────────────────────────────────────
    def annual_premium(i):
        mult = FREQ_MULTIPLIER.get(str(i.premium_frequency), 1)
        return float(i.premium_amount or 0) * mult

    total_annual_premium  = sum(annual_premium(i) for i in active)
    total_monthly_premium = total_annual_premium / 12
    total_cover           = sum(float(i.cover_amount or i.sum_assured or 0) for i in active)
    total_sum_assured     = sum(float(i.sum_assured or 0) for i in active)

    # ── By type ───────────────────────────────────────────────────────────────
    by_type: dict = {}
    for ins in active:
        t = str(ins.insurance_type)
        if t not in by_type:
            by_type[t] = {
                "type": t, "label": TYPE_LABELS.get(t, t),
                "color": TYPE_COLORS.get(t, "#6B7280"),
                "annual_premium": 0.0, "cover": 0.0, "count": 0,
            }
        by_type[t]["annual_premium"] += annual_premium(ins)
        by_type[t]["cover"]          += float(ins.cover_amount or ins.sum_assured or 0)
        by_type[t]["count"]          += 1

    # ── Policy cards ──────────────────────────────────────────────────────────
    policy_cards = []
    for ins in sorted(insurances, key=lambda x: x.renewal_date or date(2099, 1, 1)):
        days_to_renewal = (ins.renewal_date - today).days if ins.renewal_date else None
        policy_cards.append({
            "id":               str(ins.id),
            "insurance_type":   str(ins.insurance_type),
            "label":            TYPE_LABELS.get(str(ins.insurance_type), ""),
            "color":            TYPE_COLORS.get(str(ins.insurance_type), "#6B7280"),
            "policy_name":      ins.policy_name,
            "insurer":          ins.insurer,
            "policy_number":    ins.policy_number,
            "premium_amount":   float(ins.premium_amount or 0),
            "premium_frequency":str(ins.premium_frequency),
            "annual_premium":   round(annual_premium(ins), 2),
            "sum_assured":      float(ins.sum_assured or 0),
            "cover_amount":     float(ins.cover_amount or 0),
            "renewal_date":     str(ins.renewal_date) if ins.renewal_date else None,
            "days_to_renewal":  days_to_renewal,
            "beneficiary":      ins.beneficiary,
            "is_active":        ins.is_active,
            "notes":            ins.notes,
        })

    # Coverage gaps
    type_set = {str(i.insurance_type) for i in active}
    coverage_gaps = []
    for t, lbl in [("HEALTH", "Health Insurance"), ("TERM", "Term Life Insurance")]:
        if t not in type_set:
            coverage_gaps.append(lbl)

    insights = _insurance_insights(insurances, today)

    return {
        "total_annual_premium":  round(total_annual_premium, 2),
        "total_monthly_premium": round(total_monthly_premium, 2),
        "total_cover":           round(total_cover, 2),
        "total_sum_assured":     round(total_sum_assured, 2),
        "policy_count":          len(active),
        "by_type":               list(by_type.values()),
        "policy_cards":          policy_cards,
        "coverage_gaps":         coverage_gaps,
        "insights":              insights,
    }
