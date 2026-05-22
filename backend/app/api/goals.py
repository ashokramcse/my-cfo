from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import date
from dateutil.relativedelta import relativedelta
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.goal import Goal
from pydantic import BaseModel

router = APIRouter()

# ─── Pydantic schemas ─────────────────────────────────────────────────────────
class GoalCreate(BaseModel):
    name: str
    goal_type: str
    target_amount: float
    current_amount: float = 0
    monthly_contribution: float = 0
    target_date: Optional[date] = None
    priority: str = "MEDIUM"
    icon_color: str = "#F59E0B"
    notes: Optional[str] = None

class GoalUpdate(BaseModel):
    name: Optional[str] = None
    goal_type: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    monthly_contribution: Optional[float] = None
    target_date: Optional[date] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    icon_color: Optional[str] = None
    notes: Optional[str] = None

class GoalContribute(BaseModel):
    amount: float
    notes: Optional[str] = None


# ─── Type metadata ────────────────────────────────────────────────────────────
TYPE_LABELS = {
    "EMERGENCY_FUND": "Emergency Fund", "RETIREMENT": "Retirement",
    "HOUSE":   "House Purchase", "CAR": "Car Purchase",
    "EDUCATION": "Education",   "VACATION": "Vacation",
    "DEBT_FREE": "Debt Free",   "INVESTMENT": "Corpus Growth",
    "WEDDING": "Wedding",       "OTHER": "Other",
}
TYPE_COLORS = {
    "EMERGENCY_FUND": "#10B981", "RETIREMENT": "#3B82F6",
    "HOUSE":   "#F59E0B",        "CAR": "#D97706",
    "EDUCATION": "#8B5CF6",     "VACATION": "#EC4899",
    "DEBT_FREE": "#EF4444",     "INVESTMENT": "#06B6D4",
    "WEDDING":   "#F472B6",     "OTHER": "#6B7280",
}
TYPE_EMOJIS = {
    "EMERGENCY_FUND": "🛡️", "RETIREMENT": "🏖️",
    "HOUSE": "🏠", "CAR": "🚗", "EDUCATION": "🎓",
    "VACATION": "✈️", "DEBT_FREE": "🔓", "INVESTMENT": "📈",
    "WEDDING": "💍", "OTHER": "🎯",
}


def _months_to_achieve(remaining: float, monthly: float) -> int | None:
    if monthly <= 0 or remaining <= 0:
        return None
    return int(remaining / monthly) + 1


def _goal_insights(goals: list) -> list:
    insights = []
    active = [g for g in goals if str(g.status) == "ACTIVE"]

    has_emergency = any(str(g.goal_type) == "EMERGENCY_FUND" for g in active)
    if not has_emergency:
        insights.append({
            "severity": "WARNING",
            "title": "No Emergency Fund Goal",
            "body": "Set a goal to build 6 months of expenses as an emergency fund. "
                    "This is your financial safety net before any investing.",
            "action": "goals",
        })

    # Goals behind schedule
    today = date.today()
    behind = []
    for g in active:
        if not g.target_date:
            continue
        remaining = float(g.target_amount or 0) - float(g.current_amount or 0)
        months_left = (g.target_date.year - today.year) * 12 + (g.target_date.month - today.month)
        if months_left <= 0:
            continue
        needed_monthly = remaining / months_left
        actual_monthly = float(g.monthly_contribution or 0)
        if needed_monthly > actual_monthly * 1.2 and actual_monthly > 0:
            behind.append(g.name)

    if behind:
        insights.append({
            "severity": "WARNING",
            "title": f"{len(behind)} Goal(s) Behind Schedule",
            "body": f"{', '.join(behind[:2])} will miss target date at current contribution rate. "
                    "Consider increasing monthly savings.",
            "action": "goals",
        })

    return insights[:4]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("")
async def list_goals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.priority, Goal.target_date)
    )
    return result.scalars().all()


@router.post("")
async def create_goal(
    data: GoalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(user_id=current_user.id, **data.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.patch("/{goal_id}")
async def update_goal(
    goal_id: uuid.UUID,
    data: GoalUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    # Auto-mark achieved
    if float(goal.current_amount or 0) >= float(goal.target_amount or 0):
        goal.status = "ACHIEVED"  # type: ignore[assignment]
    await db.commit()
    await db.refresh(goal)
    return goal


@router.post("/{goal_id}/contribute")
async def contribute_to_goal(
    goal_id: uuid.UUID,
    data: GoalContribute,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    goal.current_amount = (goal.current_amount or 0) + data.amount  # type: ignore[assignment]
    if float(goal.current_amount) >= float(goal.target_amount or 0):
        goal.status = "ACHIEVED"  # type: ignore[assignment]
    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}")
async def delete_goal(
    goal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.id == goal_id, Goal.user_id == current_user.id)
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
    await db.commit()
    return {"ok": True}


# ─── Intelligence ─────────────────────────────────────────────────────────────

@router.get("/analytics/intelligence")
async def goal_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Goal).where(Goal.user_id == current_user.id)
    )
    goals = result.scalars().all()
    today = date.today()

    goal_cards = []
    total_target      = 0.0
    total_saved       = 0.0
    total_monthly_req = 0.0
    achieved_count    = 0

    for g in sorted(goals, key=lambda x: (x.priority != "HIGH", x.target_date or date(2099, 1, 1))):
        target  = float(g.target_amount or 0)
        current = float(g.current_amount or 0)
        monthly = float(g.monthly_contribution or 0)
        remaining = max(0, target - current)
        pct_done  = min(100, round(current / target * 100, 1)) if target > 0 else 0
        months_to = _months_to_achieve(remaining, monthly)

        # Expected completion
        eta = None
        if months_to and months_to > 0:
            eta_date = today + relativedelta(months=months_to)
            eta = str(eta_date)

        # On-track status
        on_track = True
        if g.target_date and monthly > 0 and remaining > 0:
            months_left = (g.target_date.year - today.year) * 12 + (g.target_date.month - today.month)
            needed = remaining / max(months_left, 1)
            on_track = monthly >= needed * 0.85

        if str(g.status) == "ACHIEVED":
            achieved_count += 1
        else:
            total_target      += target
            total_saved       += current
            total_monthly_req += monthly

        goal_cards.append({
            "id":            str(g.id),
            "name":          g.name,
            "goal_type":     str(g.goal_type),
            "label":         TYPE_LABELS.get(str(g.goal_type), ""),
            "color":         g.icon_color or TYPE_COLORS.get(str(g.goal_type), "#6B7280"),
            "emoji":         TYPE_EMOJIS.get(str(g.goal_type), "🎯"),
            "target":        target,
            "current":       current,
            "remaining":     remaining,
            "pct_done":      pct_done,
            "monthly":       monthly,
            "months_to":     months_to,
            "eta":           eta,
            "target_date":   str(g.target_date) if g.target_date else None,
            "on_track":      on_track,
            "priority":      str(g.priority),
            "status":        str(g.status),
            "notes":         g.notes,
        })

    overall_pct = round(total_saved / total_target * 100, 1) if total_target > 0 else 0
    insights    = _goal_insights(goals)

    return {
        "total_target":      round(total_target, 2),
        "total_saved":       round(total_saved, 2),
        "overall_pct":       overall_pct,
        "total_monthly_req": round(total_monthly_req, 2),
        "active_count":      len([g for g in goals if str(g.status) == "ACTIVE"]),
        "achieved_count":    achieved_count,
        "goal_cards":        goal_cards,
        "insights":          insights,
    }
