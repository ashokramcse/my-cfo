from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class AccessType(str, enum.Enum):
    FULL_READ = "full_read"
    ANALYTICS_ONLY = "analytics_only"
    SUMMARY_ONLY = "summary_only"
    REPORT_ONLY = "report_only"


# Valid module names that can be shared
SHAREABLE_MODULES = frozenset([
    "banking", "cards", "transactions", "emis",
    "investments", "loans", "assets", "net_worth",
    "income", "insurance", "goals", "reports",
])


class SharePermission(Base):
    """Grants grantee read-only access to owner's specific modules."""
    __tablename__ = "share_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    grantee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    relationship_id = Column(UUID(as_uuid=True), ForeignKey("user_relationships.id", ondelete="SET NULL"), nullable=True)
    # JSON array of module names from SHAREABLE_MODULES; null = all modules
    modules = Column(JSONB, default=list)
    access_type = Column(SAEnum(AccessType), nullable=False, default=AccessType.FULL_READ)
    # null = permanent access
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
