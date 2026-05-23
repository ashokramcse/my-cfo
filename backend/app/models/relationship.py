from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class RelationshipType(str, enum.Enum):
    PARTNER = "partner"
    SPOUSE = "spouse"
    PARENT = "parent"
    CHILD = "child"
    SIBLING = "sibling"
    FRIEND = "friend"
    ADVISOR = "advisor"
    ACCOUNTANT = "accountant"
    AUDITOR = "auditor"
    MENTOR = "mentor"
    OTHER = "other"


class UserRelationship(Base):
    __tablename__ = "user_relationships"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # The user who initiated/owns the relationship entry
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # The related user
    related_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_type = Column(SAEnum(RelationshipType), nullable=False, default=RelationshipType.OTHER)
    # Custom label owner uses for this person (e.g. "My CA", "Dad")
    label = Column(String(100))
    is_trusted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
