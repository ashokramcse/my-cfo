"""
financial_linking.py — Smart linking between bank transactions and CC/Loan entities.

Covers:
1. link_bank_tx_to_loan()     — Mark a bank CREDIT as a loan disbursement (borrowed money)
2. link_bank_tx_to_cc()       — Mark a bank DEBIT as a CC bill payment
3. split_loan_repayment()     — Calculate principal vs interest split for a repayment DEBIT
4. auto_detect_cc_payments()  — Scan recent DEBITs to auto-link to CC outstanding
"""

from decimal import Decimal
from datetime import datetime, timedelta, timezone
from uuid import UUID
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_transaction import BankTransaction, BankTxCategory, BankTxType
from app.models.bank_account import BankAccount
from app.models.loan import Loan, LoanStatus
from app.models.card import CreditCard


# ─────────────────────────────────────────────────────────────────────────────
# 1. Loan disbursement: mark a CREDIT as borrowed money
# ─────────────────────────────────────────────────────────────────────────────

async def link_bank_tx_to_loan_disbursement(
    db: AsyncSession,
    user_id: UUID,
    bank_tx_id: UUID,
    loan_id: UUID,
) -> BankTransaction:
    """
    Mark a bank CREDIT transaction as a loan disbursement.
    - Sets is_loan_disbursement=True and category=LOAN_DISBURSEMENT
    - Links to the loan record (linked_loan_id)
    - The CREDIT will be excluded from income calculations in reports

    This prevents borrowed money (e.g. friend sends ₹50,000 to your account)
    from inflating income / net worth. The matching Loan liability records the
    offsetting debt, keeping net worth neutral on receipt.
    """
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.id == bank_tx_id,
            BankTransaction.user_id == user_id,
        )
    )
    tx = tx_res.scalar_one_or_none()
    if not tx:
        raise ValueError(f"Bank transaction {bank_tx_id} not found")

    if tx.tx_type not in (BankTxType.CREDIT, BankTxType.TRANSFER_IN):
        raise ValueError("Only CREDIT/TRANSFER_IN transactions can be marked as loan disbursements")

    loan_res = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id)
    )
    loan = loan_res.scalar_one_or_none()
    if not loan:
        raise ValueError(f"Loan {loan_id} not found")

    tx.is_loan_disbursement = True
    tx.linked_loan_id = loan_id
    tx.category = BankTxCategory.LOAN_DISBURSEMENT
    tx.is_transfer_leg = True  # exclude from income totals

    await db.commit()
    await db.refresh(tx)
    return tx


async def unlink_bank_tx_from_loan_disbursement(
    db: AsyncSession,
    user_id: UUID,
    bank_tx_id: UUID,
) -> BankTransaction:
    """Remove loan disbursement tag from a bank transaction."""
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.id == bank_tx_id,
            BankTransaction.user_id == user_id,
        )
    )
    tx = tx_res.scalar_one_or_none()
    if not tx:
        raise ValueError(f"Bank transaction {bank_tx_id} not found")

    tx.is_loan_disbursement = False
    tx.linked_loan_id = None
    tx.category = BankTxCategory.OTHER
    tx.is_transfer_leg = False

    await db.commit()
    await db.refresh(tx)
    return tx


# ─────────────────────────────────────────────────────────────────────────────
# 2. Loan repayment: link DEBIT + calculate principal/interest split
# ─────────────────────────────────────────────────────────────────────────────

