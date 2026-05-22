from sqlalchemy import Column, String, Boolean, DateTime, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class NotificationType(str, enum.Enum):
    LOAN_OVERDUE = "LOAN_OVERDUE"
    GOAL_MILESTONE = "GOAL_MILESTONE"
    NET_WORTH_CHANGE = "NET_WORTH_CHANGE"
    INSURANCE_RENEWAL = "INSURANCE_RENEWAL"
    EMI_DUE = "EMI_DUE"
    GENERAL = "GENERAL"


class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type       = Column(SAEnum(NotificationType), nullable=False)
    title      = Column(String(200), nullable=False)
    message    = Column(Text, nullable=False)
    is_read    = Column(Boolean, default=False)
    data       = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
