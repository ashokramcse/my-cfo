from fastapi import Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional, List
import uuid

from app.database import get_db
from app.models.user import User
from app.models.share_permission import SharePermission, AccessType
from app.utils.security import decode_token

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate JWT, return the authenticated User."""
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise exc

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise exc

    user_id_str = payload.get("sub")
    try:
        user_id = uuid.UUID(user_id_str)
    except (TypeError, ValueError):
        raise exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise exc
    return user


@dataclass
class DataAccessContext:
    """Describes who is accessing whose data and what they can see."""
    # The user whose data is being read
    owner: User
    # The currently authenticated user (may differ from owner for shared access)
    requester: User
    is_shared: bool = False
    # Which modules the requester may access (None = all modules allowed)
    permitted_modules: Optional[List[str]] = field(default=None)
    access_type: AccessType = AccessType.FULL_READ

    @property
    def can_write(self) -> bool:
        return not self.is_shared

    def assert_module_access(self, module: str) -> None:
        if self.permitted_modules is not None and module not in self.permitted_modules:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have access to the '{module}' module for this user.",
            )


async def get_data_context(
    owner_id: Optional[str] = Query(None, description="User ID whose data to access (for shared access)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DataAccessContext:
    """
    Returns a DataAccessContext.
    - If owner_id is absent or equals current user → owner access, full write allowed.
    - If owner_id is another user → validate SharePermission exists; read-only.
    """
    if not owner_id or owner_id == str(current_user.id):
        return DataAccessContext(owner=current_user, requester=current_user)

    try:
        target_id = uuid.UUID(owner_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid owner_id")

    # Load target user
    result = await db.execute(select(User).where(User.id == target_id))
    owner = result.scalar_one_or_none()
    if not owner or not owner.is_active:
        raise HTTPException(status_code=404, detail="User not found")

    # Find an active, non-expired SharePermission
    now = datetime.now(timezone.utc)
    stmt = select(SharePermission).where(
        and_(
            SharePermission.owner_id == target_id,
            SharePermission.grantee_id == current_user.id,
            SharePermission.is_active.is_(True),
        )
    )
    result = await db.execute(stmt)
    permission = result.scalar_one_or_none()

    if not permission:
        raise HTTPException(status_code=403, detail="You do not have access to this user's financial data.")

    if permission.expires_at and permission.expires_at < now:
        raise HTTPException(status_code=403, detail="Your access to this user's data has expired.")

    modules: Optional[List[str]] = permission.modules if permission.modules else None

    return DataAccessContext(
        owner=owner,
        requester=current_user,
        is_shared=True,
        permitted_modules=modules,
        access_type=permission.access_type,
    )


def require_write(ctx: DataAccessContext = Depends(get_data_context)) -> DataAccessContext:
    """Dependency that rejects shared (read-only) access for mutation endpoints."""
    if ctx.is_shared:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Shared users have read-only access. Modifications are not allowed.",
        )
    return ctx
