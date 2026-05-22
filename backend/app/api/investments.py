from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from decimal import Decimal
from datetime import date, timedelta
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.investment import Investment
from app.schemas.investment import InvestmentCreate, InvestmentUpdate, InvestmentOut

router = APIRouter()

# ─── Asset class groupings ────────────────────────────────────────────────────
ASSET_CLASS_MAP = {
    "STOCKS": "Equity",
    "ETF":    "Equity",
    "REITS":  "Equity",
    "MUTUAL_FUND": "Mutual Funds",
    "BONDS": "Debt",
    "PPF":   "Debt",
    "EPF":   "Debt",
    "NPS":   "Debt",
    "GOLD":   "Gold & Metals",
    "SILVER": "Gold & Metals",
    "SGB":    "Gold & Metals",
    "CRYPTO": "Crypto",
    "OTHER":  "Other",
}

ASSET_CLASS_COLORS = {
    "Equity":       "#F59E0B",
    "Mutual Funds": "#8B5CF6",
    "Debt":         "#3B82F6",
    "Gold & Metals":"#D97706",
    "Crypto":       "#EF4444",
    "Other":        "#6B7280",
}

TYPE_LABELS = {
    "STOCKS": "Stocks", "ETF": "ETF", "REITS": "REITs",
    "MUTUAL_FUND": "Mutual Funds", "BONDS": "Bonds",
    "PPF": "PPF", "EPF": "EPF", "NPS": "NPS",
    "GOLD": "Gold", "SILVER": "Silver", "SGB": "SGB",
    "CRYPTO": "Crypto", "OTHER": "Other",
}

TYPE_COLORS = {
    "STOCKS":      "#F59E0B", "ETF": "#FBBF24", "REITS": "#FCD34D",
    "MUTUAL_FUND": "#8B5CF6",
    "BONDS":       "#3B82F6", "PPF": "#60A5FA", "EPF": "#93C5FD", "NPS": "#BFDBFE",
    "GOLD":        "#D97706", "SILVER": "#9CA3AF", "SGB": "#B45309",
    "CRYPTO":      "#EF4444",
    "OTHER":       "#6B7280",
}


def _diversification_score(by_class: dict, total: float) -> int:
    """0–100 score. More classes + lower top concentration = higher score."""
    if total <= 0:
        return 0
    num_classes = len([v for v in by_class.values() if v > 0])
    max_pct = max((v / total * 100) for v in by_class.values()) if by_class else 100
    score = min(100, num_classes * 12 + max(0, 100 - max_pct) * 0.55)
    return round(score)


def _investment_insights(investments: list, total_value: float, by_class: dict,
                         sip_monthly: float, locked_value: float) -> list:
    insights = []

    if total_value <= 0:
        return insights

    # Concentration risk
    for cls, val in by_class.items():
        pct = val / total_value * 100
        if pct > 60:
            insights.append({
                "severity": "CRITICAL",
                "title": f"Heavy {cls} Concentration",
                "body": f"{pct:.0f}% of your portfolio is in {cls}. "
                        "Diversify across asset classes to reduce risk.",
                "action": "investments",
            })
        elif pct > 40:
            insights.append({
                "severity": "WARNING",
                "title": f"High {cls} Exposure",
                "body": f"{pct:.0f}% of portfolio in {cls}. Consider rebalancing.",
                "action": "investments",
            })

    # Crypto risk
    crypto_val = by_class.get("Crypto", 0)
    if crypto_val / total_value > 0.20:
        insights.append({
            "severity": "WARNING",
            "title": "Crypto Overexposure",
            "body": f"Crypto is {crypto_val/total_value*100:.0f}% of portfolio — "
                    "high volatility risk. Cap crypto at 5–10% for balanced portfolios.",
            "action": "investments",
        })

    # No debt allocation
    debt_val = by_class.get("Debt", 0)
    if debt_val == 0 and total_value > 50000:
        insights.append({
            "severity": "INFO",
            "title": "No Fixed Income Allocation",
            "body": "You have no bonds, PPF, EPF or NPS. "
                    "Adding debt instruments stabilizes portfolio during market downturns.",
            "action": "investments",
        })

    # Underperformers
    losers = [i for i in investments
              if float(i.unrealized_pnl or 0) < 0
              and float(i.invested_amount or 0) > 10000]
    if len(losers) >= 3:
        total_loss = sum(float(i.unrealized_pnl or 0) for i in losers)
        insights.append({
            "severity": "WARNING",
            "title": f"{len(losers)} Underperforming Holdings",
            "body": f"You have {len(losers)} investments with unrealised losses "
                    f"totalling ₹{abs(total_loss):,.0f}. Review for tax-loss harvesting.",
            "action": "investments",
        })

    # SIP nudge
    if sip_monthly == 0 and total_value > 0:
        insights.append({
            "severity": "INFO",
            "title": "No Active SIPs",
            "body": "Set up SIPs to build wealth systematically with rupee-cost averaging.",
            "action": "investments",
        })

    # Locked investments alert
    if locked_value > 0:
        pct = locked_value / total_value * 100
        if pct > 30:
            insights.append({
                "severity": "INFO",
                "title": f"{pct:.0f}% of Portfolio is Locked",
                "body": f"₹{locked_value:,.0f} is in lock-in investments (PPF/ELSS/etc). "
                        "Ensure you have adequate liquid investments.",
                "action": "investments",
            })

    return insights[:6]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[InvestmentOut])
