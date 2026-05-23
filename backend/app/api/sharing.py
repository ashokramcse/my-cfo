from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from datetime import datetime, timezone, timedelta
import uuid

from app.database import get_db
from app.models.user import User
from app.models.share_permission import SharePermission, SHAREABLE_MODULES
from app.models.share_invitation import ShareInvitation, InvitationStatus
from app.models.relationship import UserRelationship, RelationshipType
from app.schemas.sharing import (
    CreateInvitationRequest, InvitationOut,
    AcceptInvitationResponse, SharePermissionOut,
    CreateRelationshipRequest, RelationshipOut,
    UpdateSharePermissionRequest,
)
from app.schemas.auth import UserPublicOut
from app.utils.deps import get_current_user

router = APIRouter()


# ─── Helper ──────────────────────────────────────────────────────────────────

def _validate_modules(modules: list) -> list:
    invalid = [m for m in modules if m not in SHAREABLE_MODULES]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid modules: {invalid}. Valid: {sorted(SHAREABLE_MODULES)}")
    return modules


def _user_public(u: User) -> dict:
    return {"id": str(u.id), "username": u.username, "full_name": u.full_name, "avatar_url": u.avatar_url}


# ─── Invitations ─────────────────────────────────────────────────────────────

@router.post("/invitations", response_model=InvitationOut, status_code=201)
async def create_invitation(
    payload: CreateInvitationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    _validate_modules(payload.modules)

    # Find invitee by username or email
    ident = payload.invitee_identifier.strip().lower()
    stmt = select(User).where(
        and_(
            User.is_active.is_(True),
            or_(User.username == ident, User.email == ident),
        )
    )
    result = await db.execute(stmt)
    invitee = result.scalar_one_or_none()

    if invitee and invitee.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself")

    # Check for duplicate active invitation
    if invitee:
        dup_stmt = select(ShareInvitation).where(
            and_(
                ShareInvitation.inviter_id == current_user.id,
                ShareInvitation.invitee_user_id == invitee.id,
                ShareInvitation.status == InvitationStatus.PENDING,
            )
        )
        dup = await db.execute(dup_stmt)
        if dup.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="A pending invitation already exists for this user")

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    invitation = ShareInvitation(
        inviter_id=current_user.id,
        invitee_identifier=payload.invitee_identifier,
        invitee_user_id=invitee.id if invitee else None,
        modules=payload.modules,
        access_type=payload.access_type.value,
        relationship_type=payload.relationship_type.value,
        relationship_label=payload.relationship_label,
        access_duration_days=str(payload.access_duration_days) if payload.access_duration_days else None,
        message=payload.message,
        expires_at=expires_at,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    out = InvitationOut.model_validate(invitation)
    if invitee:
        out.invitee_user = UserPublicOut.model_validate(invitee)
    return out


@router.get("/invitations/sent", response_model=list[InvitationOut])
async def list_sent_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareInvitation).where(ShareInvitation.inviter_id == current_user.id)
        .order_by(ShareInvitation.created_at.desc())
    )
    invitations = result.scalars().all()
    out_list = []
    for inv in invitations:
        item = InvitationOut.model_validate(inv)
        if inv.invitee_user_id:
            u_result = await db.execute(select(User).where(User.id == inv.invitee_user_id))
            invitee = u_result.scalar_one_or_none()
            if invitee:
                item.invitee_user = UserPublicOut.model_validate(invitee)
        out_list.append(item)
    return out_list


@router.get("/invitations/received", response_model=list[InvitationOut])
async def list_received_invitations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareInvitation).where(
            and_(
                ShareInvitation.invitee_user_id == current_user.id,
                ShareInvitation.status == InvitationStatus.PENDING,
            )
        ).order_by(ShareInvitation.created_at.desc())
    )
    invitations = result.scalars().all()
    out_list = []
    for inv in invitations:
        item = InvitationOut.model_validate(inv)
        u_result = await db.execute(select(User).where(User.id == inv.inviter_id))
        inviter = u_result.scalar_one_or_none()
        if inviter:
            item.invitee_user = UserPublicOut.model_validate(inviter)  # reusing field for inviter info
        out_list.append(item)
    return out_list


