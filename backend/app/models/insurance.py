from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Date, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class InsuranceType(str, enum.Enum):
    HEALTH    = "HEALTH"
    TERM      = "TERM"
    LIFE      = "LIFE"
    VEHICLE   = "VEHICLE"
    TRAVEL    = "TRAVEL"
    PROPERTY  = "PROPERTY"
    OTHER     = "OTHER"


class PremiumFrequency(str, enum.Enum):
    MONTHLY     = "MONTHLY"
    QUARTERLY   = "QUARTERLY"
    HALF_YEARLY = "HALF_YEARLY"
    YEARLY      = "YEARLY"
    SINGLE      = "SINGLE"


class Insurance(Base):
    __tablename__ = "insurances"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                              nullable=False, index=True)

    insurance_type   = Column(SAEnum(InsuranceType), nullable=False)
    policy_name      = Column(String(200), nullable=False)   # "HDFC Ergo Health Optima"
    insurer          = Column(String(200), nullable=False)   # "HDFC Ergo", "LIC", "Star Health"
    policy_number    = Column(String(100))

    # Financial
    premium_amount      = Column(Numeric(12, 2), nullable=False)
    premium_frequency   = Column(SAEnum(PremiumFrequency), default=PremiumFrequency.YEARLY)
    sum_assured         = Column(Numeric(15, 2))       # Cover amount / sum assured
    cover_amount        = Column(Numeric(15, 2))       # Health cover / IDV for vehicle

    # Dates
    start_date    = Column(Date)
    end_date      = Column(Date)
    renewal_date  = Column(Date)        # Next premium due / renewal

    # Details
    beneficiary   = Column(String(300))             # Name(s) of nominees
    is_active     = Column(Boolean, default=True)
    notes         = Column(Text)
    extra_data    = Column(JSONB, default=dict)     # claims history, riders, etc.

    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    updated_at    = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="insurances")