async def link_bank_tx_to_loan_repayment(
    db: AsyncSession,
    user_id: UUID,
    bank_tx_id: UUID,
    loan_id: UUID,
    interest_amount: Optional[Decimal] = None,
) -> dict:
    """
    Mark a bank DEBIT as a loan repayment.

    If interest_amount is provided, it is stored on the transaction.
    The principal portion = tx.amount - interest_amount.

    - Updates loan.outstanding_balance by deducting principal portion
    - Updates loan.total_paid / total_interest_paid
    - Sets category=LOAN_REPAYMENT, linked_loan_id on the bank transaction
    """
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.id == bank_tx_id,
            BankTransaction.user_id == user_id,
        )
    )
    tx = tx_res.scalar_one_or_none()
    if not tx:
        raise ValueError(f"Bank transaction {bank_tx_id} not found")

    if tx.tx_type not in (BankTxType.DEBIT, BankTxType.TRANSFER_OUT):
        raise ValueError("Only DEBIT/TRANSFER_OUT transactions can be loan repayments")

    loan_res = await db.execute(
        select(Loan).where(Loan.id == loan_id, Loan.user_id == user_id)
    )
    loan = loan_res.scalar_one_or_none()
    if not loan:
        raise ValueError(f"Loan {loan_id} not found")

    repayment_total = tx.amount
    if interest_amount is None:
        # Auto-calculate interest based on loan rate and outstanding
        # Simple approximation: monthly_interest = outstanding * rate / 12 / 100
        monthly_interest = (
            (loan.outstanding_balance or Decimal(0))
            * (loan.interest_rate or Decimal(0))
            / Decimal("12")
            / Decimal("100")
        )
        interest_amount = min(monthly_interest.quantize(Decimal("0.01")), repayment_total)

    principal_portion = max(Decimal(0), repayment_total - interest_amount)

    # Update transaction
    tx.linked_loan_id = loan_id
    tx.category = BankTxCategory.LOAN_REPAYMENT
    tx.interest_amount = interest_amount

    # Update loan balances
    loan.outstanding_balance = max(
        Decimal(0),
        (loan.outstanding_balance or Decimal(0)) - principal_portion,
    )
    loan.total_paid = (loan.total_paid or Decimal(0)) + principal_portion
    loan.total_interest_paid = (loan.total_interest_paid or Decimal(0)) + interest_amount

    # Close loan if fully repaid
    if loan.outstanding_balance <= Decimal(0):
        from app.models.loan import LoanStatus
        loan.status = LoanStatus.CLOSED

    await db.commit()
    await db.refresh(tx)

    return {
        "bank_transaction": tx,
        "principal_paid": principal_portion,
        "interest_paid": interest_amount,
        "loan_outstanding": loan.outstanding_balance,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 3. CC payment: link bank DEBIT to credit card
# ─────────────────────────────────────────────────────────────────────────────

async def link_bank_tx_to_cc_payment(
    db: AsyncSession,
    user_id: UUID,
    bank_tx_id: UUID,
    card_id: UUID,
) -> BankTransaction:
    """
    Mark a bank DEBIT as a credit card bill payment.
    - Sets category=CC_PAYMENT, linked_card_id, is_transfer_leg=True
    - Reduces card.current_outstanding by the payment amount
    - Excludes from expense calculations (it's a liability settlement)
    """
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.id == bank_tx_id,
            BankTransaction.user_id == user_id,
        )
    )
    tx = tx_res.scalar_one_or_none()
    if not tx:
        raise ValueError(f"Bank transaction {bank_tx_id} not found")

    if tx.tx_type not in (BankTxType.DEBIT, BankTxType.TRANSFER_OUT):
        raise ValueError("Only DEBIT/TRANSFER_OUT transactions can be CC payments")

    card_res = await db.execute(
        select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == user_id)
    )
    card = card_res.scalar_one_or_none()
    if not card:
        raise ValueError(f"Credit card {card_id} not found")

    payment = tx.amount

    # Only update card outstanding if not already linked to this card
    if tx.linked_card_id != card_id:
        card.current_outstanding = max(
            Decimal(0),
            (card.current_outstanding or Decimal(0)) - payment,
        )
        card.available_limit = min(
            card.credit_limit or Decimal(0),
            (card.available_limit or Decimal(0)) + payment,
        )

    tx.linked_card_id = card_id
    tx.category = BankTxCategory.CC_PAYMENT
    tx.is_transfer_leg = True  # exclude from bank expense totals

    await db.commit()
    await db.refresh(tx)
    return tx


