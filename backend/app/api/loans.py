from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.loan import Loan
from app.schemas.loan import LoanCreate, LoanUpdate, LoanOut

router = APIRouter()


@router.get("", response_model=List[LoanOut])
async def list_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan)
        .where(Loan.user_id == current_user.id)
        .order_by(Loan.outstanding_balance.desc())
    )
    return result.scalars().all()


@router.post("", response_model=LoanOut)
async def create_loan(
    data: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    loan = Loan(user_id=current_user.id, **data.model_dump())
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.patch("/{loan_id}", response_model=LoanOut)
async def update_loan(
    loan_id: uuid.UUID,
    data: LoanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(loan, field, value)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.delete("/{loan_id}")
async def delete_loan(
    loan_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == current_user.id)
    )
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    await db.delete(loan)
    await db.commit()
    return {"ok": True}


@router.get("/analytics/summary")
async def loan_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Loan).where(Loan.user_id == current_user.id)
    )
    loans = result.scalars().all()

    active = [l for l in loans if l.status == "ACTIVE"]
    total_outstanding = sum(float(l.outstanding_balance or 0) for l in active)
    total_emi = sum(float(l.emi_amount or 0) for l in active)
    total_principal = sum(float(l.principal_amount or 0) for l in loans)
    total_paid = sum(float(l.total_paid or 0) for l in loans)

    return {
        "total_outstanding": total_outstanding,
        "total_monthly_emi": total_emi,
        "total_principal": total_principal,
        "total_paid": total_paid,
        "active_count": len(active),
        "total_count": len(loans),
    }
