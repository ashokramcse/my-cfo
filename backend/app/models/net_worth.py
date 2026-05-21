from sqlalchemy import Column, String, DateTime, Numeric, Integer, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class NetWorthSnapshot(Base):
    """Point-in-time net worth snapshot for trending / charting."""
    __tablename__ = "net_worth_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    snapshot_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Assets
    bank_balance = Column(Numeric(15, 2), default=0)
    investment_value = Column(Numeric(15, 2), default=0)
    asset_value = Column(Numeric(15, 2), default=0)
    total_assets = Column(Numeric(15, 2), default=0)

    # Liabilities
    credit_card_outstanding = Column(Numeric(15, 2), default=0)
    loan_outstanding = Column(Numeric(15, 2), default=0)
    total_liabilities = Column(Numeric(15, 2), default=0)

    # Net Worth
    net_worth = Column(Numeric(15, 2), default=0)

    # Change from previous snapshot
    change_amount = Column(Numeric(15, 2), default=0)
    change_pct = Column(Numeric(8, 4), default=0)

    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)

    user = relationship("User", back_populates="net_worth_snapshots")
