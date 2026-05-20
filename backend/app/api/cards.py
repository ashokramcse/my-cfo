from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
import uuid
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.card import CreditCard
from app.schemas.card import CardCreate, CardUpdate, CardOut, CardListOut

router = APIRouter()


@router.get("", response_model=CardListOut)
async def list_cards(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = select(CreditCard).where(CreditCard.user_id == current_user.id)
    if status:
        q = q.where(CreditCard.status == status)
    q = q.order_by(CreditCard.created_at.desc())
    result = await db.execute(q)
    cards = result.scalars().all()
    return CardListOut(items=cards, total=len(cards))


@router.post("", response_model=CardOut, status_code=status.HTTP_201_CREATED)
async def create_card(
    payload: CardCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    card = CreditCard(**payload.model_dump(), user_id=current_user.id)
    card.available_limit = payload.credit_limit
    db.add(card)
    await db.flush()
    return card


@router.get("/{card_id}", response_model=CardOut)
async def get_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.patch("/{card_id}", response_model=CardOut)
async def update_card(
    card_id: uuid.UUID,
    payload: CardUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(card, field, value)
    return card


@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    await db.delete(card)


@router.get("/{card_id}/utilization")
async def card_utilization(
    card_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
    )
    card = result.scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    utilization = float(card.current_outstanding / card.credit_limit * 100) if card.credit_limit else 0
    return {
        "card_id": card_id,
        "credit_limit": float(card.credit_limit),
        "current_outstanding": float(card.current_outstanding),
        "available_limit": float(card.available_limit),
        "utilization_pct": round(utilization, 2),
        "status": "GOOD" if utilization < 30 else "WARNING" if utilization < 70 else "CRITICAL",
    }
