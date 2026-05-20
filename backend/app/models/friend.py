from sqlalchemy import Column, String, Boolean, DateTime, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
from app.database import Base


class Friend(Base):
    __tablename__ = "friends"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    phone = Column(String(20))
    whatsapp = Column(String(20))
    email = Column(String(255))
    relation = Column(String(50), default="FRIEND")  # FRIEND, FAMILY, COLLEAGUE, OTHER
    avatar_color = Column(String(7), default="#6366f1")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    extra_data = Column(JSONB, default=dict)

    # Aggregated totals (updated by triggers/workers)
    total_emi_amount = Column(Numeric(12, 2), default=0)
    total_collected = Column(Numeric(12, 2), default=0)
    total_pending = Column(Numeric(12, 2), default=0)
    active_emi_count = Column(Numeric(4, 0), default=0)
    risk_level = Column(String(10), default="LOW")  # LOW, MEDIUM, HIGH

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="friends")
    emis = relationship("EMI", back_populates="friend")