@router.post("/invitations/{invite_code}/accept", response_model=AcceptInvitationResponse)
async def accept_invitation(
    invite_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ShareInvitation).where(ShareInvitation.invite_code == invite_code)
    )
    invitation = result.scalar_one_or_none()

    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(status_code=400, detail=f"Invitation is already {invitation.status.value}")
    if invitation.expires_at < datetime.now(timezone.utc):
        invitation.status = InvitationStatus.EXPIRED
        await db.commit()
        raise HTTPException(status_code=400, detail="Invitation has expired")

    # Validate the accepting user matches the invitee (by email/username if registered)
    ident = invitation.invitee_identifier.strip().lower()
    if not (current_user.email.lower() == ident or current_user.username.lower() == ident):
        # Also allow if invitee_user_id was already set to current user
        if invitation.invitee_user_id != current_user.id:
            raise HTTPException(status_code=403, detail="This invitation is not for your account")

    # Compute access expiry
    expires_at = None
    if invitation.access_duration_days:
        days = int(invitation.access_duration_days)
        if days > 0:
            expires_at = datetime.now(timezone.utc) + timedelta(days=days)

    # Create (or reactivate) SharePermission
    perm_result = await db.execute(
        select(SharePermission).where(
            and_(
                SharePermission.owner_id == invitation.inviter_id,
                SharePermission.grantee_id == current_user.id,
            )
        )
    )
    existing_perm = perm_result.scalar_one_or_none()

    if existing_perm:
        existing_perm.modules = invitation.modules
        existing_perm.access_type = invitation.access_type
        existing_perm.expires_at = expires_at
        existing_perm.is_active = True
        permission = existing_perm
    else:
        permission = SharePermission(
            owner_id=invitation.inviter_id,
            grantee_id=current_user.id,
            modules=invitation.modules,
            access_type=invitation.access_type,
            expires_at=expires_at,
        )
        db.add(permission)

    # Update invitation
    invitation.status = InvitationStatus.ACCEPTED
    invitation.invitee_user_id = current_user.id
    invitation.responded_at = datetime.now(timezone.utc)
    await db.flush()
    invitation.share_permission_id = permission.id

    # Upsert relationship on inviter's side
    rel_result = await db.execute(
        select(UserRelationship).where(
            and_(
                UserRelationship.owner_id == invitation.inviter_id,
                UserRelationship.related_user_id == current_user.id,
            )
        )
    )
    rel = rel_result.scalar_one_or_none()
    if not rel:
        rel = UserRelationship(
            owner_id=invitation.inviter_id,
            related_user_id=current_user.id,
            relationship_type=invitation.relationship_type,
            label=invitation.relationship_label,
        )
        db.add(rel)

    await db.commit()
    await db.refresh(permission)
    return AcceptInvitationResponse(message="Access granted successfully", share_permission_id=permission.id)


@router.post("/invitations/{invitation_id}/decline", status_code=204)
async def decline_invitation(
    invitation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ShareInvitation).where(ShareInvitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation or invitation.invitee_user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    invitation.status = InvitationStatus.DECLINED
    invitation.responded_at = datetime.now(timezone.utc)
    await db.commit()


@router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invitation(
    invitation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ShareInvitation).where(ShareInvitation.id == invitation_id))
    invitation = result.scalar_one_or_none()
    if not invitation or invitation.inviter_id != current_user.id:
        raise HTTPException(status_code=404, detail="Invitation not found")
    invitation.status = InvitationStatus.REVOKED
    await db.commit()


# ─── Share Permissions ───────────────────────────────────────────────────────

@router.get("/permissions/given", response_model=list[dict])
async def list_permissions_given(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users I have granted access to."""
    result = await db.execute(
        select(SharePermission).where(
            and_(SharePermission.owner_id == current_user.id, SharePermission.is_active.is_(True))
        )
    )
    perms = result.scalars().all()
    out = []
    for p in perms:
        grantee_result = await db.execute(select(User).where(User.id == p.grantee_id))
        grantee = grantee_result.scalar_one_or_none()
        out.append({
            "id": str(p.id),
            "grantee": _user_public(grantee) if grantee else None,
            "modules": p.modules,
            "access_type": p.access_type,
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat(),
        })
    return out


@router.get("/permissions/received", response_model=list[dict])
async def list_permissions_received(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users whose data I can view."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(SharePermission).where(
            and_(
                SharePermission.grantee_id == current_user.id,
                SharePermission.is_active.is_(True),
            )
        )
    )
    perms = result.scalars().all()
    out = []
    for p in perms:
        if p.expires_at and p.expires_at < now:
            continue
        owner_result = await db.execute(select(User).where(User.id == p.owner_id))
        owner = owner_result.scalar_one_or_none()
        out.append({
            "id": str(p.id),
            "owner": _user_public(owner) if owner else None,
            "modules": p.modules,
            "access_type": p.access_type,
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat(),
        })
    return out


@router.patch("/permissions/{permission_id}", status_code=200)
async def update_permission(
    permission_id: uuid.UUID,
    payload: UpdateSharePermissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharePermission).where(SharePermission.id == permission_id))
    perm = result.scalar_one_or_none()
    if not perm or perm.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Permission not found")

    if payload.modules is not None:
        _validate_modules(payload.modules)
        perm.modules = payload.modules
    if payload.access_type is not None:
        perm.access_type = payload.access_type
    if payload.expires_at is not None:
        perm.expires_at = payload.expires_at
    if payload.is_active is not None:
        perm.is_active = payload.is_active

    await db.commit()
    return {"message": "Permission updated"}


@router.delete("/permissions/{permission_id}", status_code=204)
async def revoke_permission(
    permission_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SharePermission).where(SharePermission.id == permission_id))
    perm = result.scalar_one_or_none()
    if not perm or perm.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Permission not found")
    perm.is_active = False
    await db.commit()


# ─── Relationships ───────────────────────────────────────────────────────────

@router.get("/relationships", response_model=list[dict])
async def list_relationships(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserRelationship).where(UserRelationship.owner_id == current_user.id)
    )
    rels = result.scalars().all()
    out = []
    for r in rels:
        u_result = await db.execute(select(User).where(User.id == r.related_user_id))
        related = u_result.scalar_one_or_none()
        out.append({
            "id": str(r.id),
            "related_user": _user_public(related) if related else None,
            "relationship_type": r.relationship_type,
            "label": r.label,
            "is_trusted": r.is_trusted,
            "created_at": r.created_at.isoformat(),
        })
    return out


@router.delete("/relationships/{relationship_id}", status_code=204)
async def remove_relationship(
    relationship_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(UserRelationship).where(UserRelationship.id == relationship_id))
    rel = result.scalar_one_or_none()
    if not rel or rel.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Relationship not found")
    await db.delete(rel)
    await db.commit()
