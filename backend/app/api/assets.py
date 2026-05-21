from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import date
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.asset import Asset
from app.schemas.asset import AssetCreate, AssetUpdate, AssetOut

router = APIRouter()

ASSET_TYPE_LABELS = {
    "REAL_ESTATE": "Real Estate",
    "VEHICLE":     "Vehicles",
    "JEWELRY":     "Jewellery",
    "ELECTRONICS": "Electronics",
    "FURNITURE":   "Furniture",
    "ARTWORK":     "Art & Collectibles",
    "OTHER":       "Other Assets",
}
ASSET_TYPE_COLORS = {
    "REAL_ESTATE": "#3B82F6",
    "VEHICLE":     "#F59E0B",
    "JEWELRY":     "#D97706",
    "ELECTRONICS": "#8B5CF6",
    "FURNITURE":   "#10B981",
    "ARTWORK":     "#EC4899",
    "OTHER":       "#6B7280",
}
# Liquidity tiers
LIQUIDITY_MAP = {
    "REAL_ESTATE": "Illiquid",
    "VEHICLE":     "Semi-liquid",
    "JEWELRY":     "Semi-liquid",
    "ELECTRONICS": "Illiquid",
    "FURNITURE":   "Illiquid",
    "ARTWORK":     "Illiquid",
    "OTHER":       "Other",
}
LIQUIDITY_COLORS = {
    "Illiquid": "#EF4444", "Semi-liquid": "#F59E0B", "Other": "#6B7280",
}


def _annualised_appreciation(asset) -> float:
    """Return CAGR % since purchase. Returns 0 if data insufficient."""
    if not asset.purchase_date or not asset.purchase_price:
        return 0.0
    pp = float(asset.purchase_price)
    cv = float(asset.current_value or 0)
    if pp <= 0 or cv <= 0:
        return 0.0
    years = (date.today() - asset.purchase_date).days / 365.25
    if years < 0.1:
        return 0.0
    return round(((cv / pp) ** (1 / years) - 1) * 100, 2)


def _asset_insights(assets: list, total_value: float, uninsured_value: float,
                    by_liquidity: dict) -> list:
    insights = []

    # Uninsured high-value assets
    if uninsured_value > 500_000:
        insights.append({
            "severity": "WARNING",
            "title": f"₹{uninsured_value:,.0f} in Uninsured Assets",
            "body": "Several high-value assets have no insurance coverage. "
                    "A loss event could permanently damage your net worth.",
            "action": "assets",
        })

    # Expiring insurance
    today = date.today()
    expiring_soon = [
        a for a in assets
        if a.is_insured and a.insurance_expiry
        and 0 <= (a.insurance_expiry - today).days <= 60
    ]
    if expiring_soon:
        names = ", ".join(a.name for a in expiring_soon[:2])
        insights.append({
            "severity": "WARNING",
            "title": f"Insurance Expiring Soon",
            "body": f"{names} {'and others' if len(expiring_soon) > 2 else ''} "
                    f"ha{'ve' if len(expiring_soon) > 1 else 's'} insurance expiring within 60 days. Renew immediately.",
            "action": "assets",
        })

    # Illiquid concentration
    illiquid_val = by_liquidity.get("Illiquid", 0.0)
    if total_value > 0:
        ill_pct = illiquid_val / total_value * 100
        if ill_pct > 70:
            insights.append({
                "severity": "WARNING",
                "title": f"{ill_pct:.0f}% of Assets Are Illiquid",
                "body": "Most of your physical wealth is tied up in illiquid assets. "
                        "Ensure liquid savings can cover emergencies without forced asset sales.",
                "action": "assets",
            })

    # Mortgaged assets
    mortgaged = [a for a in assets if a.is_mortgaged]
    if mortgaged:
        mort_val = sum(float(a.mortgage_outstanding or 0) for a in mortgaged)
        insights.append({
            "severity": "INFO",
            "title": f"₹{mort_val:,.0f} Mortgage on Assets",
            "body": f"{len(mortgaged)} asset(s) have outstanding mortgage balances. "
                    "Track these against your loans module for full liability picture.",
            "action": "loans",
        })

    # Depreciation alert (electronics/vehicles)
    depreciating = [
        a for a in assets
        if str(a.asset_type) in ("VEHICLE", "ELECTRONICS")
        and float(a.depreciation_rate or 0) > 0
    ]
    if depreciating:
        annual_dep = sum(
            float(a.current_value or 0) * float(a.depreciation_rate or 0) / 100
            for a in depreciating
        )
        insights.append({
            "severity": "INFO",
            "title": f"~₹{annual_dep:,.0f}/yr in Depreciation",
            "body": f"{len(depreciating)} asset(s) (vehicles, electronics) are depreciating. "
                    "Factor this into your net worth projections.",
            "action": "assets",
        })

    return insights[:6]


# ─── CRUD ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[AssetOut])
async def list_assets(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset)
        .where(Asset.user_id == current_user.id)
        .order_by(Asset.current_value.desc())
    )
    return result.scalars().all()


