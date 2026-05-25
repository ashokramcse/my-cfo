"""
BankTransaction — credits and debits for bank/wallet accounts.

Separate from CreditCard Transactions. Sources:
  - Manual entry
  - CSV/Excel import
  - PDF statement parsing (future)
  - Screenshot OCR (future)
"""

from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum, Index
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class BankTxType(str, enum.Enum):
    CREDIT       = "CREDIT"       # salary, transfer-in, interest, refund
    DEBIT        = "DEBIT"        # expense, transfer-out, fee, EMI
    TRANSFER     = "TRANSFER"     # internal between own accounts (legacy)
    TRANSFER_IN  = "TRANSFER_IN"  # explicit inbound transfer from another own account
    TRANSFER_OUT = "TRANSFER_OUT" # explicit outbound transfer to another own account


class BankTxCategory(str, enum.Enum):
    SALARY          = "SALARY"
    BUSINESS_INCOME = "BUSINESS_INCOME"
    INTEREST        = "INTEREST"
    REFUND          = "REFUND"
    TRANSFER_IN     = "TRANSFER_IN"
    TRANSFER_OUT    = "TRANSFER_OUT"
    FOOD            = "FOOD"
    SHOPPING        = "SHOPPING"
    UTILITIES       = "UTILITIES"
    RENT            = "RENT"
    TRAVEL          = "TRAVEL"
    EMI_PAYMENT     = "EMI_PAYMENT"
    INSURANCE       = "INSURANCE"
    INVESTMENT      = "INVESTMENT"
    BANK_FEE        = "BANK_FEE"
    WALLET_FEE      = "WALLET_FEE"      # Paytm/PhonePe load/withdrawal charges
    ATM_WITHDRAWAL  = "ATM_WITHDRAWAL"
    UPI             = "UPI"
    WALLET_LOAD     = "WALLET_LOAD"     # Bank → Wallet top-up (this leg excluded from expense)
    CC_WALLET_LOAD  = "CC_WALLET_LOAD"  # CC → Wallet top-up (wallet CREDIT leg, excluded)
    WALLET_TRANSFER = "WALLET_TRANSFER" # Wallet → Wallet (e.g. Paytm → GPay)
    ENTERTAINMENT   = "ENTERTAINMENT"
    HEALTHCARE      = "HEALTHCARE"
    EDUCATION       = "EDUCATION"
    OTHER           = "OTHER"


# Categories that represent income
INCOME_CATEGORIES = {
    BankTxCategory.SALARY, BankTxCategory.BUSINESS_INCOME,
    BankTxCategory.INTEREST, BankTxCategory.REFUND, BankTxCategory.TRANSFER_IN,
}

# Categories that are likely hidden/recurring fees
FEE_CATEGORIES = {BankTxCategory.BANK_FEE}


class BankTransaction(Base):
    __tablename__ = "bank_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core fields
    transaction_date  = Column(DateTime(timezone=True), nullable=False)
    value_date        = Column(DateTime(timezone=True))          # actual settlement date
    description       = Column(Text, nullable=False)
    amount            = Column(Numeric(15, 2), nullable=False)   # always positive
    tx_type           = Column(SAEnum(BankTxType), nullable=False)
    category          = Column(SAEnum(BankTxCategory), default=BankTxCategory.OTHER)

    # Enrichment
    merchant_name     = Column(String(200))
    reference_no      = Column(String(100))                      # UTR / cheque / UPI ref
    balance_after     = Column(Numeric(15, 2))                   # running balance after tx

    # Settlement status lifecycle
    # PENDING → SETTLED → RECONCILED
    # Use PENDING for MF redemptions awaiting T+3, cheques in transit, etc.
    status            = Column(String(20), default="SETTLED")        # PENDING|SETTLED|RECONCILED

    # TDS tracking (for FD interest, dividends, etc.)
    gross_amount      = Column(Numeric(15, 2), nullable=True)        # before TDS deduction
    tds_amount        = Column(Numeric(15, 2), default=0)            # tax deducted at source
    tds_section       = Column(String(20), nullable=True)            # 194A, 194N, 194DA…

    # Cross-entity linking (wealth transfer integrity)
    linked_account_id         = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"))
    linked_tx_id              = Column(UUID(as_uuid=True), ForeignKey("bank_transactions.id", ondelete="SET NULL"), nullable=True)
    # ↑ Points to the PEER transaction in a transfer pair (e.g. bank DEBIT ↔ wallet CREDIT for a top-up)
    linked_investment_tx_id   = Column(UUID(as_uuid=True), nullable=True)   # → investment_transactions.id
    linked_loan_id            = Column(UUID(as_uuid=True), ForeignKey("loans.id", ondelete="SET NULL"), nullable=True)
    linked_card_id            = Column(UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="SET NULL"), nullable=True)

    # Quality flags
    is_duplicate      = Column(Boolean, default=False)
    is_hidden_charge  = Column(Boolean, default=False)           # bank fees, SMS charges
    is_recurring      = Column(Boolean, default=False)
    is_excluded       = Column(Boolean, default=False)
    is_transfer_leg   = Column(Boolean, default=False)
    # ↑ True for BOTH legs of an internal transfer (wallet load, own-account transfer).
    # These are excluded from inflow/outflow totals to avoid double-counting.

    # Import metadata
    import_source     = Column(String(20), default="MANUAL")     # MANUAL / CSV / PDF / OCR
    raw_data          = Column(JSONB, default=dict)

    notes             = Column(Text)
    tags              = Column(JSONB, default=list)

    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    user              = relationship("User", back_populates="bank_transactions")
    account           = relationship("BankAccount", back_populates="transactions",
                                     foreign_keys=[account_id])

    __table_args__ = (
        Index("ix_bank_tx_account_date", "account_id", "transaction_date"),
        Index("ix_bank_tx_user_date",    "user_id",    "transaction_date"),
    )
