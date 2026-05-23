from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import date, timedelta
from decimal import Decimal
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.utils.enum_utils import ev
from app.models.user import User
from app.models.income import IncomeSource, IncomeEntry, IncomeType
from pydantic import BaseModel

router = APIRouter()

# ─── Pydantic schemas ─────────────────────────────────────────────────────────

class IncomeSourceCreate(BaseModel):
    name: str
    income_type: str
    employer: Optional[str] = None
    monthly_amount: float
    is_variable: bool = False
    variable_min: Optional[float] = None
    variable_max: Optional[float] = None
    tax_deducted_pct: float = 0
    is_active: bool = True
    start_date: Optional[date] = None
    notes: Optional[str] = None

class IncomeSourceUpdate(BaseModel):
    name: Optional[str] = None
    income_type: Optional[str] = None
    employer: Optional[str] = None
    monthly_amount: Optional[float] = None
    is_variable: Optional[bool] = None
    variable_min: Optional[float] = None
    variable_max: Optional[float] = None
    tax_deducted_pct: Optional[float] = None
    is_active: Optional[bool] = None
    start_date: Optional[date] = None
    notes: Optional[str] = None

class IncomeEntryCreate(BaseModel):
    source_id: str
    entry_date: date
    amount: float
    notes: Optional[str] = None


# ─── Type metadata ────────────────────────────────────────────────────────────
TYPE_LABELS = {
    "SALARY":      "Salary",       "FREELANCE":   "Freelancing",
    "BUSINESS":    "Business",     "CONSULTING":  "Consulting",
    "RENTAL":      "Rental",       "INTEREST":    "Interest",
    "DIVIDEND":    "Dividends",    "SIDE_HUSTLE": "Side Hustle",
    "PENSION":     "Pension",      "REMITTANCE":  "Remittance",
    "OTHER":       "Other",
}
TYPE_COLORS = {
    "SALARY":      "#10B981", "FREELANCE":   "#F59E0B",
    "BUSINESS":    "#3B82F6", "CONSULTING":  "#8B5CF6",
    "RENTAL":      "#D97706", "INTEREST":    "#06B6D4",
    "DIVIDEND":    "#EC4899", "SIDE_HUSTLE": "#84CC16",
    "PENSION":     "#6B7280", "REMITTANCE":  "#14B8A6",
    "OTHER":       "#9CA3AF",
}


def _income_insights(sources, entries, total_monthly):
    insights = []

    # No income sources
    if not sources:
        return [{"severity": "INFO", "title": "Track Your Income",
                 "body": "Add your income sources to understand your cash flow and financial capacity.",
                 "action": "income"}]

    # Single income source risk
    active_sources = [s for s in sources if s.is_active]
    if len(active_sources) == 1:
        insights.append({
            "severity": "WARNING",
            "title": "Single Income Source Risk",
            "body": "You rely on one income source. Consider building alternative streams — "
                    "freelancing, dividends, or rental income — to reduce risk.",
            "action": "income",
        })

    # High tax burden
    for s in active_sources:
        if float(s.tax_deducted_pct or 0) > 30:
            insights.append({
                "severity": "INFO",
                "title": f"High TDS on {s.name}",
                "body": f"{float(s.tax_deducted_pct):.0f}% TDS deducted. "
                        "Maximise 80C, 80D, HRA deductions to reduce tax outgo.",
                "action": "income",
            })
            break

    # Variable income instability
    variable = [s for s in active_sources if s.is_variable]
    if variable and len(variable) == len(active_sources):
        insights.append({
            "severity": "WARNING",
            "title": "All Income is Variable",
            "body": "Your income fluctuates every month. Maintain 6+ months of expenses "
                    "as an emergency fund before aggressive investing.",
            "action": "banking",
        })

    return insights[:4]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("/sources")
async def list_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(IncomeSource)
        .where(IncomeSource.user_id == current_user.id)
        .order_by(IncomeSource.monthly_amount.desc())
    )
    return result.scalars().all()


