from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text, Integer, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class EMIStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    PRECLOSED = "PRECLOSED"
    DEFAULTED = "DEFAULTED"


class EMIOwnerType(str, enum.Enum):
    SELF = "SELF"
    FRIEND = "FRIEND"
    FAMILY = "FAMILY"
    OFFICE = "OFFICE"
    SHARED = "SHARED"


class EMI(Base):
    __tablename__ = "emis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    card_id = Column(UUID(as_uuid=True), ForeignKey("credit_cards.id", ondelete="SET NULL"), index=True)
    friend_id = Column(UUID(as_uuid=True), ForeignKey("friends.id", ondelete="SET NULL"), index=True)

    # Product / purchase
    product_name = Column(String(255), nullable=False)
    merchant_name = Column(String(255))
    purchase_date = Column(DateTime(timezone=True), nullable=False)
    purchase_amount = Column(Numeric(12, 2), nullable=False)

    # EMI structure
    total_amount = Column(Numeric(12, 2), nullable=False)  # with interest
    monthly_emi = Column(Numeric(12, 2), nullable=False)
    tenure_months = Column(Integer, nullable=False)
    interest_rate = Column(Numeric(5, 2), default=0)
    is_no_cost_emi = Column(Boolean, default=False)
    processing_fee = Column(Numeric(10, 2), default=0)
    total_interest = Column(Numeric(12, 2), default=0)

    # Progress
    paid_months = Column(Integer, default=0)
    remaining_months = Column(Integer)
    amount_paid = Column(Numeric(12, 2), default=0)
    amount_remaining = Column(Numeric(12, 2))
    start_date = Column(DateTime(timezone=True))
    end_date = Column(DateTime(timezone=True))
    next_due_date = Column(DateTime(timezone=True))

    # Ownership
    owner_type = Column(SAEnum(EMIOwnerType), default=EMIOwnerType.SELF)
    # For SHARED ownership — percentage user bears
    user_share_percent = Column(Numeric(5, 2), default=100)

    # Status
    status = Column(SAEnum(EMIStatus), default=EMIStatus.ACTIVE)
    preclosure_date = Column(DateTime(timezone=True))
    preclosure_charges = Column(Numeric(10, 2), default=0)

    # Collection (if friend/family EMI)
    amount_collected = Column(Numeric(12, 2), default=0)
    last_collection_date = Column(DateTime(timezone=True))
    reminder_enabled = Column(Boolean, default=True)
    reminder_day = Column(Integer, default=5)  # day of month to send reminder

    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="emis")
    card = relationship("CreditCard", back_populates="emis")
    friend = relationship("Friend", back_populates="emis")
    payments = relationship("EMIPayment", back_populates="emi", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="emi", foreign_keys="Transaction.emi_id")


class EMIPayment(Base):
    __tablename__ = "emi_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emi_id = Column(UUID(as_uuid=True), ForeignKey("emis.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    installment_no = Column(Integer, nullable=False)
    due_date = Column(DateTime(timezone=True), nullable=False)
    paid_date = Column(DateTime(timezone=True))
    expected_amount = Column(Numeric(12, 2), nullable=False)
    paid_amount = Column(Numeric(12, 2), default=0)
    is_paid = Column(Boolean, default=False)
    is_overdue = Column(Boolean, default=False)
    late_fee = Column(Numeric(10, 2), default=0)
    notes = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    emi = relationship("EMI", back_populates="payments")
