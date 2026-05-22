from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class StatementStatus(str, enum.Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    PARSED = "PARSED"
    FAILED = "FAILED"


class Statement(Base):
    __tablename__ = "statements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="CASCADE"), nullable=False, index=True)
    bank_account_id = Column(UUID(as_uuid=True), ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)

    # File info
    filename = Column(String(255), nullable=False)
    file_path = Column(Text)          # encrypted path
    file_size = Column(Numeric(12, 0))
    is_password_protected = Column(Boolean, default=False)
    # password never stored — used only during processing session

    # Statement period
    statement_date = Column(DateTime(timezone=True))
    period_from = Column(DateTime(timezone=True))
    period_to = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True))

    # Financials from statement
    opening_balance = Column(Numeric(12, 2), default=0)
    closing_balance = Column(Numeric(12, 2), default=0)
    total_due = Column(Numeric(12, 2), default=0)
    minimum_due = Column(Numeric(12, 2), default=0)
    available_credit = Column(Numeric(12, 2), default=0)
    credit_limit = Column(Numeric(12, 2), default=0)
    cash_limit = Column(Numeric(12, 2), default=0)
    total_payments = Column(Numeric(12, 2), default=0)
    total_purchases = Column(Numeric(12, 2), default=0)
    total_emi = Column(Numeric(12, 2), default=0)
    total_fees = Column(Numeric(12, 2), default=0)
    total_interest = Column(Numeric(12, 2), default=0)
    reward_points_earned = Column(Numeric(10, 0), default=0)
    reward_points_balance = Column(Numeric(10, 0), default=0)

    # Processing
    status = Column(SAEnum(StatementStatus), default=StatementStatus.PENDING)
    bank_detected = Column(String(100))
    parse_error = Column(Text)
    transaction_count = Column(Numeric(6, 0), default=0)
    raw_data = Column(JSONB, default=dict)  # parsed raw JSON before normalization

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="statements")
    card = relationship("CreditCard", back_populates="statements")
    transactions = relationship("Transaction", back_populates="statement", cascade="all, delete-orphan")