@router.post("/sources")
async def create_source(
    data: IncomeSourceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    source = IncomeSource(user_id=current_user.id, **data.model_dump())
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source


@router.patch("/sources/{source_id}")
async def update_source(
    source_id: uuid.UUID,
    data: IncomeSourceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(IncomeSource).where(
            IncomeSource.id == source_id,
            IncomeSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Income source not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    await db.commit()
    await db.refresh(source)
    return source


@router.delete("/sources/{source_id}")
async def delete_source(
    source_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(IncomeSource).where(
            IncomeSource.id == source_id,
            IncomeSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(status_code=404, detail="Income source not found")
    await db.delete(source)
    await db.commit()
    return {"ok": True}


@router.get("/entries")
async def list_entries(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    source_id: Optional[str] = Query(None),
    months: int = Query(6, ge=1, le=24),
):
    cutoff = date.today().replace(day=1) - timedelta(days=30 * (months - 1))
    q = select(IncomeEntry).where(
        IncomeEntry.user_id == current_user.id,
        IncomeEntry.entry_date >= cutoff,
    )
    if source_id:
        q = q.where(IncomeEntry.source_id == uuid.UUID(source_id))
    result = await db.execute(q.order_by(IncomeEntry.entry_date.desc()))
    return result.scalars().all()


@router.post("/entries")
async def create_entry(
    data: IncomeEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = IncomeEntry(
        user_id=current_user.id,
        source_id=uuid.UUID(data.source_id),
        entry_date=data.entry_date,
        amount=data.amount,
        notes=data.notes,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}")
async def delete_entry(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(IncomeEntry).where(
            IncomeEntry.id == entry_id,
            IncomeEntry.user_id == current_user.id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"ok": True}


# ─── Intelligence ─────────────────────────────────────────────────────────────

@router.get("/analytics/intelligence")
async def income_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    months: int = Query(6, ge=1, le=24),
):
    # Sources
    src_result = await db.execute(
        select(IncomeSource).where(IncomeSource.user_id == current_user.id)
    )
    sources = src_result.scalars().all()
    active = [s for s in sources if s.is_active]

    # Entries (last N months)
    cutoff = date.today().replace(day=1)
    for _ in range(months - 1):
        if cutoff.month == 1:
            cutoff = cutoff.replace(year=cutoff.year - 1, month=12)
        else:
            cutoff = cutoff.replace(month=cutoff.month - 1)

    ent_result = await db.execute(
        select(IncomeEntry).where(
            IncomeEntry.user_id == current_user.id,
            IncomeEntry.entry_date >= cutoff,
        ).order_by(IncomeEntry.entry_date)
    )
    entries = ent_result.scalars().all()

    # ── Totals ────────────────────────────────────────────────────────────────
    total_monthly_gross = sum(float(s.monthly_amount or 0) for s in active)
    total_tds           = sum(
        float(s.monthly_amount or 0) * float(s.tax_deducted_pct or 0) / 100
        for s in active
    )
    total_monthly_net   = total_monthly_gross - total_tds

    # Yearly projections
    annual_gross = total_monthly_gross * 12
    annual_net   = total_monthly_net * 12

    # ── By type breakdown ─────────────────────────────────────────────────────
    by_type: dict = {}
    for s in active:
        t = ev(s.income_type)
        if t not in by_type:
            by_type[t] = {
                "type": t, "label": TYPE_LABELS.get(t, t),
                "color": TYPE_COLORS.get(t, "#6B7280"),
                "monthly": 0.0, "count": 0,
            }
        by_type[t]["monthly"] += float(s.monthly_amount or 0)
        by_type[t]["count"]   += 1

    for entry in by_type.values():
        entry["pct"] = round(entry["monthly"] / total_monthly_gross * 100, 1) if total_monthly_gross > 0 else 0

    by_type_list = sorted(by_type.values(), key=lambda x: -x["monthly"])

    # ── Monthly actual income trend ───────────────────────────────────────────
    monthly_map: dict = {}
    for e in entries:
        key = e.entry_date.strftime("%b %y")
        monthly_map[key] = monthly_map.get(key, 0.0) + float(e.amount or 0)

    monthly_trend = [{"month": m, "amount": round(a, 2)} for m, a in monthly_map.items()]

    # ── Source cards ──────────────────────────────────────────────────────────
    source_cards = [
        {
            "id":            str(s.id),
            "name":          s.name,
            "income_type":   ev(s.income_type),
            "label":         TYPE_LABELS.get(ev(s.income_type), ""),
            "color":         TYPE_COLORS.get(ev(s.income_type), "#6B7280"),
            "employer":      s.employer or "",
            "monthly":       float(s.monthly_amount or 0),
            "tds_pct":       float(s.tax_deducted_pct or 0),
            "net_monthly":   round(float(s.monthly_amount or 0) * (1 - float(s.tax_deducted_pct or 0) / 100), 2),
            "is_variable":   s.is_variable,
            "variable_min":  float(s.variable_min or 0),
            "variable_max":  float(s.variable_max or 0),
            "is_active":     s.is_active,
            "start_date":    str(s.start_date) if s.start_date else None,
        }
        for s in sorted(sources, key=lambda x: float(x.monthly_amount or 0), reverse=True)
    ]

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = _income_insights(sources, entries, total_monthly_gross)

    return {
        "total_monthly_gross": round(total_monthly_gross, 2),
        "total_monthly_net":   round(total_monthly_net, 2),
        "total_tds":           round(total_tds, 2),
        "annual_gross":        round(annual_gross, 2),
        "annual_net":          round(annual_net, 2),
        "source_count":        len(active),
        "by_type":             by_type_list,
        "source_cards":        source_cards,
        "monthly_trend":       monthly_trend,
        "insights":            insights,
    }
