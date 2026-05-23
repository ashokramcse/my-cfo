from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
import uuid
import enum
from app.database import Base


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class ShareInvitation(Base):
    __tablename__ = "share_invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Invite can target by email or username
    invitee_identifier = Column(String(255), nullable=False)  # email or username
    invitee_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    # Unique invite code the invitee uses to accept
    invite_code = Column(String(64), unique=True, nullable=False, default=lambda: uuid.uuid4().hex)
    # Modules and access type requested
    modules = Column(JSONB, default=list)
    access_type = Column(String(50), default="full_read")
    relationship_type = Column(String(50), default="other")
    relationship_label = Column(String(100))
    # How long the granted access should last (null = permanent)
    access_duration_days = Column(String(20))
    message = Column(Text)
    status = Column(SAEnum(InvitationStatus), nullable=False, default=InvitationStatus.PENDING)
    # Set when accepted → links to the created SharePermission
    share_permission_id = Column(UUID(as_uuid=True), ForeignKey("share_permissions.id", ondelete="SET NULL"), nullable=True)
    # Invite link itself expires after 7 days
    expires_at = Column(DateTime(timezone=True), nullable=False)
    responded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
