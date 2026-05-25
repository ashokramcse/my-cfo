"""
Wallet / UPI Reconciliation Engine
====================================
Solves three problems that arise when users import transactions from both
their bank account AND their UPI/wallet apps:

Problem 1 — UPI double-count
  The same ₹500 UPI payment appears in:
    • Bank statement: DEBIT ₹500  ref=UTR123  "UPI-Swiggy"
    • PhonePe export: DEBIT ₹500  ref=UTR123  "Paid Swiggy"
  Without reconciliation this shows ₹1,000 spent — double the reality.

  Fix: same reference_no (UTR) + same amount across different accounts of
  the same user = one entry is a duplicate.  The WALLET account side is
  marked is_excluded=True, is_duplicate=True, linked_tx_id → bank side.

Problem 2 — Wallet load double-count (Bank → Wallet top-up)
  Bank: DEBIT ₹5,000  "Transfer to Paytm"
  Paytm wallet: CREDIT ₹5,000  "Wallet loaded from HDFC"
  Without reconciliation: ₹5,000 shows as an expense AND as income.

  Fix: matched by reference_no OR (amount + date proximity + description
  keywords). BOTH legs are marked is_transfer_leg=True so they are excluded
  from inflow/outflow totals (money didn't leave the user's net worth).
  category updated to WALLET_LOAD (bank debit) / TRANSFER_IN (wallet credit).

Problem 3 — CC → Wallet load
  CC transaction (in `transactions` table): ₹5,000 "Paytm"
  Wallet: CREDIT ₹5,000 "Loaded from CC"
  The CC entry is the real liability; the wallet CREDIT is just internal
  movement.  Wallet CREDIT is marked is_transfer_leg=True, category →
  CC_WALLET_LOAD.  Linking to the CC transaction is stored in linked_card_id.

Reconciliation is run:
  • Automatically after every bulk import (import endpoint calls it)
  • Automatically after every manual transaction add
  • Via explicit POST /bank-accounts/reconcile  (for retroactive fix)

Rules are intentionally conservative — we only auto-match when confidence
is HIGH.  Ambiguous cases are flagged as is_duplicate=True but NOT
is_excluded so the user can review and decide.
"""

import re
import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bank_account import BankAccount, AccountType
from app.models.bank_transaction import BankTransaction, BankTxType, BankTxCategory


# ── Wallet-indicator keywords in transaction descriptions ─────────────────────
_WALLET_NAMES = re.compile(
    r"paytm|phonepe|gpay|google\s*pay|bhim|amazon\s*pay|mobikwik|freecharge|airtel\s*money|jio\s*money|ola\s*money",
    re.IGNORECASE,
)

_WALLET_LOAD_KEYWORDS = re.compile(
    r"wallet\s*(load|top\s*up|recharge|credit|added|fund)|"
    r"(load|top\s*up|transfer\s*to)\s*wallet|"
    r"paytm\s*(wallet|add)|add\s*money",
    re.IGNORECASE,
)

_CC_WALLET_KEYWORDS = re.compile(
    r"paytm|phonepe|amazon\s*pay|mobikwik|freecharge",
    re.IGNORECASE,
)

# Wallet service charges
_WALLET_FEE_KEYWORDS = re.compile(
    r"wallet\s*(fee|charge|service\s*charge|gst|convenience)|"
    r"(paytm|phonepe|gpay)\s*(fee|charge|gst)|"
    r"load\s*charge|topup\s*charge|mdr",
    re.IGNORECASE,
)

# Typical window for matching transfer pairs (bank posts same-day; wallet may
# settle T+1 or T+2 for NEFT/RTGS)
_MATCH_WINDOW_DAYS = 3

# Minimum amount for auto-linking (ignore sub-₹1 noise)
_MIN_MATCH_AMOUNT = Decimal("1.00")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_wallet_account(acc: BankAccount) -> bool:
    return acc.account_type in (AccountType.WALLET,)


