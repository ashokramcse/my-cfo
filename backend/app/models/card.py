from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class CardNetwork(str, enum.Enum):
    VISA = "VISA"
    MASTERCARD = "MASTERCARD"
    AMEX = "AMEX"
    RUPAY = "RUPAY"
    DINERS = "DINERS"
    OTHER = "OTHER"


class CardStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    BLOCKED = "BLOCKED"
    CLOSED = "CLOSED"


class CreditCard(Base):
    __tablename__ = "credit_cards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Card Identity
    nickname = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    card_name = Column(String(200))
    last_four = Column(String(4), nullable=False)
    network = Column(SAEnum(CardNetwork), default=CardNetwork.VISA)
    status = Column(SAEnum(CardStatus), default=CardStatus.ACTIVE)
    card_color = Column(String(7), default="#6366f1")  # hex color for UI

    # Limits & Rates
    credit_limit = Column(Numeric(12, 2), default=0)
    available_limit = Column(Numeric(12, 2), default=0)
    current_outstanding = Column(Numeric(12, 2), default=0)
    interest_rate = Column(Numeric(5, 2), default=0)  # annual %
    cash_advance_rate = Column(Numeric(5, 2), default=0)

    # Billing
    billing_cycle_day = Column(Integer, default=1)   # day of month
    due_date_day = Column(Integer, default=25)        # days after cycle
    statement_day = Column(Integer, default=5)

    # Fees
    annual_fee = Column(Numeric(10, 2), default=0)
    joining_fee = Column(Numeric(10, 2), default=0)
    annual_fee_waiver_spend = Column(Numeric(12, 2))

    # Rewards
    reward_program = Column(String(100))
    reward_rate = Column(Numeric(5, 2), default=0)   # points per ₹100
    total_reward_points = Column(Integer, default=0)
    lounge_access = Column(Boolean, default=False)
    lounge_quota_quarterly = Column(Integer, default=0)

    # Meta
    expiry_month = Column(Integer)
    expiry_year = Column(Integer)
    card_image_url = Column(Text)
    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="cards")
    statements = relationship("Statement", back_populates="card", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="card", cascade="all, delete-orphan")
    emis = relationship("EMI", back_populates="card", cascade="all, delete-orphan")
