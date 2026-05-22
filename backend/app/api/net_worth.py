"""
Net Worth Intelligence Engine
─────────────────────────────
Real-time wealth calculation across all asset classes:
  Assets   → bank accounts, investments (stocks/MF/crypto/gold…), physical assets
  Liabilities → credit cards, loans, active EMIs

Derived metrics:
  liquid_net_worth   = liquid_assets - short_term_liabilities
  debt_ratio         = total_liabilities / total_assets × 100
  investment_ratio   = investment_value / total_assets × 100
  emergency_months   = liquid_assets / monthly_emi_burn (approx)
  health_score       = composite 0–100 (see _health_score())
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone
from typing import List

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.bank_account import BankAccount
from app.models.investment import Investment
from app.models.loan import Loan
from app.models.asset import Asset
from app.models.card import CreditCard
from app.models.emi import EMI, EMIStatus
from app.models.net_worth import NetWorthSnapshot
from app.services.financial_context import build_financial_context

router = APIRouter()

# ─── Liquid account types ─────────────────────────────────────────────────────
LIQUID_ACCOUNT_TYPES = {"SAVINGS", "CURRENT", "SALARY", "WALLET", "UPI", "CASH"}
SEMI_LIQUID_TYPES    = {"FD", "RD"}   # accessible with penalty

# ─── Investment liquidity tiers ───────────────────────────────────────────────
LIQUID_INVESTMENT_TYPES  = {"STOCKS", "ETF", "CRYPTO", "MUTUAL_FUND"}
ILLIQUID_INVESTMENT_TYPES = {"PPF", "EPF", "NPS", "SGB", "BONDS"}
PHYSICAL_INVESTMENT_TYPES = {"GOLD", "SILVER", "REITS", "OTHER"}

# ─── Asset class display names ────────────────────────────────────────────────
ASSET_CLASS_LABELS = {
    "bank_liquid":   "Cash & Banking",
    "bank_fd":       "Fixed Deposits",
    "stocks_etf":    "Stocks & ETF",
    "mutual_funds":  "Mutual Funds",
    "crypto":        "Crypto",
    "gold_silver":   "Gold & Silver",
    "pf_nps":        "PF / NPS / PPF",
    "real_estate":   "Real Estate",
    "vehicle":       "Vehicles",
    "physical":      "Physical Assets",
}

ASSET_CLASS_COLORS = {
    "bank_liquid":  "#0EA5E9",
    "bank_fd":      "#38BDF8",
    "stocks_etf":   "#7C3AED",
    "mutual_funds": "#A855F7",
    "crypto":       "#F59E0B",
    "gold_silver":  "#EAB308",
    "pf_nps":       "#10B981",
    "real_estate":  "#059669",
    "vehicle":      "#F97316",
    "physical":     "#6B7280",
}


# ─── Core calculation engine ──────────────────────────────────────────────────

async def _build_intelligence(db: AsyncSession, user_id) -> dict:
    """
    Full wealth intelligence computation.
    Returns a rich dict consumed by /intelligence and /snapshot.
    """

    # ── Bank accounts ─────────────────────────────────────────────────────────
    bank_res = await db.execute(
        select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.is_active == True)
    )
    banks = bank_res.scalars().all()

    bank_liquid     = sum(float(b.current_balance or 0) for b in banks if b.account_type in LIQUID_ACCOUNT_TYPES)
    bank_fd         = sum(float(b.current_balance or 0) for b in banks if b.account_type in SEMI_LIQUID_TYPES)
    bank_total      = bank_liquid + bank_fd

    # ── Investments ───────────────────────────────────────────────────────────
    inv_res = await db.execute(select(Investment).where(Investment.user_id == user_id))
    invs = inv_res.scalars().all()

    stocks_etf   = sum(float(i.current_value or 0) for i in invs if i.investment_type in ("STOCKS", "ETF"))
    mutual_funds = sum(float(i.current_value or 0) for i in invs if i.investment_type == "MUTUAL_FUND")
    crypto       = sum(float(i.current_value or 0) for i in invs if i.investment_type == "CRYPTO")
    gold_silver  = sum(float(i.current_value or 0) for i in invs if i.investment_type in ("GOLD", "SILVER", "SGB"))
    pf_nps       = sum(float(i.current_value or 0) for i in invs if i.investment_type in ("PPF", "EPF", "NPS"))

    total_invested      = sum(float(i.invested_amount or 0) for i in invs)
    investment_value    = sum(float(i.current_value  or 0) for i in invs)
    investment_pnl      = investment_value - total_invested

    # liquid subset of investments (sellable in <3 days)
    liquid_investments  = sum(float(i.current_value or 0) for i in invs
                              if i.investment_type in LIQUID_INVESTMENT_TYPES and not i.is_locked)

    # ── Physical assets ───────────────────────────────────────────────────────
    asset_res = await db.execute(select(Asset).where(Asset.user_id == user_id))
    assets = asset_res.scalars().all()

    real_estate_val = sum(float(a.current_value or 0) for a in assets if a.asset_type == "REAL_ESTATE")
    vehicle_val     = sum(float(a.current_value or 0) for a in assets if a.asset_type == "VEHICLE")
    physical_val    = sum(float(a.current_value or 0) for a in assets
                          if a.asset_type not in ("REAL_ESTATE", "VEHICLE"))
    asset_value     = real_estate_val + vehicle_val + physical_val

    # ── Liabilities ───────────────────────────────────────────────────────────
    loan_res = await db.execute(
        select(Loan).where(Loan.user_id == user_id, Loan.status == "ACTIVE")
    )
    active_loans = loan_res.scalars().all()
    loan_outstanding     = sum(float(l.outstanding_balance or 0) for l in active_loans)
    monthly_loan_emi     = sum(float(l.emi_amount or 0)          for l in active_loans)
    secured_debt         = sum(float(l.outstanding_balance or 0) for l in active_loans if l.is_secured)
    unsecured_debt       = loan_outstanding - secured_debt

    card_res = await db.execute(
        select(CreditCard).where(CreditCard.user_id == user_id)
    )
    cards = card_res.scalars().all()
    cc_outstanding = sum(float(c.current_outstanding or 0) for c in cards)
    cc_total_limit  = sum(float(c.credit_limit or 0)       for c in cards)
    cc_utilization  = (cc_outstanding / cc_total_limit * 100) if cc_total_limit else 0

    # ── EMI burden (active self EMIs) ─────────────────────────────────────────
    emi_res = await db.execute(
        select(EMI).where(EMI.user_id == user_id, EMI.status == EMIStatus.ACTIVE)
    )
    active_emis = emi_res.scalars().all()
    monthly_emi_burden = sum(float(e.monthly_emi or 0) for e in active_emis)

    # ── Aggregate totals ──────────────────────────────────────────────────────
    total_assets      = bank_total + investment_value + asset_value
    total_liabilities = loan_outstanding + cc_outstanding
    net_worth         = total_assets - total_liabilities

    # Liquid net worth = liquid assets - short-term liabilities (CC + unsecured)
    liquid_assets     = bank_liquid + liquid_investments
    liquid_liabilities = cc_outstanding + unsecured_debt
    liquid_net_worth  = liquid_assets - liquid_liabilities

    # Debt ratio (0–100%)
    debt_ratio = (total_liabilities / total_assets * 100) if total_assets > 0 else 0

    # Investment ratio
    investment_ratio = (investment_value / total_assets * 100) if total_assets > 0 else 0

    # Monthly cash burn estimate
    monthly_burn = monthly_loan_emi + monthly_emi_burden
    emergency_months = (liquid_assets / monthly_burn) if monthly_burn > 0 else (
        12.0 if liquid_assets > 0 else 0.0
    )

    # ── Financial health score (0–100) ────────────────────────────────────────
    health_score, health_breakdown = _health_score(
        debt_ratio=debt_ratio,
        cc_utilization=cc_utilization,
        emergency_months=emergency_months,
        investment_ratio=investment_ratio,
        net_worth=net_worth,
        liquid_net_worth=liquid_net_worth,
    )

    # ── Asset allocation buckets ──────────────────────────────────────────────
    allocation = [
        {"key": "bank_liquid",  "label": ASSET_CLASS_LABELS["bank_liquid"],  "value": round(bank_liquid,   2), "color": ASSET_CLASS_COLORS["bank_liquid"]},
        {"key": "bank_fd",      "label": ASSET_CLASS_LABELS["bank_fd"],      "value": round(bank_fd,       2), "color": ASSET_CLASS_COLORS["bank_fd"]},
        {"key": "stocks_etf",   "label": ASSET_CLASS_LABELS["stocks_etf"],   "value": round(stocks_etf,    2), "color": ASSET_CLASS_COLORS["stocks_etf"]},
        {"key": "mutual_funds", "label": ASSET_CLASS_LABELS["mutual_funds"], "value": round(mutual_funds,  2), "color": ASSET_CLASS_COLORS["mutual_funds"]},
        {"key": "crypto",       "label": ASSET_CLASS_LABELS["crypto"],       "value": round(crypto,        2), "color": ASSET_CLASS_COLORS["crypto"]},
        {"key": "gold_silver",  "label": ASSET_CLASS_LABELS["gold_silver"],  "value": round(gold_silver,   2), "color": ASSET_CLASS_COLORS["gold_silver"]},
        {"key": "pf_nps",       "label": ASSET_CLASS_LABELS["pf_nps"],       "value": round(pf_nps,        2), "color": ASSET_CLASS_COLORS["pf_nps"]},
        {"key": "real_estate",  "label": ASSET_CLASS_LABELS["real_estate"],  "value": round(real_estate_val, 2), "color": ASSET_CLASS_COLORS["real_estate"]},
        {"key": "vehicle",      "label": ASSET_CLASS_LABELS["vehicle"],      "value": round(vehicle_val,   2), "color": ASSET_CLASS_COLORS["vehicle"]},
        {"key": "physical",     "label": ASSET_CLASS_LABELS["physical"],     "value": round(physical_val,  2), "color": ASSET_CLASS_COLORS["physical"]},
    ]
    allocation = [a for a in allocation if a["value"] > 0]

    # Liability breakdown for waterfall
    liabilities_breakdown = [
        {"key": "home_loan",     "label": "Home Loan",      "value": round(sum(float(l.outstanding_balance or 0) for l in active_loans if l.loan_type == "HOME"), 2),     "color": "#DC2626"},
        {"key": "personal_loan", "label": "Personal Loan",  "value": round(sum(float(l.outstanding_balance or 0) for l in active_loans if l.loan_type == "PERSONAL"), 2), "color": "#F97316"},
        {"key": "vehicle_loan",  "label": "Vehicle Loan",   "value": round(sum(float(l.outstanding_balance or 0) for l in active_loans if l.loan_type == "VEHICLE"), 2),  "color": "#F59E0B"},
        {"key": "edu_loan",      "label": "Education Loan", "value": round(sum(float(l.outstanding_balance or 0) for l in active_loans if l.loan_type == "EDUCATION"), 2),"color": "#8B5CF6"},
        {"key": "other_loans",   "label": "Other Loans",    "value": round(sum(float(l.outstanding_balance or 0) for l in active_loans if l.loan_type not in ("HOME","PERSONAL","VEHICLE","EDUCATION")), 2), "color": "#6B7280"},
        {"key": "credit_cards",  "label": "Credit Cards",   "value": round(cc_outstanding, 2), "color": "#EF4444"},
    ]
    liabilities_breakdown = [l for l in liabilities_breakdown if l["value"] > 0]

    # ── AI Rule-based insights ────────────────────────────────────────────────
    insights = _generate_insights(
        net_worth=net_worth,
        liquid_net_worth=liquid_net_worth,
        debt_ratio=debt_ratio,
        cc_utilization=cc_utilization,
        emergency_months=emergency_months,
        investment_ratio=investment_ratio,
        health_score=health_score,
        investment_pnl=investment_pnl,
        total_invested=total_invested,
        liquid_assets=liquid_assets,
        monthly_burn=monthly_burn,
        secured_debt=secured_debt,
        unsecured_debt=unsecured_debt,
        allocation=allocation,
        total_assets=total_assets,
    )

    return {
        # ── Core metrics ──────────────────────────────────────────────────────
        "net_worth":            round(net_worth, 2),
        "liquid_net_worth":     round(liquid_net_worth, 2),
        "total_assets":         round(total_assets, 2),
        "total_liabilities":    round(total_liabilities, 2),
        "liquid_assets":        round(liquid_assets, 2),
        "liquid_investments":   round(liquid_investments, 2),

        # ── Asset breakdown ────────────────────────────────────────────────────
        "bank_total":           round(bank_total, 2),
        "bank_liquid":          round(bank_liquid, 2),
        "bank_fd":              round(bank_fd, 2),
        "investment_value":     round(investment_value, 2),
        "total_invested":       round(total_invested, 2),
        "investment_pnl":       round(investment_pnl, 2),
        "asset_value":          round(asset_value, 2),
        "real_estate_val":      round(real_estate_val, 2),
        "vehicle_val":          round(vehicle_val, 2),

        # ── Liability breakdown ────────────────────────────────────────────────
        "loan_outstanding":     round(loan_outstanding, 2),
        "cc_outstanding":       round(cc_outstanding, 2),
        "secured_debt":         round(secured_debt, 2),
        "unsecured_debt":       round(unsecured_debt, 2),
        "monthly_loan_emi":     round(monthly_loan_emi, 2),
        "monthly_emi_burden":   round(monthly_emi_burden, 2),

        # ── Ratios ─────────────────────────────────────────────────────────────
        "debt_ratio":           round(debt_ratio, 2),
        "cc_utilization":       round(cc_utilization, 2),
        "investment_ratio":     round(investment_ratio, 2),
        "emergency_months":     round(min(emergency_months, 24.0), 1),

        # ── Health ─────────────────────────────────────────────────────────────
        "health_score":         health_score,
        "health_breakdown":     health_breakdown,

        # ── Structured data ────────────────────────────────────────────────────
        "allocation":           allocation,
        "liabilities_breakdown": liabilities_breakdown,
        "insights":             insights,

        # ── Change placeholders (filled by callers) ────────────────────────────
        "change_amount": 0.0,
        "change_pct":    0.0,
    }


def _health_score(
    debt_ratio: float,
    cc_utilization: float,
    emergency_months: float,
    investment_ratio: float,
    net_worth: float,
    liquid_net_worth: float,
) -> tuple[int, list]:
    """
    Financial Health Score — composite 0-100.
    Four pillars: Liquidity, Debt, Investment, Stability
    """
    breakdown = []

    # ── Pillar 1: Liquidity (25 pts) ──────────────────────────────────────────
    if emergency_months >= 6:
        liq = 25
    elif emergency_months >= 3:
        liq = int(15 + (emergency_months - 3) / 3 * 10)
    elif emergency_months >= 1:
        liq = int(5 + (emergency_months - 1) / 2 * 10)
    else:
        liq = 0
    breakdown.append({"pillar": "Liquidity", "score": liq, "max": 25,
                       "label": f"{emergency_months:.1f} months emergency fund"})

    # ── Pillar 2: Debt management (30 pts) ───────────────────────────────────
    debt_score = 0
    if debt_ratio <= 20:
        debt_score += 20
    elif debt_ratio <= 40:
        debt_score += int(20 - (debt_ratio - 20) / 20 * 10)
    elif debt_ratio <= 60:
        debt_score += int(10 - (debt_ratio - 40) / 20 * 5)

    if cc_utilization <= 30:
        debt_score += 10
    elif cc_utilization <= 60:
        debt_score += int(10 - (cc_utilization - 30) / 30 * 7)
    elif cc_utilization <= 80:
        debt_score += 3
    breakdown.append({"pillar": "Debt Health", "score": debt_score, "max": 30,
                       "label": f"{debt_ratio:.0f}% debt ratio, {cc_utilization:.0f}% CC utilization"})

    # ── Pillar 3: Investment discipline (25 pts) ──────────────────────────────
    if investment_ratio >= 40:
        inv_score = 25
    elif investment_ratio >= 20:
        inv_score = int(15 + (investment_ratio - 20) / 20 * 10)
    elif investment_ratio >= 5:
        inv_score = int(5 + (investment_ratio - 5) / 15 * 10)
    else:
        inv_score = 0
    breakdown.append({"pillar": "Investments", "score": inv_score, "max": 25,
                       "label": f"{investment_ratio:.0f}% of assets in investments"})

    # ── Pillar 4: Net worth stability (20 pts) ────────────────────────────────
    stab = 0
    if net_worth > 0:
        stab += 10
    if liquid_net_worth > 0:
        stab += 10
    breakdown.append({"pillar": "Stability", "score": stab, "max": 20,
                       "label": "Positive net worth & liquid position"})

    total = min(100, liq + debt_score + inv_score + stab)
    return total, breakdown


def _generate_insights(
    net_worth, liquid_net_worth, debt_ratio, cc_utilization,
    emergency_months, investment_ratio, health_score, investment_pnl,
    total_invested, liquid_assets, monthly_burn, secured_debt,
    unsecured_debt, allocation, total_assets,
) -> list:
    """Rule-based wealth insights. Returns list of insight dicts."""
    items = []

    # Emergency fund
    if emergency_months < 1:
        items.append({"severity": "CRITICAL", "title": "No Emergency Buffer",
            "body": f"Your liquid assets cover less than 1 month of expenses. Build a ₹{int(monthly_burn * 3):,} emergency fund immediately.",
            "action": "banking"})
    elif emergency_months < 3:
        items.append({"severity": "WARNING", "title": "Thin Emergency Fund",
            "body": f"You have {emergency_months:.1f} months of coverage. Target 6 months ({_fmt(monthly_burn * 6)}) in liquid savings.",
            "action": "banking"})
    elif emergency_months >= 12:
        items.append({"severity": "INFO", "title": "Excess Liquidity",
            "body": f"You have {emergency_months:.1f} months buffer — consider deploying surplus into investments for better returns.",
            "action": "investments"})

    # Debt pressure
    if debt_ratio > 60:
        items.append({"severity": "CRITICAL", "title": "High Debt Burden",
            "body": f"Debt is {debt_ratio:.0f}% of assets. Focus on clearing unsecured debt ({_fmt(unsecured_debt)}) first.",
            "action": "loans"})
    elif debt_ratio > 40:
        items.append({"severity": "WARNING", "title": "Elevated Debt Ratio",
            "body": f"Debt stands at {debt_ratio:.0f}% of total assets. Healthy target is below 30%.",
            "action": "loans"})

    # CC utilization
    if cc_utilization > 80:
        items.append({"severity": "CRITICAL", "title": "Credit Card Overextended",
            "body": f"CC utilization at {cc_utilization:.0f}% — this damages your credit score and signals cash stress.",
            "action": "cards"})
    elif cc_utilization > 50:
        items.append({"severity": "WARNING", "title": "High CC Utilization",
            "body": f"At {cc_utilization:.0f}% utilization, try to stay below 30% for optimal credit health.",
            "action": "cards"})

    # Investment discipline
    if investment_ratio < 10 and total_assets > 100000:
        items.append({"severity": "WARNING", "title": "Under-Invested",
            "body": f"Only {investment_ratio:.0f}% of wealth is in growth assets. Aim for at least 30% in equities/MF.",
            "action": "investments"})
    elif investment_ratio >= 30 and investment_pnl > 0 and total_invested > 0:
        pnl_pct = investment_pnl / total_invested * 100
        items.append({"severity": "INFO", "title": f"Portfolio Gaining {pnl_pct:.1f}%",
            "body": f"Unrealized gain of {_fmt(investment_pnl)} on {_fmt(total_invested)} invested. Consider rebalancing if one asset class > 60%.",
            "action": "investments"})

    # Asset concentration
    if allocation and total_assets > 0:
        top = max(allocation, key=lambda a: a["value"])
        top_pct = top["value"] / total_assets * 100
        if top_pct > 60:
            items.append({"severity": "WARNING", "title": f"Concentration Risk: {top['label']}",
                "body": f"{top_pct:.0f}% of your wealth is in {top['label']}. Diversification reduces risk.",
                "action": "investments"})

    # Positive reinforcement
    if health_score >= 75:
        items.append({"severity": "INFO", "title": f"Strong Financial Health ({health_score}/100)",
            "body": "Your wealth fundamentals are solid. Focus on growing investments and reducing unsecured debt.",
            "action": None})

    if not items:
        items.append({"severity": "INFO", "title": "Add Your Financial Data",
            "body": "Add bank accounts, investments, and loans to get personalized wealth insights.",
            "action": "banking"})

    return items[:6]   # cap at 6


def _fmt(v: float) -> str:
    if v >= 1_00_00_000: return f"₹{v/1_00_00_000:.1f}Cr"
    if v >= 1_00_000:    return f"₹{v/1_00_000:.1f}L"
    if v >= 1_000:       return f"₹{v/1_000:.0f}K"
    return f"₹{v:.0f}"


# ─── HTTP Endpoints ───────────────────────────────────────────────────────────

@router.get("/intelligence")
async def get_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full wealth intelligence payload for the command center dashboard."""
    data = await _build_intelligence(db, current_user.id)

    # Attach change vs last snapshot
    last_snap = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    last = last_snap.scalar_one_or_none()
    if last:
        prev = float(last.net_worth or 0)
        data["change_amount"] = round(data["net_worth"] - prev, 2)
        data["change_pct"]    = round((data["net_worth"] - prev) / abs(prev) * 100, 2) if prev else 0
    return data