async def unlink_bank_tx_from_cc_payment(
    db: AsyncSession,
    user_id: UUID,
    bank_tx_id: UUID,
) -> BankTransaction:
    """Remove CC payment link from a bank transaction (reverses card balance)."""
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.id == bank_tx_id,
            BankTransaction.user_id == user_id,
        )
    )
    tx = tx_res.scalar_one_or_none()
    if not tx:
        raise ValueError(f"Bank transaction {bank_tx_id} not found")

    if tx.linked_card_id:
        card_res = await db.execute(
            select(CreditCard).where(CreditCard.id == tx.linked_card_id, CreditCard.user_id == user_id)
        )
        card = card_res.scalar_one_or_none()
        if card:
            # Reverse the payment
            card.current_outstanding = (card.current_outstanding or Decimal(0)) + tx.amount
            card.available_limit = max(
                Decimal(0),
                (card.available_limit or Decimal(0)) - tx.amount,
            )

    tx.linked_card_id = None
    tx.category = BankTxCategory.OTHER
    tx.is_transfer_leg = False

    await db.commit()
    await db.refresh(tx)
    return tx


# ─────────────────────────────────────────────────────────────────────────────
# 4. Auto-detect CC payments from recent bank DEBITs
# ─────────────────────────────────────────────────────────────────────────────

_CC_PAYMENT_KEYWORDS = {
    "credit card", "creditcard", "cc payment", "card payment",
    "bill payment", "billpayment", "autopay", "auto pay",
    "hdfc cc", "icici cc", "sbi cc", "axis cc", "amex cc",
    "hdfc credit", "icici credit", "sbi credit", "axis credit",
    "kotak cc", "kotak credit", "onecard", "one card",
}

_AMOUNT_TOLERANCE = Decimal("50")  # ±₹50 for CC outstanding match
_DATE_WINDOW_DAYS = 5              # look back 5 days for matching DEBITs


async def auto_detect_cc_payments(
    db: AsyncSession,
    user_id: UUID,
    lookback_days: int = 60,
) -> list[dict]:
    """
    Scan recent unlinked bank DEBITs for probable CC payment patterns.

    Returns a list of suggestions (NOT committed); caller can review and
    call link_bank_tx_to_cc_payment() to confirm each one.

    Detection heuristics:
    1. Description contains known CC payment keywords
    2. Amount is within ±₹50 of a card's current_outstanding
    """
    from datetime import date as _date

    cutoff = datetime.now(timezone.utc) - timedelta(days=lookback_days)

    # Fetch unlinked DEBITs in the lookback window
    debits_res = await db.execute(
        select(BankTransaction).where(
            and_(
                BankTransaction.user_id == user_id,
                BankTransaction.tx_type.in_([BankTxType.DEBIT, BankTxType.TRANSFER_OUT]),
                BankTransaction.linked_card_id.is_(None),
                BankTransaction.is_transfer_leg == False,
                BankTransaction.transaction_date >= cutoff,
            )
        ).order_by(BankTransaction.transaction_date.desc())
    )
    debits = debits_res.scalars().all()

    # Fetch user's active credit cards
    cards_res = await db.execute(
        select(CreditCard).where(
            CreditCard.user_id == user_id,
            CreditCard.is_active == True,
        )
    )
    cards = cards_res.scalars().all()

    suggestions = []

    for tx in debits:
        desc_lower = (tx.description or "").lower()
        keyword_match = any(kw in desc_lower for kw in _CC_PAYMENT_KEYWORDS)

        for card in cards:
            outstanding = card.current_outstanding or Decimal(0)
            if outstanding <= 0:
                continue

            amount_match = abs(tx.amount - outstanding) <= _AMOUNT_TOLERANCE

            if keyword_match or amount_match:
                confidence = "HIGH" if (keyword_match and amount_match) else "MEDIUM"
                suggestions.append({
                    "bank_tx_id": str(tx.id),
                    "bank_tx_date": tx.transaction_date.isoformat(),
                    "bank_tx_amount": float(tx.amount),
                    "bank_tx_description": tx.description,
                    "card_id": str(card.id),
                    "card_name": card.card_name or card.bank_name,
                    "card_outstanding": float(outstanding),
                    "confidence": confidence,
                    "keyword_match": keyword_match,
                    "amount_match": amount_match,
                })
                break  # one suggestion per DEBIT

    return suggestions
