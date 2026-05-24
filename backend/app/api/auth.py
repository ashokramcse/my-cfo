from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timezone, timedelta
import hashlib
import uuid
from collections import defaultdict
import time

from app.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.models.user_session import UserSession
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, RefreshRequest,
    UserOut, SessionOut, ChangePasswordRequest,
)
from app.utils.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.utils.deps import get_current_user
from app.config import settings

router = APIRouter()

# ── In-memory login rate limiter: max 10 attempts per IP per 15 minutes ───────
_login_attempts: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT_WINDOW = 900   # 15 minutes in seconds
_RATE_LIMIT_MAX    = 10    # max attempts per window


def _check_login_rate_limit(ip: str) -> None:
    now = time.time()
    cutoff = now - _RATE_LIMIT_WINDOW
    attempts = [t for t in _login_attempts[ip] if t > cutoff]
    _login_attempts[ip] = attempts
    if len(attempts) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in 15 minutes.",
        )
    _login_attempts[ip].append(now)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _device_name(request: Request) -> str:
    ua = request.headers.get("user-agent", "")
    # Simple heuristic — keep it short
    for hint in ("iPhone", "Android", "iPad", "Mac", "Windows", "Linux"):
        if hint in ua:
            return hint
    return "Unknown Device"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check uniqueness
    existing_email = await db.execute(select(User).where(User.email == payload.email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = await db.execute(select(User).where(User.username == payload.username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username.lower(),
        full_name=payload.full_name,
        phone=payload.phone,
        country=payload.country,
        currency=payload.currency,
        hashed_password=hash_password(payload.password),
        is_active=True,
        is_verified=True,  # simplified: skip email verification flow for now
    )
    db.add(user)
    await db.flush()

    db.add(AuditLog(
        user_id=user.id,
        action="REGISTER",
        resource_type="user",
        resource_id=str(user.id),
    ))

    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    _check_login_rate_limit(_client_ip(request))

    # Support login via email or username
    identifier = payload.identifier.strip().lower()
    if "@" in identifier:
        stmt = select(User).where(User.email == identifier)
    else:
        stmt = select(User).where(User.username == identifier)

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})

    # Persist session
    session_expires = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=_hash_token(refresh_token),
        device_name=_device_name(request),
        user_agent=request.headers.get("user-agent"),
        ip_address=_client_ip(request),
        expires_at=session_expires,
    )
    db.add(session)

    user.last_login = datetime.now(timezone.utc)
    db.add(AuditLog(
        user_id=user.id,
        action="LOGIN",
        resource_type="user",
        resource_id=str(user.id),
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    ))

    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest, request: Request, db: AsyncSession = Depends(get_db)):
    decoded = decode_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = _hash_token(payload.refresh_token)
    stmt = select(UserSession).where(
        and_(
            UserSession.refresh_token_hash == token_hash,
            UserSession.is_active.is_(True),
        )
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired or revoked")

    result = await db.execute(select(User).where(User.id == decoded["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate refresh token
    new_access = create_access_token({"sub": str(user.id)})
    new_refresh = create_refresh_token({"sub": str(user.id)})

    session.refresh_token_hash = _hash_token(new_refresh)
    session.last_used_at = datetime.now(timezone.utc)
    session.ip_address = _client_ip(request)

    await db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/logout", status_code=204)
async def logout(
    payload: RefreshRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_hash = _hash_token(payload.refresh_token)
    result = await db.execute(
        select(UserSession).where(
            and_(
                UserSession.refresh_token_hash == token_hash,
                UserSession.user_id == current_user.id,
            )
        )
    )
    session = result.scalar_one_or_none()
    if session:
        session.is_active = False
        await db.commit()


@router.post("/logout-all", status_code=204)
async def logout_all(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSession).where(
            and_(UserSession.user_id == current_user.id, UserSession.is_active.is_(True))
        )
    )
    sessions = result.scalars().all()
    for s in sessions:
        s.is_active = False
    await db.commit()


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = {"full_name", "phone", "country", "currency", "timezone", "profile_bio", "avatar_url"}
    for key, val in payload.items():
        if key in allowed:
            setattr(current_user, key, val)
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.patch("/profile")
async def update_profile(
    payload: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update mutable profile fields: full_name, email."""
    allowed = {"full_name", "email"}
    for field, value in payload.items():
        if field in allowed and value is not None:
            setattr(current_user, field, value.strip())
    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/change-password", status_code=204)
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(UserSession)
        .where(
            and_(
                UserSession.user_id == current_user.id,
                UserSession.is_active.is_(True),
                UserSession.expires_at > now,
            )
        )
        .order_by(UserSession.last_used_at.desc())
        .limit(10)
    )
    sessions = result.scalars().all()
    # Deduplicate: keep only latest per (device_name, ip_address) pair
    seen: set = set()
    unique = []
    for s in sessions:
        key = (s.device_name or 'Unknown', s.ip_address or '')
        if key not in seen:
            seen.add(key)
            unique.append(s)
    return unique


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSession).where(
            and_(UserSession.id == session_id, UserSession.user_id == current_user.id)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_active = False
    await db.commit()


@router.get("/users/search", response_model=list[dict])
async def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search other users by username or email for sharing invitations."""
    from sqlalchemy import or_
    q_clean = q.strip().lower()
    if len(q_clean) < 2:
        return []

    result = await db.execute(
        select(User).where(
            and_(
                User.id != current_user.id,
                User.is_active.is_(True),
                (User.username.ilike(f"%{q_clean}%")) | (User.email.ilike(f"%{q_clean}%")),
            )
        ).limit(10)
    )
    users = result.scalars().all()
    return [
        {"id": str(u.id), "username": u.username, "full_name": u.full_name, "avatar_url": u.avatar_url}
        for u in users
    ]
