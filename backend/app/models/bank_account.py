from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class AccountType(str, enum.Enum):
    SAVINGS = "SAVINGS"
    CURRENT = "CURRENT"
    SALARY = "SALARY"
    WALLET = "WALLET"
    UPI = "UPI"
    CASH = "CASH"
    FD = "FD"
    RD = "RD"


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    nickname = Column(String(100), nullable=False)
    bank_name = Column(String(100), nullable=False)
    account_type = Column(SAEnum(AccountType), default=AccountType.SAVINGS)
    account_number_last4 = Column(String(4))
    ifsc_code = Column(String(20))
    branch = Column(String(200))

    # Balance tracking
    current_balance = Column(Numeric(15, 2), default=0)
    minimum_balance = Column(Numeric(12, 2), default=0)

    # FD/RD specific
    interest_rate = Column(Numeric(5, 2), default=0)
    maturity_date = Column(DateTime(timezone=True))
    maturity_amount = Column(Numeric(15, 2))

    # UI
    account_color = Column(String(7), default="#0EA5E9")
    is_active = Column(Boolean, default=True)
    is_primary = Column(Boolean, default=False)

    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="bank_accounts")
