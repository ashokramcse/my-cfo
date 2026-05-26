"""
financial_linking.py — API endpoints for smart financial linking.

Endpoints:
  POST /financial-linking/loan-disbursement     — mark bank CREDIT as borrowed money
  DELETE /financial-linking/loan-disbursement/{tx_id}  — unlink
  POST /financial-linking/loan-repayment        — mark bank DEBIT as loan repayment + interest split
  POST /financial-linking/cc-payment            — mark bank DEBIT as CC bill payment
  DELETE /financial-linking/cc-payment/{tx_id} — unlink
  GET  /financial-linking/cc-payment/suggestions — auto-detect probable CC payments
  GET  /financial-linking/cash-accounts         — list CASH-type accounts
"""

import uuid
from decimal import Decimal
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.bank_account import BankAccount, AccountType
from app.models.bank_transaction import BankTransaction, BankTxType, BankTxCategory
from app.services.financial_linking import (
    link_bank_tx_to_loan_disbursement,
    unlink_bank_tx_from_loan_disbursement,
    link_bank_tx_to_loan_repayment,
    link_bank_tx_to_cc_payment,
    unlink_bank_tx_from_cc_payment,
    auto_detect_cc_payments,
)

router = APIRouter(prefix="/financial-linking", tags=["financial-linking"])


# ─── Schemas ─────────────────────────────────────────────────────────────────

class LoanDisbursementIn(BaseModel):
    bank_tx_id: uuid.UUID
    loan_id: uuid.UUID


class LoanRepaymentIn(BaseModel):
    bank_tx_id: uuid.UUID
    loan_id: uuid.UUID
    interest_amount: Optional[Decimal] = Field(None, ge=0)


class CCPaymentIn(BaseModel):
    bank_tx_id: uuid.UUID
    card_id: uuid.UUID


def _tx_out(tx: BankTransaction) -> dict:
    return {
        "id": str(tx.id),
        "account_id": str(tx.account_id),
        "transaction_date": tx.transaction_date.isoformat(),
        "description": tx.description,
        "amount": float(tx.amount),
        "tx_type": tx.tx_type,
        "category": tx.category,
        "linked_loan_id": str(tx.linked_loan_id) if tx.linked_loan_id else None,
        "linked_card_id": str(tx.linked_card_id) if tx.linked_card_id else None,
        "is_loan_disbursement": tx.is_loan_disbursement,
        "interest_amount": float(tx.interest_amount or 0),
        "is_transfer_leg": tx.is_transfer_leg,
    }


# ─── Loan Disbursement ───────────────────────────────────────────────────────