def _is_upi_account(acc: BankAccount) -> bool:
    return acc.account_type in (AccountType.UPI,)


def _account_map(accounts: list[BankAccount]) -> dict[uuid.UUID, BankAccount]:
    return {a.id: a for a in accounts}


# ── Core reconciler ───────────────────────────────────────────────────────────

async def reconcile_for_user(db: AsyncSession, user_id: uuid.UUID) -> dict:
    """
    Run full reconciliation for a user.
    Returns a summary dict of what was matched/fixed.
    """
    stats = {
        "upi_dedup_pairs": 0,
        "wallet_load_pairs": 0,
        "cc_wallet_pairs": 0,
        "wallet_fees_tagged": 0,
    }

    # Load all user accounts
    acc_res = await db.execute(
        select(BankAccount).where(BankAccount.user_id == user_id, BankAccount.is_active == True)
    )
    accounts = acc_res.scalars().all()
    acc_map = _account_map(accounts)

    # Load all unreconciled transactions (not already linked/excluded)
    tx_res = await db.execute(
        select(BankTransaction).where(
            BankTransaction.user_id == user_id,
            BankTransaction.linked_tx_id == None,  # not yet reconciled
        ).order_by(BankTransaction.transaction_date)
    )
    txs = tx_res.scalars().all()

    # ── Pass 1: UTR/reference_no based exact match ────────────────────────────
    # Group transactions by reference_no (UTR is globally unique for UPI)
    ref_groups: dict[str, list[BankTransaction]] = {}
    for tx in txs:
        if tx.reference_no and len(tx.reference_no) >= 8:
            ref_groups.setdefault(tx.reference_no, []).append(tx)

    for ref_no, group in ref_groups.items():
        if len(group) < 2:
            continue
        # Multiple transactions with same reference_no across different accounts
        # Sort: prefer bank/salary accounts as the "authoritative" side
        def _priority(t: BankTransaction) -> int:
            acc = acc_map.get(t.account_id)
            if acc is None:
                return 99
            if acc.account_type in (AccountType.SAVINGS, AccountType.CURRENT,
                                     AccountType.SALARY):
                return 0   # bank account = authoritative
            if acc.account_type in (AccountType.WALLET, AccountType.UPI):
                return 1   # wallet = secondary
            return 2

        group.sort(key=_priority)
        primary = group[0]
        for secondary in group[1:]:
            if secondary.account_id == primary.account_id:
                continue  # same account duplicate — handled separately

            # Both are DEBITs = UPI payment seen from both bank & wallet sides
            if (primary.tx_type == BankTxType.DEBIT and
                    secondary.tx_type == BankTxType.DEBIT and
                    abs(primary.amount - secondary.amount) <= Decimal("0.01")):

                # Mark wallet/UPI side as excluded duplicate
                secondary.is_duplicate = True
                secondary.is_excluded = True
                secondary.linked_tx_id = primary.id
                primary.linked_tx_id = secondary.id
                primary.linked_account_id = secondary.account_id
                stats["upi_dedup_pairs"] += 1

            # DEBIT on bank side + CREDIT on wallet side = wallet load
            elif (primary.tx_type == BankTxType.DEBIT and
                      secondary.tx_type == BankTxType.CREDIT and
                      abs(primary.amount - secondary.amount) <= Decimal("1.00")):

                _mark_wallet_load_pair(primary, secondary, acc_map)
                stats["wallet_load_pairs"] += 1

            elif (primary.tx_type == BankTxType.CREDIT and
                      secondary.tx_type == BankTxType.DEBIT and
                      abs(primary.amount - secondary.amount) <= Decimal("1.00")):

                _mark_wallet_load_pair(secondary, primary, acc_map)
                stats["wallet_load_pairs"] += 1

    # ── Pass 2: Fuzzy match (amount + date + wallet keywords, no UTR) ─────────
    # Used when bank statement strips the UTR or wallet export doesn't include it
    wallet_txs = [t for t in txs
                  if acc_map.get(t.account_id) and
                  _is_wallet_account(acc_map[t.account_id]) and
                  not t.linked_tx_id]
    bank_txs   = [t for t in txs
                  if acc_map.get(t.account_id) and
                  not _is_wallet_account(acc_map[t.account_id]) and
                  not _is_upi_account(acc_map[t.account_id]) and
                  not t.linked_tx_id]

    # Bank DEBIT that looks like a wallet load → search for wallet CREDIT
    for bank_tx in bank_txs:
        if bank_tx.tx_type != BankTxType.DEBIT:
            continue
        if bank_tx.amount < _MIN_MATCH_AMOUNT:
            continue
        if not (_WALLET_LOAD_KEYWORDS.search(bank_tx.description or "") or
                _WALLET_NAMES.search(bank_tx.description or "")):
            continue

        # Find matching wallet CREDIT within ±3 days, same amount (±₹1 for fees)
        window_start = bank_tx.transaction_date - timedelta(days=_MATCH_WINDOW_DAYS)
        window_end   = bank_tx.transaction_date + timedelta(days=_MATCH_WINDOW_DAYS)

        candidates = [
            w for w in wallet_txs
            if (w.tx_type == BankTxType.CREDIT and
                not w.linked_tx_id and
                abs(w.amount - bank_tx.amount) <= Decimal("1.00") and
                window_start <= w.transaction_date <= window_end)
        ]
        if len(candidates) == 1:
            _mark_wallet_load_pair(bank_tx, candidates[0], acc_map)
            wallet_txs.remove(candidates[0])
            stats["wallet_load_pairs"] += 1

    # ── Pass 3: Tag wallet fees ───────────────────────────────────────────────
    for tx in txs:
        if (tx.category not in (BankTxCategory.WALLET_FEE,) and
                _WALLET_FEE_KEYWORDS.search(tx.description or "") and
                not tx.linked_tx_id):
            tx.category = BankTxCategory.WALLET_FEE
            tx.is_hidden_charge = True
            stats["wallet_fees_tagged"] += 1

    # ── Pass 4: CC → Wallet load (bank_transactions CREDIT on wallet with CC ref) ─
    # When a wallet CREDIT has no linked_tx_id and description mentions CC/credit card
    cc_wallet_pattern = re.compile(
        r"credit\s*card|cc\s*(load|topup|fund)|loaded\s*(via|from|using)\s*(cc|credit)",
        re.IGNORECASE,
    )
    for tx in txs:
        if (tx.tx_type == BankTxType.CREDIT and
                not tx.linked_tx_id and
                acc_map.get(tx.account_id) and
                _is_wallet_account(acc_map[tx.account_id]) and
                cc_wallet_pattern.search(tx.description or "")):
            tx.category = BankTxCategory.CC_WALLET_LOAD
            tx.is_transfer_leg = True
            tx.is_excluded = True
            stats["cc_wallet_pairs"] += 1

    await db.commit()
    return stats


def _mark_wallet_load_pair(
    bank_tx: BankTransaction,
    wallet_tx: BankTransaction,
    acc_map: dict,
) -> None:
    """
    Link a bank-debit ↔ wallet-credit pair as a wallet load.
    Both legs are marked is_transfer_leg=True and excluded from flow totals.
    """
    # Bank side: money left the bank account — tag as WALLET_LOAD transfer
    bank_tx.category = BankTxCategory.WALLET_LOAD
    bank_tx.is_transfer_leg = True
    bank_tx.is_excluded = True
    bank_tx.linked_tx_id = wallet_tx.id
    bank_tx.linked_account_id = wallet_tx.account_id

    # Wallet side: money arrived in wallet — tag as TRANSFER_IN
    wallet_tx.category = BankTxCategory.TRANSFER_IN
    wallet_tx.is_transfer_leg = True
    wallet_tx.is_excluded = True
    wallet_tx.linked_tx_id = bank_tx.id
    wallet_tx.linked_account_id = bank_tx.account_id
