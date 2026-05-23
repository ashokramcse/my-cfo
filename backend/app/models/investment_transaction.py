"""
InvestmentTransaction — the per-event portfolio ledger.

Every buy, sell, SIP installment, dividend credit, bonus share,
stock split, and redemption is recorded here. The parent Investment
row stores aggregate state (units, avg_buy_price, current_value) while
this table provides the audit trail from which those aggregates can be
verified and LTCG/STCG taxes computed.
"""

from sqlalchemy import (
    Column, String, Boolean, DateTime, Numeric, Integer,
    ForeignKey, Text, Enum as SAEnum, Date,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class InvTxType(str, enum.Enum):
    BUY       = "BUY"        # Purchase (lump-sum or SIP instalment)
    SELL      = "SELL"       # Redemption / sale
    DIVIDEND  = "DIVIDEND"   # Dividend / interest paid out
    BONUS     = "BONUS"      # Bonus shares / bonus units (cost basis = 0)
    SPLIT     = "SPLIT"      # Stock split (adjusts units + avg_buy_price)
    SWITCH_IN  = "SWITCH_IN"  # MF switch-in
    SWITCH_OUT = "SWITCH_OUT" # MF switch-out
    COUPON    = "COUPON"     # SGB / bond coupon payment
    MATURITY  = "MATURITY"   # Bond / SGB maturity redemption


class TaxCategory(str, enum.Enum):
    LTCG_EQUITY     = "LTCG_EQUITY"     # >12m equity/eq-MF: 12.5% above ₹1.25L
    STCG_EQUITY     = "STCG_EQUITY"     # ≤12m equity/eq-MF: 20%
    LTCG_DEBT       = "LTCG_DEBT"       # >24m debt (pre Apr-23 units): 20% with indexation
    STCG_DEBT       = "STCG_DEBT"       # Any debt post Apr-23: slab rate
    LTCG_GOLD       = "LTCG_GOLD"       # >24m gold/jewelry: 12.5%
    STCG_GOLD       = "STCG_GOLD"       # ≤24m gold: slab rate
    LTCG_REAL_ESTATE = "LTCG_REAL_ESTATE" # >24m RE (post Jul-24): 12.5% no indexation
    SGB_MATURITY    = "SGB_MATURITY"    # SGB held to 8-yr maturity: tax-free
    PPF_EXEMPT      = "PPF_EXEMPT"      # PPF: fully exempt
    EPF_EXEMPT      = "EPF_EXEMPT"      # EPF >5yr: exempt
    DIVIDEND_INCOME = "DIVIDEND_INCOME" # Dividend: slab rate
    NOT_APPLICABLE  = "NOT_APPLICABLE"  # Bonus, split, coupon (tracked separately)


class InvestmentTransaction(Base):
    __tablename__ = "investment_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investment_id = Column(UUID(as_uuid=True), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # ── Core event ────────────────────────────────────────────────────────────
    tx_type     = Column(SAEnum(InvTxType), nullable=False)
    tx_date     = Column(Date, nullable=False)

    # Units and price (both zero for bonus share grants — cost basis is parent lot price)
    units       = Column(Numeric(15, 4), nullable=False, default=0)   # +BUY/BONUS, -SELL
    price_per_unit = Column(Numeric(15, 4), default=0)                # NAV/price at transaction
    amount      = Column(Numeric(15, 2), default=0)                   # = units × price (0 for bonus)

    # ── Settlement ────────────────────────────────────────────────────────────
    # Mutual fund redemptions settle T+3; bank credit is delayed.
    settlement_date       = Column(Date, nullable=True)               # expected settlement
    linked_bank_tx_id     = Column(UUID(as_uuid=True),
                                   ForeignKey("bank_transactions.id", ondelete="SET NULL"),
                                   nullable=True)                     # bank debit/credit after settlement

    # ── Cost basis for tax (FIFO matching on SELL) ────────────────────────────
    # For SELL rows: cost_basis is the FIFO-weighted avg cost of units sold
    cost_basis            = Column(Numeric(15, 2), nullable=True)     # total cost of sold units
    holding_days          = Column(Integer, nullable=True)            # calendar days held

    # ── Tax computation ───────────────────────────────────────────────────────
    tax_category          = Column(SAEnum(TaxCategory), nullable=True)
    realized_gain         = Column(Numeric(15, 2), nullable=True)     # amount - cost_basis
    is_ltcg               = Column(Boolean, nullable=True)
    tax_rate              = Column(Numeric(5, 2), nullable=True)      # % (12.5, 20, slab…)
    estimated_tax         = Column(Numeric(12, 2), nullable=True)     # realized_gain × tax_rate
    grandfathering_price  = Column(Numeric(15, 4), nullable=True)     # Jan-31-2018 NAV for pre-2018 equity

    # ── Split/Bonus metadata ──────────────────────────────────────────────────
    # For SPLIT: split_ratio = "2:1" means 1 share → 2 shares
    split_ratio           = Column(String(20), nullable=True)         # e.g. "2:1", "1:2"
    pre_split_units       = Column(Numeric(15, 4), nullable=True)
    post_split_units      = Column(Numeric(15, 4), nullable=True)

    # ── SIP metadata ──────────────────────────────────────────────────────────
    is_sip_installment    = Column(Boolean, default=False)
    sip_installment_no    = Column(Integer, nullable=True)

    # ── Source ────────────────────────────────────────────────────────────────
    nav_source = Column(String(50), default="MANUAL")  # MANUAL | AMFI | NSE | ZERODHA
    notes      = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    investment   = relationship("Investment", back_populates="transactions")
    user         = relationship("User")
    bank_tx      = relationship("BankTransaction", foreign_keys=[linked_bank_tx_id])
