from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class LoanType(str, enum.Enum):
    HOME = "HOME"
    PERSONAL = "PERSONAL"
    VEHICLE = "VEHICLE"
    EDUCATION = "EDUCATION"
    GOLD = "GOLD"
    BUSINESS = "BUSINESS"
    BNPL = "BNPL"
    INFORMAL = "INFORMAL"    # Borrowed from family/friends
    OTHER = "OTHER"


class LoanStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    CLOSED = "CLOSED"
    OVERDUE = "OVERDUE"
    WRITTEN_OFF = "WRITTEN_OFF"


class Loan(Base):
    __tablename__ = "loans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    loan_type = Column(SAEnum(LoanType), nullable=False)
    lender_name = Column(String(200), nullable=False)   # "HDFC Bank", "Mom"
    loan_account_number = Column(String(100))
    nickname = Column(String(100))

    # Amounts
    principal_amount = Column(Numeric(15, 2), nullable=False)
    outstanding_balance = Column(Numeric(15, 2), nullable=False)
    emi_amount = Column(Numeric(12, 2))
    total_paid = Column(Numeric(15, 2), default=0)
    total_interest_paid = Column(Numeric(15, 2), default=0)

    # Rates & Terms
    interest_rate = Column(Numeric(6, 3), nullable=False)  # annual %
    tenure_months = Column(Integer)
    remaining_months = Column(Integer)

    # Dates
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    emi_due_day = Column(Integer, default=5)    # day of month

    # Status
    status = Column(SAEnum(LoanStatus), default=LoanStatus.ACTIVE)
    is_secured = Column(Boolean, default=False)
    collateral = Column(String(200))

    # Floating rate (D-09)
    is_floating_rate     = Column(Boolean, default=False)
    next_rate_reset_date = Column(Date, nullable=True)
    floating_rate_index  = Column(String(50), nullable=True)  # e.g. "REPO", "MCLR"

    # Prepayment
    prepayment_penalty = Column(Numeric(5, 2), default=0)  # %

    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="loans")
