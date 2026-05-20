from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.user import User

OWNER_USERNAME = "owner"
OWNER_EMAIL = "owner@ccbill.local"


async def get_current_user(db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.username == OWNER_USERNAME))
    user = result.scalar_one_or_none()
    if not user:
        from app.utils.security import hash_password
        user = User(
            username=OWNER_USERNAME,
            email=OWNER_EMAIL,
            hashed_password=hash_password("no-login"),
            full_name="Owner",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user
