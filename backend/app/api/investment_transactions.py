"""
Investment Transaction API — portfolio ledger with LTCG/STCG tax computation.

Endpoints:
  POST   /investments/{id}/transactions          — record BUY/SELL/BONUS/SPLIT/etc.
  GET    /investments/{id}/transactions          — list all transactions for an investment
  GET    /investments/transactions/summary       — tax summary across all investments
  DELETE /investments/transactions/{tx_id}      — delete a transaction (recalculates aggregates)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func as sqlfunc
from typing import Optional
from decimal import Decimal
from datetime import date, timedelta
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.investment import Investment
from app.models.investment_transaction import InvestmentTransaction, InvTxType, TaxCategory
from app.models.bank_transaction import BankTransaction

router = APIRouter()


# ─── Tax computation ──────────────────────────────────────────────────────────

# Indian LTCG holding period thresholds (in days)
LTCG_THRESHOLD = {
    "STOCKS":      365,   # 12 months
    "ETF":         365,
    "REITS":       365,
    "MUTUAL_FUND": 365,   # equity MF: 12m; debt MF: any holding → slab rate post Apr-23
    "SGB":         730,   # 24 months (tax-free at 8-yr maturity)
    "GOLD":        730,   # 24 months
    "SILVER":      730,
    "BONDS":       365,
    "PPF":         0,     # always exempt
    "EPF":         1825,  # 5 years
    "NPS":         0,     # complex — simplified to exempt on exit
    "CRYPTO":      0,     # flat 30% regardless
    "OTHER":       730,
}

# Tax rates (%)
LTCG_RATES = {
    "STOCKS":      12.5,
    "ETF":         12.5,
    "REITS":       12.5,
    "MUTUAL_FUND": 12.5,   # equity-oriented MF
    "GOLD":        12.5,
    "SILVER":      12.5,
    "SGB":         0.0,    # maturity: tax-free; pre-maturity: 12.5%
    "BONDS":       12.5,
    "PPF":         0.0,
    "EPF":         0.0,
    "NPS":         0.0,    # simplified
    "CRYPTO":      30.0,   # flat VDA tax
    "OTHER":       12.5,
}

STCG_RATES = {
    "STOCKS":      20.0,
    "ETF":         20.0,
    "REITS":       20.0,
    "MUTUAL_FUND": 20.0,   # equity-oriented; debt MF: slab rate (we mark as 30% placeholder)
    "GOLD":        30.0,   # slab rate — we use 30% as worst-case
    "SILVER":      30.0,
    "SGB":         30.0,
    "BONDS":       30.0,
    "PPF":         0.0,
    "EPF":         30.0,
    "NPS":         30.0,
    "CRYPTO":      30.0,
    "OTHER":       30.0,
}

# LTCG exemption limit (equity): ₹1,25,000 per year
LTCG_EQUITY_EXEMPTION = 125_000


def compute_tax(
    investment_type: str,
    holding_days: int,
    realized_gain: float,
    purchase_date: Optional[date] = None,
    maturity_date: Optional[date] = None,
    tx_date: Optional[date] = None,
) -> dict:
    """
    Returns tax metadata for a SELL/REDEMPTION transaction.
    All amounts in INR.
    """
    inv_type = investment_type.upper()

    # PPF — always exempt
    if inv_type == "PPF":
        return {
            "tax_category": TaxCategory.PPF_EXEMPT,
            "is_ltcg": True, "tax_rate": 0.0, "estimated_tax": 0.0,
        }

    # EPF — exempt if >5 years
    if inv_type == "EPF":
        if holding_days >= 1825:
            return {
                "tax_category": TaxCategory.EPF_EXEMPT,
                "is_ltcg": True, "tax_rate": 0.0, "estimated_tax": 0.0,
            }
        else:
            return {
                "tax_category": TaxCategory.STCG_EQUITY,
                "is_ltcg": False, "tax_rate": 30.0,
                "estimated_tax": max(0.0, realized_gain) * 0.30,
            }

    # SGB — tax-free at 8-year maturity
    if inv_type == "SGB":
        if maturity_date and tx_date and tx_date >= maturity_date:
            return {
                "tax_category": TaxCategory.SGB_MATURITY,
                "is_ltcg": True, "tax_rate": 0.0, "estimated_tax": 0.0,
            }
        threshold = LTCG_THRESHOLD.get(inv_type, 730)
        is_ltcg = holding_days >= threshold
        rate = LTCG_RATES[inv_type] if is_ltcg else STCG_RATES[inv_type]
        cat = TaxCategory.LTCG_GOLD if is_ltcg else TaxCategory.STCG_GOLD
        return {
            "tax_category": cat,
            "is_ltcg": is_ltcg,
            "tax_rate": rate,
            "estimated_tax": max(0.0, realized_gain) * rate / 100,
        }

    # Crypto — flat 30% VDA tax, no exemption, no set-off
    if inv_type == "CRYPTO":
        return {
            "tax_category": TaxCategory.STCG_EQUITY,
            "is_ltcg": False, "tax_rate": 30.0,
            "estimated_tax": max(0.0, realized_gain) * 0.30,
        }

    # Gold / Silver / Other hard assets
    if inv_type in ("GOLD", "SILVER"):
        threshold = 730  # 24 months
        is_ltcg = holding_days >= threshold
        rate = LTCG_RATES.get(inv_type, 12.5) if is_ltcg else STCG_RATES.get(inv_type, 30.0)
        cat = TaxCategory.LTCG_GOLD if is_ltcg else TaxCategory.STCG_GOLD
        return {
            "tax_category": cat,
            "is_ltcg": is_ltcg,
            "tax_rate": rate,
            "estimated_tax": max(0.0, realized_gain) * rate / 100,
        }

    # Equity / Mutual Funds / ETFs / REITs
    if inv_type in ("STOCKS", "ETF", "REITS", "MUTUAL_FUND", "BONDS", "NPS"):
        threshold = LTCG_THRESHOLD.get(inv_type, 365)
        is_ltcg = holding_days >= threshold
        rate = LTCG_RATES.get(inv_type, 12.5) if is_ltcg else STCG_RATES.get(inv_type, 20.0)
        cat = TaxCategory.LTCG_EQUITY if is_ltcg else TaxCategory.STCG_EQUITY
        taxable = max(0.0, realized_gain)
        # LTCG equity: exempt up to ₹1.25L — we compute gross tax (caller applies exemption)
        return {
            "tax_category": cat,
            "is_ltcg": is_ltcg,
            "tax_rate": rate,
            "estimated_tax": taxable * rate / 100,
            "ltcg_exemption_applicable": is_ltcg and inv_type in ("STOCKS", "ETF", "REITS", "MUTUAL_FUND"),
        }

    # Default
    threshold = LTCG_THRESHOLD.get(inv_type, 730)
    is_ltcg = holding_days >= threshold
    rate = LTCG_RATES.get(inv_type, 12.5) if is_ltcg else STCG_RATES.get(inv_type, 30.0)
    return {
        "tax_category": TaxCategory.LTCG_EQUITY if is_ltcg else TaxCategory.STCG_EQUITY,
        "is_ltcg": is_ltcg,
        "tax_rate": rate,
        "estimated_tax": max(0.0, realized_gain) * rate / 100,
    }


async def _recalculate_investment_aggregates(inv: Investment, db: AsyncSession):
    """
    Re-derive Investment.units, invested_amount, unrealized_pnl, realized_pnl
    from the transaction ledger. Call after any insert/delete.
    """
    result = await db.execute(
        select(InvestmentTransaction)
        .where(InvestmentTransaction.investment_id == inv.id)
        .order_by(InvestmentTransaction.tx_date)
    )
    txns = result.scalars().all()

    total_units = Decimal("0")
    total_cost  = Decimal("0")   # running FIFO cost pool
    realized    = Decimal("0")

    for t in txns:
        if t.tx_type in (InvTxType.BUY, InvTxType.SWITCH_IN):
            total_units += t.units
            total_cost  += t.amount or Decimal("0")
        elif t.tx_type == InvTxType.BONUS:
            # Bonus units — no cost (cost pool unchanged)
            total_units += t.units
        elif t.tx_type == InvTxType.SPLIT:
            # Adjust units but total cost stays same (avg buy price changes)
            if t.pre_split_units and t.post_split_units and t.pre_split_units > 0:
                ratio = Decimal(str(t.post_split_units)) / Decimal(str(t.pre_split_units))
                total_units = total_units * ratio
                # avg_buy_price adjusts automatically (total_cost / total_units)
        elif t.tx_type in (InvTxType.SELL, InvTxType.SWITCH_OUT, InvTxType.MATURITY):
            units_sold = abs(t.units)
            if total_units > 0:
                avg_cost = total_cost / total_units
                cost_of_sold = avg_cost * units_sold
                total_cost  -= cost_of_sold
                total_units -= units_sold
                realized    += (t.realized_gain or Decimal("0"))

    inv.units            = total_units
    inv.invested_amount  = total_cost
    inv.avg_buy_price    = (total_cost / total_units) if total_units > 0 else Decimal("0")
    inv.unrealized_pnl   = (inv.current_value or Decimal("0")) - total_cost
    inv.realized_pnl     = realized

    db.add(inv)


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/{investment_id}/transactions", status_code=201)
async def add_investment_transaction(
    investment_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record a BUY, SELL, BONUS, SPLIT, DIVIDEND, COUPON, etc."""
    inv_result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.user_id == current_user.id,
        )
    )
    inv = inv_result.scalar_one_or_none()
    if not inv:
        raise HTTPException(404, "Investment not found")

    tx_type_raw = payload.get("tx_type", "").upper()
    try:
        tx_type = InvTxType(tx_type_raw)
    except ValueError:
        raise HTTPException(422, f"Invalid tx_type '{tx_type_raw}'. Valid: {[e.value for e in InvTxType]}")

    tx_date_raw = payload.get("tx_date")
    tx_date = date.fromisoformat(tx_date_raw) if tx_date_raw else date.today()

    units          = Decimal(str(payload.get("units", 0)))
    price_per_unit = Decimal(str(payload.get("price_per_unit", 0)))
    amount         = Decimal(str(payload.get("amount", 0))) or (units * price_per_unit)

    # ── Tax computation for SELL / MATURITY ──────────────────────────────────
    tax_meta: dict = {}
    if tx_type in (InvTxType.SELL, InvTxType.MATURITY, InvTxType.SWITCH_OUT):
        # ── True FIFO cost basis ─────────────────────────────────────────────
        # Fetch all prior BUY lots in chronological order
        buy_result = await db.execute(
            select(InvestmentTransaction)
            .where(
                InvestmentTransaction.investment_id == investment_id,
                InvestmentTransaction.tx_type.in_([InvTxType.BUY, InvTxType.SWITCH_IN]),
            )
            .order_by(InvestmentTransaction.tx_date, InvestmentTransaction.id)
        )
        buys = buy_result.scalars().all()

        # Fetch all prior SELL events (already committed) to know how many units
        # have already been consumed from each lot.
        prior_sell_result = await db.execute(
            select(InvestmentTransaction)
            .where(
                InvestmentTransaction.investment_id == investment_id,
                InvestmentTransaction.tx_type.in_([
                    InvTxType.SELL, InvTxType.MATURITY, InvTxType.SWITCH_OUT
                ]),
            )
            .order_by(InvestmentTransaction.tx_date, InvestmentTransaction.id)
        )
        prior_sells = prior_sell_result.scalars().all()

        # Compute how many units prior sells have already consumed (FIFO order)
        prior_units_sold = sum(abs(float(s.units or 0)) for s in prior_sells)

        # Skip BUY lots that are fully consumed by prior sells
        remaining_skip = Decimal(str(prior_units_sold))
        lot_queue: list[tuple[Decimal, Decimal, object]] = []  # (available_units, price, tx_date)
        for buy in buys:
            buy_units = abs(buy.units or Decimal("0"))
            if remaining_skip >= buy_units:
                remaining_skip -= buy_units  # lot fully consumed by earlier sell
            elif remaining_skip > 0:
                available = buy_units - remaining_skip  # partial consumption
                lot_queue.append((available, buy.price_per_unit, buy.tx_date))
                remaining_skip = Decimal("0")
            else:
                lot_queue.append((buy_units, buy.price_per_unit, buy.tx_date))

        # Now consume from lot_queue for the current SELL
        cost_basis = Decimal("0")
        earliest_buy = None
        units_to_match = units
        for lot_units, lot_price, lot_date in lot_queue:
            if units_to_match <= 0:
                break
            matched = min(lot_units, units_to_match)
            cost_basis += matched * lot_price
            if earliest_buy is None:
                earliest_buy = lot_date
            units_to_match -= matched

        holding_days = (tx_date - earliest_buy).days if earliest_buy else 0
        realized_gain = float(amount) - float(cost_basis)

        tax_meta = compute_tax(
            investment_type=inv.investment_type,
            holding_days=holding_days,
            realized_gain=realized_gain,
            purchase_date=earliest_buy,
            maturity_date=inv.maturity_date,
            tx_date=tx_date,
        )
        tax_meta["cost_basis"] = cost_basis
        tax_meta["holding_days"] = holding_days
        tax_meta["realized_gain"] = Decimal(str(realized_gain))

    # ── Create transaction row ─────────────────────────────────────────────────
    settlement_raw = payload.get("settlement_date")
    tx = InvestmentTransaction(
        investment_id       = investment_id,
        user_id             = current_user.id,
        tx_type             = tx_type,
        tx_date             = tx_date,
        units               = units if tx_type in (InvTxType.BUY, InvTxType.BONUS, InvTxType.SWITCH_IN) else -units,
        price_per_unit      = price_per_unit,
        amount              = amount,
        settlement_date     = date.fromisoformat(settlement_raw) if settlement_raw else None,
        cost_basis          = tax_meta.get("cost_basis"),
        holding_days        = tax_meta.get("holding_days"),
        tax_category        = tax_meta.get("tax_category"),
        realized_gain       = tax_meta.get("realized_gain"),
        is_ltcg             = tax_meta.get("is_ltcg"),
        tax_rate            = Decimal(str(tax_meta["tax_rate"])) if "tax_rate" in tax_meta else None,
        estimated_tax       = Decimal(str(tax_meta["estimated_tax"])) if "estimated_tax" in tax_meta else None,
        split_ratio         = payload.get("split_ratio"),
        pre_split_units     = Decimal(str(payload["pre_split_units"])) if "pre_split_units" in payload else None,
        post_split_units    = Decimal(str(payload["post_split_units"])) if "post_split_units" in payload else None,
        is_sip_installment  = payload.get("is_sip_installment", False),
        sip_installment_no  = payload.get("sip_installment_no"),
        nav_source          = payload.get("nav_source", "MANUAL"),
        notes               = payload.get("notes"),
    )
    db.add(tx)
    await db.flush()   # get tx.id before recalculating

    # Re-derive aggregates from ledger
    await _recalculate_investment_aggregates(inv, db)
    await db.commit()
    await db.refresh(tx)

    return {
        "id":             str(tx.id),
        "investment_id":  str(tx.investment_id),
        "tx_type":        tx.tx_type,
        "tx_date":        str(tx.tx_date),
        "units":          float(tx.units),
        "price_per_unit": float(tx.price_per_unit),
        "amount":         float(tx.amount),
        "realized_gain":  float(tx.realized_gain or 0),
        "is_ltcg":        tx.is_ltcg,
        "tax_category":   tx.tax_category,
        "tax_rate":       float(tx.tax_rate or 0),
        "estimated_tax":  float(tx.estimated_tax or 0),
        "holding_days":   tx.holding_days,
        "nav_source":     tx.nav_source,
        "notes":          tx.notes,
        "created_at":     tx.created_at.isoformat() if tx.created_at else None,
    }