@router.post("", response_model=AssetOut)
async def create_asset(
    data: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = Asset(user_id=current_user.id, **data.model_dump())
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: uuid.UUID,
    data: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == current_user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset).where(Asset.id == asset_id, Asset.user_id == current_user.id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    return {"ok": True}


# ─── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/intelligence")
async def asset_intelligence(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Asset).where(Asset.user_id == current_user.id)
    )
    assets = result.scalars().all()

    # ── Totals ────────────────────────────────────────────────────────────────
    total_value    = sum(float(a.current_value or 0) for a in assets)
    mortgaged_val  = sum(float(a.mortgage_outstanding or 0) for a in assets if a.is_mortgaged)
    free_value     = total_value - mortgaged_val
    purchase_total = sum(float(a.purchase_price or 0) for a in assets if a.purchase_price)
    appreciation   = total_value - purchase_total   # raw gain across all assets with purchase_price

    # Insurance
    insured_val   = sum(float(a.current_value or 0) for a in assets if a.is_insured)
    uninsured_val = sum(float(a.current_value or 0) for a in assets if not a.is_insured)

    # ── By type ───────────────────────────────────────────────────────────────
    by_type_map: dict = {}
    for asset in assets:
        t = str(asset.asset_type)
        if t not in by_type_map:
            by_type_map[t] = {
                "type": t, "label": ASSET_TYPE_LABELS.get(t, t),
                "color": ASSET_TYPE_COLORS.get(t, "#6B7280"),
                "value": 0.0, "count": 0,
            }
        by_type_map[t]["value"] += float(asset.current_value or 0)
        by_type_map[t]["count"] += 1

    for entry in by_type_map.values():
        entry["pct"] = round(entry["value"] / total_value * 100, 1) if total_value > 0 else 0

    by_type = sorted(by_type_map.values(), key=lambda x: -x["value"])

    # ── By liquidity ─────────────────────────────────────────────────────────
    by_liquidity: dict[str, float] = {}
    for asset in assets:
        liq = LIQUIDITY_MAP.get(str(asset.asset_type), "Other")
        by_liquidity[liq] = by_liquidity.get(liq, 0.0) + float(asset.current_value or 0)

    liquidity_breakdown = [
        {
            "tier":  tier,
            "value": round(val, 2),
            "pct":   round(val / total_value * 100, 1) if total_value > 0 else 0,
            "color": LIQUIDITY_COLORS.get(tier, "#6B7280"),
        }
        for tier, val in sorted(by_liquidity.items(), key=lambda x: -x[1])
    ]

    # ── Per-asset cards ───────────────────────────────────────────────────────
    asset_cards = []
    for asset in sorted(assets, key=lambda a: float(a.current_value or 0), reverse=True):
        pp     = float(asset.purchase_price or 0)
        cv     = float(asset.current_value or 0)
        gain   = cv - pp if pp > 0 else 0
        gain_pct = round(gain / pp * 100, 1) if pp > 0 else 0
        cagr   = _annualised_appreciation(asset)

        today  = date.today()
        ins_expiry_days = None
        if asset.is_insured and asset.insurance_expiry:
            ins_expiry_days = (asset.insurance_expiry - today).days

        asset_cards.append({
            "id":              str(asset.id),
            "name":            asset.name,
            "type":            str(asset.asset_type),
            "label":           ASSET_TYPE_LABELS.get(str(asset.asset_type), ""),
            "color":           ASSET_TYPE_COLORS.get(str(asset.asset_type), "#6B7280"),
            "liquidity":       LIQUIDITY_MAP.get(str(asset.asset_type), "Other"),
            "purchase_price":  pp,
            "current_value":   cv,
            "gain":            round(gain, 2),
            "gain_pct":        gain_pct,
            "cagr":            cagr,
            "is_insured":      asset.is_insured,
            "insurance_expiry": str(asset.insurance_expiry) if asset.insurance_expiry else None,
            "ins_expiry_days": ins_expiry_days,
            "insurance_value": float(asset.insurance_value or 0),
            "is_mortgaged":    asset.is_mortgaged,
            "mortgage_outstanding": float(asset.mortgage_outstanding or 0),
            "depreciation_rate": float(asset.depreciation_rate or 0),
            "location":        asset.location,
            "area_sqft":       float(asset.area_sqft or 0),
            "registration_number": asset.registration_number,
            "make_model":      asset.make_model,
            "year_of_manufacture": asset.year_of_manufacture,
            "purchase_date":   str(asset.purchase_date) if asset.purchase_date else None,
            "notes":           asset.notes,
        })

    # ── Insights ──────────────────────────────────────────────────────────────
    insights = _asset_insights(assets, total_value, uninsured_val, by_liquidity)

    return {
        "total_value":      round(total_value, 2),
        "free_value":       round(free_value, 2),
        "mortgaged_value":  round(mortgaged_val, 2),
        "insured_value":    round(insured_val, 2),
        "uninsured_value":  round(uninsured_val, 2),
        "purchase_total":   round(purchase_total, 2),
        "appreciation":     round(appreciation, 2),
        "asset_count":      len(assets),
        "by_type":          by_type,
        "liquidity_breakdown": liquidity_breakdown,
        "asset_cards":      asset_cards,
        "insights":         insights,
    }
