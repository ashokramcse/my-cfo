from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid

from app.models.share_permission import AccessType
from app.models.relationship import RelationshipType
from app.models.share_invitation import InvitationStatus
from app.schemas.auth import UserPublicOut


class CreateInvitationRequest(BaseModel):
    invitee_identifier: str  # username or email of the person to invite
    modules: List[str]       # list of module names to share
    access_type: AccessType = AccessType.FULL_READ
    relationship_type: RelationshipType = RelationshipType.OTHER
    relationship_label: Optional[str] = None
    access_duration_days: Optional[int] = None  # None = permanent
    message: Optional[str] = None


class InvitationOut(BaseModel):
    id: uuid.UUID
    invite_code: str
    invitee_identifier: str
    modules: List[str]
    access_type: str
    relationship_type: str
    relationship_label: Optional[str]
    access_duration_days: Optional[str]
    message: Optional[str]
    status: InvitationStatus
    expires_at: datetime
    created_at: datetime
    invitee_user: Optional[UserPublicOut] = None

    model_config = ConfigDict(from_attributes=True)


class AcceptInvitationResponse(BaseModel):
    message: str
    share_permission_id: uuid.UUID


class SharePermissionOut(BaseModel):
    id: uuid.UUID
    owner: UserPublicOut
    grantee: UserPublicOut
    modules: List[str]
    access_type: AccessType
    expires_at: Optional[datetime]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreateRelationshipRequest(BaseModel):
    related_user_id: uuid.UUID
    relationship_type: RelationshipType
    label: Optional[str] = None
    is_trusted: bool = False


class RelationshipOut(BaseModel):
    id: uuid.UUID
    related_user: UserPublicOut
    relationship_type: RelationshipType
    label: Optional[str]
    is_trusted: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UpdateSharePermissionRequest(BaseModel):
    modules: Optional[List[str]] = None
    access_type: Optional[AccessType] = None
    expires_at: Optional[datetime] = None
    is_active: Optional[bool] = None
