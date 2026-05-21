from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Integer, ForeignKey, Text, Enum as SAEnum, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class InvestmentType(str, enum.Enum):
    STOCKS = "STOCKS"
    MUTUAL_FUND = "MUTUAL_FUND"
    ETF = "ETF"
    CRYPTO = "CRYPTO"
    GOLD = "GOLD"
    SILVER = "SILVER"
    SGB = "SGB"           # Sovereign Gold Bond
    PPF = "PPF"
    EPF = "EPF"
    NPS = "NPS"
    BONDS = "BONDS"
    REITS = "REITS"
    OTHER = "OTHER"


class SIPStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    STOPPED = "STOPPED"


class Investment(Base):
    __tablename__ = "investments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    investment_type = Column(SAEnum(InvestmentType), nullable=False)
    name = Column(String(200), nullable=False)       # "Reliance Industries", "Axis Bluechip Fund"
    symbol = Column(String(50))                       # NSE/BSE ticker or ISIN
    folio_number = Column(String(100))                # For MF

    # Units/Quantity
    units = Column(Numeric(15, 4), default=0)         # shares / units / grams
    avg_buy_price = Column(Numeric(15, 4), default=0) # per unit

    # Current valuation
    current_price = Column(Numeric(15, 4), default=0)
    current_value = Column(Numeric(15, 2), default=0)
    invested_amount = Column(Numeric(15, 2), default=0)

    # SIP details
    is_sip = Column(Boolean, default=False)
    sip_amount = Column(Numeric(12, 2))
    sip_date = Column(Integer)              # day of month
    sip_status = Column(SAEnum(SIPStatus), default=SIPStatus.ACTIVE)
    sip_start_date = Column(Date)
    sip_end_date = Column(Date)

    # Gold specific (weight in grams)
    weight_grams = Column(Numeric(10, 3))
    purity = Column(String(10))             # "24K", "22K", "999"

    # Broker/Platform
    broker = Column(String(100))
    platform = Column(String(100))          # Zerodha, Groww, etc.

    # Lock-in
    lock_in_until = Column(Date)
    is_locked = Column(Boolean, default=False)

    # Returns
    unrealized_pnl = Column(Numeric(15, 2), default=0)
    realized_pnl = Column(Numeric(15, 2), default=0)
    xirr = Column(Numeric(8, 4))            # annualized return %
    cagr = Column(Numeric(8, 4))

    # Metadata
    purchase_date = Column(Date)
    notes = Column(Text)
    extra_data = Column(JSONB, default=dict)
    last_price_updated = Column(DateTime(timezone=True))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="investments")