@router.get("/{investment_id}/transactions")
async def list_investment_transactions(
    investment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all transactions for an investment."""
    # Verify ownership
    inv_result = await db.execute(
        select(Investment).where(
            Investment.id == investment_id,
            Investment.user_id == current_user.id,
        )
    )
    if not inv_result.scalar_one_or_none():
        raise HTTPException(404, "Investment not found")

    result = await db.execute(
        select(InvestmentTransaction)
        .where(InvestmentTransaction.investment_id == investment_id)
        .order_by(InvestmentTransaction.tx_date.desc())
    )
    txns = result.scalars().all()

    return [
        {
            "id":             str(t.id),
            "tx_type":        t.tx_type,
            "tx_date":        str(t.tx_date),
            "units":          float(t.units),
            "price_per_unit": float(t.price_per_unit or 0),
            "amount":         float(t.amount or 0),
            "settlement_date":str(t.settlement_date) if t.settlement_date else None,
            "realized_gain":  float(t.realized_gain or 0),
            "is_ltcg":        t.is_ltcg,
            "tax_category":   t.tax_category,
            "tax_rate":       float(t.tax_rate or 0),
            "estimated_tax":  float(t.estimated_tax or 0),
            "holding_days":   t.holding_days,
            "split_ratio":    t.split_ratio,
            "is_sip_installment": t.is_sip_installment,
            "sip_installment_no": t.sip_installment_no,
            "nav_source":     t.nav_source,
            "notes":          t.notes,
            "created_at":     t.created_at.isoformat() if t.created_at else None,
        }
        for t in txns
    ]


@router.get("/transactions/tax-summary")
async def tax_summary(
    financial_year: Optional[str] = None,   # e.g. "2025-26" → Apr 1 2025 – Mar 31 2026
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    LTCG/STCG tax summary across all investments.
    Optionally filtered to a financial year (Apr–Mar).
    """
    # Determine date range
    if financial_year:
        try:
            start_yr = int(financial_year.split("-")[0])
        except Exception:
            raise HTTPException(422, "financial_year must be like '2025-26'")
        fy_start = date(start_yr, 4, 1)
        fy_end   = date(start_yr + 1, 3, 31)
    else:
        today = date.today()
        fy_start = date(today.year if today.month >= 4 else today.year - 1, 4, 1)
        fy_end   = date(fy_start.year + 1, 3, 31)

    result = await db.execute(
        select(InvestmentTransaction)
        .where(
            InvestmentTransaction.user_id == current_user.id,
            InvestmentTransaction.tx_type.in_([InvTxType.SELL, InvTxType.MATURITY, InvTxType.SWITCH_OUT]),
            InvestmentTransaction.tx_date >= fy_start,
            InvestmentTransaction.tx_date <= fy_end,
        )
        .order_by(InvestmentTransaction.tx_date)
    )
    sells = result.scalars().all()

    ltcg_equity    = 0.0
    stcg_equity    = 0.0
    ltcg_other     = 0.0
    stcg_other     = 0.0
    tax_free_gains = 0.0
    total_estimated_tax = 0.0
    transactions_out = []

    for t in sells:
        gain = float(t.realized_gain or 0)
        tax  = float(t.estimated_tax or 0)
        cat  = str(t.tax_category or "")

        if "LTCG_EQUITY" in cat:
            ltcg_equity += gain
        elif "STCG_EQUITY" in cat:
            stcg_equity += gain
        elif "LTCG" in cat:
            ltcg_other  += gain
        elif "STCG" in cat:
            stcg_other  += gain
        elif "EXEMPT" in cat or "SGB_MATURITY" in cat or "PPF" in cat:
            tax_free_gains += gain

        total_estimated_tax += tax
        transactions_out.append({
            "id":            str(t.id),
            "investment_id": str(t.investment_id),
            "tx_date":       str(t.tx_date),
            "tx_type":       t.tx_type,
            "realized_gain": gain,
            "is_ltcg":       t.is_ltcg,
            "tax_category":  cat,
            "tax_rate":      float(t.tax_rate or 0),
            "estimated_tax": tax,
            "holding_days":  t.holding_days,
        })

    # Apply LTCG equity exemption (₹1.25L per year)
    ltcg_equity_taxable = max(0.0, ltcg_equity - LTCG_EQUITY_EXEMPTION)
    ltcg_equity_tax_after_exemption = ltcg_equity_taxable * 0.125

    return {
        "financial_year":  financial_year or f"{fy_start.year}-{str(fy_start.year + 1)[2:]}",
        "fy_start":        str(fy_start),
        "fy_end":          str(fy_end),
        "summary": {
            "ltcg_equity":                  round(ltcg_equity, 2),
            "ltcg_equity_exemption":        LTCG_EQUITY_EXEMPTION,
            "ltcg_equity_taxable":          round(ltcg_equity_taxable, 2),
            "ltcg_equity_tax":              round(ltcg_equity_tax_after_exemption, 2),
            "stcg_equity":                  round(stcg_equity, 2),
            "stcg_equity_tax":              round(stcg_equity * 0.20, 2),
            "ltcg_other":                   round(ltcg_other, 2),
            "stcg_other":                   round(stcg_other, 2),
            "tax_free_gains":               round(tax_free_gains, 2),
            "total_estimated_tax":          round(total_estimated_tax, 2),
            "disclaimer":                   "Estimated tax. Does not account for set-off of losses, surcharge, or cess. Consult a CA before filing.",
        },
        "transactions": transactions_out,
    }


@router.delete("/transactions/{tx_id}", status_code=204)
async def delete_investment_transaction(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a transaction and recalculate investment aggregates."""
    result = await db.execute(
        select(InvestmentTransaction).where(
            InvestmentTransaction.id == tx_id,
            InvestmentTransaction.user_id == current_user.id,
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "Transaction not found")

    inv_result = await db.execute(
        select(Investment).where(Investment.id == tx.investment_id)
    )
    inv = inv_result.scalar_one_or_none()

    await db.delete(tx)
    await db.flush()

    if inv:
        await _recalculate_investment_aggregates(inv, db)

    await db.commit()
