from sqlalchemy import Column, String, DateTime, Text, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class MessageRole(str, enum.Enum):
    USER      = "user"
    ASSISTANT = "assistant"
    SYSTEM    = "system"


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"),
                              nullable=False, index=True)
    session_id       = Column(UUID(as_uuid=True), nullable=False, index=True)

    role             = Column(SAEnum(MessageRole), nullable=False)
    content          = Column(Text, nullable=False)

    # Snapshot of financial data at time of message (for context)
    context_snapshot = Column(JSONB, default=dict)
    model_used       = Column(String(100))        # "llama3", "rule-based"

    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="ai_conversations")