async def list_investments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment)
        .where(Investment.user_id == current_user.id)
        .order_by(Investment.investment_type, Investment.name)
    )
    return result.scalars().all()


@router.post("", response_model=InvestmentOut)
async def create_investment(
    data: InvestmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = data.model_dump()
    units = payload.get("units") or Decimal("0")
    current_price = payload.get("current_price") or Decimal("0")
    payload["current_value"] = units * current_price
    if payload["current_value"] == 0 and payload.get("invested_amount"):
        payload["current_value"] = payload["invested_amount"]

    investment = Investment(user_id=current_user.id, **payload)
    investment.unrealized_pnl = (investment.current_value or 0) - (investment.invested_amount or 0)
    db.add(investment)
    await db.commit()
    await db.refresh(investment)
    return investment


@router.patch("/{investment_id}", response_model=InvestmentOut)
async def update_investment(
    investment_id: uuid.UUID,
    data: InvestmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.user_id == current_user.id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(inv, field, value)

    if "current_price" in updates or "units" in updates:
        inv.current_value = (inv.units or Decimal("0")) * (inv.current_price or Decimal("0"))
    inv.unrealized_pnl = (inv.current_value or Decimal("0")) - (inv.invested_amount or Decimal("0"))

    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/{investment_id}")
async def delete_investment(
    investment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.user_id == current_user.id,
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    await db.delete(inv)
    await db.commit()
    return {"ok": True}


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/summary")
async def investment_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id)
    )
    investments = result.scalars().all()

    total_invested = sum(float(i.invested_amount or 0) for i in investments)
    total_current  = sum(float(i.current_value or 0) for i in investments)
    total_pnl      = total_current - total_invested
    pnl_pct        = (total_pnl / total_invested * 100) if total_invested > 0 else 0

    by_type: dict = {}
    for inv in investments:
        t = inv.investment_type
        if t not in by_type:
            by_type[t] = {"type": t, "invested": 0, "current": 0, "count": 0}
        by_type[t]["invested"] += float(inv.invested_amount or 0)
        by_type[t]["current"] += float(inv.current_value or 0)
        by_type[t]["count"] += 1

    return {
        "total_invested": total_invested,
        "total_current_value": total_current,
        "total_pnl": total_pnl,
        "pnl_pct": round(pnl_pct, 2),
        "by_type": list(by_type.values()),
    }


@router.get("/analytics/intelligence")
async def investment_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Investment).where(Investment.user_id == current_user.id)
    )
    investments = result.scalars().all()

    # ── Portfolio totals ──────────────────────────────────────────────────────
    total_invested = sum(float(i.invested_amount or 0) for i in investments)
    total_value    = sum(float(i.current_value or 0) for i in investments)
    total_pnl      = total_value - total_invested
    pnl_pct        = (total_pnl / total_invested * 100) if total_invested > 0 else 0
    realized_pnl   = sum(float(i.realized_pnl or 0) for i in investments)

    # ── SIP details ───────────────────────────────────────────────────────────
    active_sips    = [i for i in investments if i.is_sip and i.sip_status == "ACTIVE"]
    sip_monthly    = sum(float(i.sip_amount or 0) for i in active_sips)
    sip_count      = len(active_sips)

    # ── Locked ────────────────────────────────────────────────────────────────
    today = date.today()
    locked = [i for i in investments if i.is_locked or
              (i.lock_in_until and i.lock_in_until > today)]
    locked_value = sum(float(i.current_value or 0) for i in locked)

    # ── By asset class ────────────────────────────────────────────────────────
    by_class: dict[str, float] = {}
    for inv in investments:
        cls = ASSET_CLASS_MAP.get(str(inv.investment_type), "Other")
        by_class[cls] = by_class.get(cls, 0) + float(inv.current_value or 0)

    allocation = [
        {
            "key": cls,
            "label": cls,
            "value": round(val, 2),
            "pct": round(val / total_value * 100, 1) if total_value > 0 else 0,
            "color": ASSET_CLASS_COLORS.get(cls, "#6B7280"),
        }
        for cls, val in sorted(by_class.items(), key=lambda x: -x[1])
        if val > 0
    ]

    # ── By investment type ────────────────────────────────────────────────────
    by_type_map: dict = {}
    for inv in investments:
        t = str(inv.investment_type)
        if t not in by_type_map:
            by_type_map[t] = {
                "type": t, "label": TYPE_LABELS.get(t, t),
                "color": TYPE_COLORS.get(t, "#6B7280"),
                "invested": 0.0, "current": 0.0, "pnl": 0.0,
                "count": 0, "sip_amount": 0.0,
            }
        entry = by_type_map[t]
        entry["invested"] += float(inv.invested_amount or 0)
        entry["current"]  += float(inv.current_value or 0)
        entry["pnl"]      += float(inv.unrealized_pnl or 0)
        entry["count"]    += 1
        if inv.is_sip and inv.sip_status == "ACTIVE":
            entry["sip_amount"] += float(inv.sip_amount or 0)

    for entry in by_type_map.values():
        entry["pnl_pct"] = (
            round(entry["pnl"] / entry["invested"] * 100, 1)
            if entry["invested"] > 0 else 0
        )
        entry["pct"] = round(entry["current"] / total_value * 100, 1) if total_value > 0 else 0

    by_type = sorted(by_type_map.values(), key=lambda x: -x["current"])

    # ── Top holdings ──────────────────────────────────────────────────────────
    sorted_holdings = sorted(investments,
                             key=lambda i: float(i.current_value or 0),
                             reverse=True)
    top_holdings = [
        {
            "id": str(i.id),
            "name": i.name,
            "type": str(i.investment_type),
            "label": TYPE_LABELS.get(str(i.investment_type), ""),
            "color": TYPE_COLORS.get(str(i.investment_type), "#6B7280"),
            "invested": float(i.invested_amount or 0),
            "current": float(i.current_value or 0),
            "pnl": float(i.unrealized_pnl or 0),
            "pnl_pct": (
                round(float(i.unrealized_pnl or 0) / float(i.invested_amount) * 100, 1)
                if float(i.invested_amount or 0) > 0 else 0
            ),
            "is_sip": i.is_sip,
            "sip_amount": float(i.sip_amount or 0),
            "broker": i.broker or i.platform or "",
            "symbol": i.symbol or "",
            "is_locked": bool(i.is_locked or (i.lock_in_until and i.lock_in_until > today)),
            "pct": round(float(i.current_value or 0) / total_value * 100, 1) if total_value > 0 else 0,
        }
        for i in sorted_holdings[:15]
    ]

    # ── CAGR computation for top holdings ─────────────────────────────────────
    for holding in top_holdings:
        inv = next((i for i in investments if str(i.id) == holding["id"]), None)
        if inv and inv.purchase_date and float(inv.invested_amount or 0) > 0:
            years = max(0.083, (today - inv.purchase_date).days / 365.25)  # min 1 month
            ratio = float(inv.current_value or 0) / float(inv.invested_amount)
            if ratio > 0:
                cagr = (ratio ** (1 / years) - 1) * 100
            else:
                cagr = -100.0
            holding["cagr"] = round(cagr, 2)
        else:
            holding["cagr"] = None

    # ── Best / worst performers ───────────────────────────────────────────────
    perf_candidates = [i for i in investments if float(i.invested_amount or 0) > 0]
    def _pnl_pct(i):
        inv = float(i.invested_amount or 0)
        return float(i.unrealized_pnl or 0) / inv * 100 if inv > 0 else 0

    best  = sorted(perf_candidates, key=_pnl_pct, reverse=True)[:3]
    worst = sorted(perf_candidates, key=_pnl_pct)[:3]

    def _perf_row(i):
        return {
            "name": i.name, "type": TYPE_LABELS.get(str(i.investment_type), ""),
            "pnl": float(i.unrealized_pnl or 0), "pnl_pct": round(_pnl_pct(i), 1),
        }

    # ── Diversification score ─────────────────────────────────────────────────
    div_score = _diversification_score(by_class, total_value)

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = _investment_insights(investments, total_value, by_class,
                                    sip_monthly, locked_value)

    return {
        # Totals
        "total_invested":    round(total_invested, 2),
        "total_value":       round(total_value, 2),
        "total_pnl":         round(total_pnl, 2),
        "pnl_pct":           round(pnl_pct, 2),
        "realized_pnl":      round(realized_pnl, 2),
        # SIPs
        "sip_monthly":       round(sip_monthly, 2),
        "sip_count":         sip_count,
        # Locked
        "locked_value":      round(locked_value, 2),
        # Charts
        "allocation":        allocation,
        "by_type":           by_type,
        "top_holdings":      top_holdings,
        # Performers
        "best_performers":   [_perf_row(i) for i in best],
        "worst_performers":  [_perf_row(i) for i in worst],
        # Score
        "diversification_score": div_score,
        # AI
        "insights":          insights,
    }
