from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Date, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class IncomeType(str, enum.Enum):
    SALARY      = "SALARY"
    FREELANCE   = "FREELANCE"
    BUSINESS    = "BUSINESS"
    CONSULTING  = "CONSULTING"
    RENTAL      = "RENTAL"
    INTEREST    = "INTEREST"
    DIVIDEND    = "DIVIDEND"
    SIDE_HUSTLE = "SIDE_HUSTLE"
    PENSION     = "PENSION"
    REMITTANCE  = "REMITTANCE"
    OTHER       = "OTHER"


class IncomeSource(Base):
    """Recurring income source (salary job, rental property, SIP dividends…)"""
    __tablename__ = "income_sources"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id     = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                         nullable=False, index=True)

    name        = Column(String(200), nullable=False)   # "Infosys Salary", "Flat 3B Rent"
    income_type = Column(SAEnum(IncomeType), nullable=False)
    employer    = Column(String(200))                   # Company / tenant / client name

    # Amount
    monthly_amount = Column(Numeric(15, 2), nullable=False)   # expected/average
    is_variable    = Column(Boolean, default=False)
    variable_min   = Column(Numeric(15, 2))
    variable_max   = Column(Numeric(15, 2))

    # Tax
    tax_deducted_pct = Column(Numeric(5, 2), default=0)    # TDS %

    is_active   = Column(Boolean, default=True)
    start_date  = Column(Date)
    notes       = Column(Text)

    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), onupdate=func.now())

    user    = relationship("User", back_populates="income_sources")
    entries = relationship("IncomeEntry", back_populates="source",
                           cascade="all, delete-orphan",
                           order_by="IncomeEntry.entry_date.desc()")


class IncomeEntry(Base):
    """Individual income receipt (this month's salary credit, rental received…)"""
    __tablename__ = "income_entries"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                        nullable=False, index=True)
    source_id  = Column(UUID(as_uuid=True), ForeignKey("income_sources.id", ondelete="CASCADE"),
                        nullable=False, index=True)

    entry_date = Column(Date, nullable=False)
    amount     = Column(Numeric(15, 2), nullable=False)
    notes      = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source = relationship("IncomeSource", back_populates="entries")
    user   = relationship("User", back_populates="income_entries")