@router.post("/loan-disbursement")
async def mark_loan_disbursement(
    data: LoanDisbursementIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a bank CREDIT as borrowed money (loan disbursement received)."""
    try:
        tx = await link_bank_tx_to_loan_disbursement(
            db, current_user.id, data.bank_tx_id, data.loan_id
        )
        return {"status": "linked", "transaction": _tx_out(tx)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/loan-disbursement/{bank_tx_id}")
async def unmark_loan_disbursement(
    bank_tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove the loan disbursement tag from a bank transaction."""
    try:
        tx = await unlink_bank_tx_from_loan_disbursement(db, current_user.id, bank_tx_id)
        return {"status": "unlinked", "transaction": _tx_out(tx)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Loan Repayment ──────────────────────────────────────────────────────────

@router.post("/loan-repayment")
async def mark_loan_repayment(
    data: LoanRepaymentIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Link a bank DEBIT to a loan as a repayment.
    Optionally specify interest_amount; if omitted, it is auto-calculated.
    Returns principal/interest split + updated loan outstanding.
    """
    try:
        result = await link_bank_tx_to_loan_repayment(
            db, current_user.id, data.bank_tx_id, data.loan_id, data.interest_amount
        )
        return {
            "status": "linked",
            "transaction": _tx_out(result["bank_transaction"]),
            "principal_paid": float(result["principal_paid"]),
            "interest_paid": float(result["interest_paid"]),
            "loan_outstanding_after": float(result["loan_outstanding"]),
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── CC Payment ──────────────────────────────────────────────────────────────

@router.post("/cc-payment")
async def mark_cc_payment(
    data: CCPaymentIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a bank DEBIT as a credit card bill payment."""
    try:
        tx = await link_bank_tx_to_cc_payment(db, current_user.id, data.bank_tx_id, data.card_id)
        return {"status": "linked", "transaction": _tx_out(tx)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/cc-payment/{bank_tx_id}")
async def unmark_cc_payment(
    bank_tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove CC payment link from a bank transaction (reverses card balance)."""
    try:
        tx = await unlink_bank_tx_from_cc_payment(db, current_user.id, bank_tx_id)
        return {"status": "unlinked", "transaction": _tx_out(tx)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cc-payment/suggestions")
async def get_cc_payment_suggestions(
    lookback_days: int = 60,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scan recent bank DEBITs for probable CC bill payments.
    Returns suggestions with confidence (HIGH/MEDIUM) for user confirmation.
    """
    suggestions = await auto_detect_cc_payments(db, current_user.id, lookback_days)
    return {"suggestions": suggestions, "count": len(suggestions)}


# ─── Cash Accounts ───────────────────────────────────────────────────────────

@router.get("/cash-accounts")
async def list_cash_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all CASH-type accounts for the user."""
    res = await db.execute(
        select(BankAccount).where(
            BankAccount.user_id == current_user.id,
            BankAccount.account_type == AccountType.CASH,
            BankAccount.is_active == True,
        )
    )
    accounts = res.scalars().all()
    return {
        "accounts": [
            {
                "id": str(a.id),
                "nickname": a.nickname,
                "current_balance": float(a.current_balance or 0),
                "account_color": a.account_color,
                "notes": a.notes,
            }
            for a in accounts
        ]
    }


@router.post("/cash-accounts")
async def create_cash_account(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a virtual Cash account (type=CASH).
    Cash accounts track physical cash: ATM withdrawals, cash received, cash expenses.
    """
    nickname = data.get("nickname", "Cash Wallet")
    initial_balance = Decimal(str(data.get("initial_balance", 0)))
    color = data.get("account_color", "#F59E0B")
    notes = data.get("notes", "")

    account = BankAccount(
        user_id=current_user.id,
        nickname=nickname,
        bank_name="Cash",
        account_type=AccountType.CASH,
        current_balance=initial_balance,
        account_color=color,
        notes=notes,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    return {
        "id": str(account.id),
        "nickname": account.nickname,
        "current_balance": float(account.current_balance or 0),
        "account_color": account.account_color,
        "notes": account.notes,
    }


# ─── Batch summary: pending actions for a user ───────────────────────────────

@router.get("/pending-actions")
async def get_pending_actions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns a summary of suggested linking actions:
    - CC payment suggestions (auto-detected)
    - Large CREDIT transactions not yet tagged as income or loan disbursement
    """
    from datetime import date as _date
    from sqlalchemy import and_

    # CC payment suggestions
    cc_suggestions = await auto_detect_cc_payments(db, current_user.id, lookback_days=60)

    # Large untagged CREDITs (> ₹10,000) in last 90 days that look like they could be loans
    cutoff = __import__("datetime").datetime.now(__import__("datetime").timezone.utc) - \
             __import__("datetime").timedelta(days=90)
    large_credits_res = await db.execute(
        select(BankTransaction).where(
            and_(
                BankTransaction.user_id == current_user.id,
                BankTransaction.tx_type == BankTxType.CREDIT,
                BankTransaction.amount >= Decimal("10000"),
                BankTransaction.is_loan_disbursement == False,
                BankTransaction.is_transfer_leg == False,
                BankTransaction.category.notin_([
                    BankTxCategory.SALARY,
                    BankTxCategory.BUSINESS_INCOME,
                    BankTxCategory.LOAN_DISBURSEMENT,
                ]),
                BankTransaction.transaction_date >= cutoff,
            )
        ).order_by(BankTransaction.amount.desc()).limit(10)
    )
    large_credits = large_credits_res.scalars().all()

    return {
        "cc_payment_suggestions": cc_suggestions,
        "cc_payment_count": len(cc_suggestions),
        "untagged_large_credits": [
            {
                "id": str(tx.id),
                "date": tx.transaction_date.isoformat(),
                "amount": float(tx.amount),
                "description": tx.description,
                "category": tx.category,
                "message": "This large credit might be borrowed money. Is it a loan received?",
            }
            for tx in large_credits
        ],
        "untagged_large_credits_count": len(large_credits),
    }
