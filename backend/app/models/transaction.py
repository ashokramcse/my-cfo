from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class TransactionType(str, enum.Enum):
    PURCHASE = "PURCHASE"
    EMI = "EMI"
    CASH_ADVANCE = "CASH_ADVANCE"
    PAYMENT = "PAYMENT"
    REFUND = "REFUND"
    FEE = "FEE"
    INTEREST = "INTEREST"
    REWARD_REDEMPTION = "REWARD_REDEMPTION"
    OTHER = "OTHER"


class CategoryType(str, enum.Enum):
    FOOD = "FOOD"
    FUEL = "FUEL"
    SHOPPING = "SHOPPING"
    RENT = "RENT"
    EMI = "EMI"
    TRAVEL = "TRAVEL"
    UTILITIES = "UTILITIES"
    ENTERTAINMENT = "ENTERTAINMENT"
    INVESTMENT = "INVESTMENT"
    HEALTHCARE = "HEALTHCARE"
    SUBSCRIPTION = "SUBSCRIPTION"
    EDUCATION = "EDUCATION"
    GROCERIES = "GROCERIES"
    DINING = "DINING"
    CASH_WITHDRAWAL = "CASH_WITHDRAWAL"
    TRANSFER = "TRANSFER"
    FEES = "FEES"
    OTHER = "OTHER"


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="SET NULL"), index=True)
    statement_id = Column(UUID(as_uuid=True), ForeignKey("statements.id", ondelete="SET NULL"), index=True)

    # Core transaction data
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    posted_date = Column(DateTime(timezone=True))
    description = Column(Text, nullable=False)
    merchant_name = Column(String(255), index=True)
    merchant_category = Column(String(100))
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(3), default="INR")
    transaction_type = Column(SAEnum(TransactionType), default=TransactionType.PURCHASE)
    category = Column(SAEnum(CategoryType), default=CategoryType.OTHER, index=True)

    # EMI info (if applicable)
    is_emi = Column(Boolean, default=False)
    emi_id = Column(UUID(as_uuid=True), ForeignKey("emis.id", ondelete="SET NULL"), index=True)
    emi_installment_no = Column(Integer)

    # Financial details
    gst_amount = Column(Numeric(10, 2), default=0)
    cashback_amount = Column(Numeric(10, 2), default=0)
    reward_points = Column(Integer, default=0)
    forex_markup = Column(Numeric(10, 2), default=0)

    # Flags
    is_recurring = Column(Boolean, default=False)
    is_subscription = Column(Boolean, default=False)
    is_duplicate = Column(Boolean, default=False)
    is_suspicious = Column(Boolean, default=False)
    is_manual = Column(Boolean, default=False)  # manually added vs parsed
    is_excluded = Column(Boolean, default=False)  # excluded from analytics

    notes = Column(Text)
    tags = Column(JSONB, default=list)
    raw_description = Column(Text)  # original unparsed text

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="transactions")
    card = relationship("CreditCard", back_populates="transactions")
    statement = relationship("Statement", back_populates="transactions")
    emi = relationship("EMI", back_populates="transactions", foreign_keys=[emi_id])
