from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Date, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class GoalType(str, enum.Enum):
    EMERGENCY_FUND = "EMERGENCY_FUND"
    RETIREMENT     = "RETIREMENT"
    HOUSE          = "HOUSE"
    CAR            = "CAR"
    EDUCATION      = "EDUCATION"
    VACATION       = "VACATION"
    DEBT_FREE      = "DEBT_FREE"
    INVESTMENT     = "INVESTMENT"
    WEDDING        = "WEDDING"
    OTHER          = "OTHER"


class GoalPriority(str, enum.Enum):
    HIGH   = "HIGH"
    MEDIUM = "MEDIUM"
    LOW    = "LOW"


class GoalStatus(str, enum.Enum):
    ACTIVE    = "ACTIVE"
    ACHIEVED  = "ACHIEVED"
    PAUSED    = "PAUSED"
    CANCELLED = "CANCELLED"


class Goal(Base):
    __tablename__ = "goals"

    id                   = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id              = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                                  nullable=False, index=True)

    name                 = Column(String(200), nullable=False)
    goal_type            = Column(SAEnum(GoalType), nullable=False)

    # Financial
    target_amount        = Column(Numeric(15, 2), nullable=False)
    current_amount       = Column(Numeric(15, 2), default=0)
    monthly_contribution = Column(Numeric(12, 2), default=0)

    # Target
    target_date          = Column(Date)

    # Meta
    priority     = Column(SAEnum(GoalPriority), default=GoalPriority.MEDIUM)
    status       = Column(SAEnum(GoalStatus), default=GoalStatus.ACTIVE)
    icon_color   = Column(String(20), default="#F59E0B")
    notes        = Column(Text)

    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="goals")
