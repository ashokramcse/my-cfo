from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.sql import func
import uuid
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action = Column(String(100), nullable=False)   # CREATE_CARD, UPDATE_EMI, DELETE_TRANSACTION, etc.
    resource_type = Column(String(50))
    resource_id = Column(String(100))
    ip_address = Column(String(45))
    user_agent = Column(Text)
    changes = Column(JSONB, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