@router.get("/current")
async def get_current_net_worth(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lightweight summary — kept for backward compat with existing views."""
    data = await _build_intelligence(db, current_user.id)

    last_snap = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    last = last_snap.scalar_one_or_none()
    if last:
        prev = float(last.net_worth or 0)
        data["change_amount"] = round(data["net_worth"] - prev, 2)
        data["change_pct"]    = round((data["net_worth"] - prev) / abs(prev) * 100, 2) if prev else 0
    return data


@router.post("/snapshot")
async def take_snapshot(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a net worth snapshot for historical trend tracking."""
    data = await _build_intelligence(db, current_user.id)

    last_snap = await db.execute(
        select(NetWorthSnapshot)
        .where(NetWorthSnapshot.user_id == current_user.id)
        .order_by(NetWorthSnapshot.snapshot_date.desc())
        .limit(1)
    )
    last = last_snap.scalar_one_or_none()
    prev_nw   = float(last.net_worth or 0) if last else 0
    change    = data["net_worth"] - prev_nw
    change_pct = (change / abs(prev_nw) * 100) if prev_nw else 0

    snap = NetWorthSnapshot(
        user_id               = current_user.id,
        bank_balance          = data["bank_total"],
        investment_value      = data["investment_value"],
        asset_value           = data["asset_value"],
        total_assets          = data["total_assets"],
        credit_card_outstanding = data["cc_outstanding"],
        loan_outstanding      = data["loan_outstanding"],
        total_liabilities     = data["total_liabilities"],
        net_worth             = data["net_worth"],
        change_amount         = change,
        change_pct            = change_pct,
        extra_data            = {
            "liquid_net_worth":  data["liquid_net_worth"],
            "health_score":      data["health_score"],
            "debt_ratio":        data["debt_ratio"],
            "investment_ratio":  data["investment_ratio"],
            "emergency_months":  data["emergency_months"],
        },
    )
    db.add(snap)
    await db.commit()
    await db.refresh(snap)
    return {"ok": True, "net_worth": data["net_worth"], "health_score": data["health_score"]}


def format_snap(s) -> dict:
    return {
        "date":              s.snapshot_date.isoformat(),
        "net_worth":         float(s.net_worth or 0),
        "total_assets":      float(s.total_assets or 0),
        "total_liabilities": float(s.total_liabilities or 0),
        "bank_balance":      float(s.bank_balance or 0),
        "investment_value":  float(s.investment_value or 0),
        "asset_value":       float(s.asset_value or 0),
        "change_amount":     float(s.change_amount or 0),
        "change_pct":        float(s.change_pct or 0),
        "health_score":      (s.extra_data or {}).get("health_score", 0),
        "liquid_net_worth":  (s.extra_data or {}).get("liquid_net_worth", 0),
    }


@router.get("/history")
async def net_worth_history(
    months: int = 12,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Historical snapshots for trend charts — one snapshot per calendar month."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=months * 31)
    result = await db.execute(
        select(NetWorthSnapshot)
        .where(
            NetWorthSnapshot.user_id == current_user.id,
            NetWorthSnapshot.snapshot_date >= cutoff,
        )
        .order_by(NetWorthSnapshot.snapshot_date.asc())
    )
    snaps = result.scalars().all()
    # Deduplicate: keep last snapshot per calendar month
    monthly_map: dict = {}
    for s in snaps:
        key = s.snapshot_date.strftime("%Y-%m")
        monthly_map[key] = s  # last one wins
    return [format_snap(s) for s in monthly_map.values()]
