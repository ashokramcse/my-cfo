from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Insight(Base):
    __tablename__ = "insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    insight_type = Column(String(50), nullable=False)
    severity = Column(String(10), default="INFO")
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    action_label = Column(String(100))
    action_url = Column(String(255))
    is_read = Column(Boolean, default=False)
    is_dismissed = Column(Boolean, default=False)
    metadata = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="insights")
