"""
Banking & Cash Flow Intelligence Engine
────────────────────────────────────────
Endpoints:
  GET  /bank-accounts                      — list accounts
  POST /bank-accounts                      — create account
  PATCH /bank-accounts/{id}                — update (balance, color, etc.)
  DELETE /bank-accounts/{id}               — delete
  PATCH /bank-accounts/{id}/balance        — quick balance update + snapshot
  GET  /bank-accounts/analytics/cashflow   — Cash Flow Command Center payload
  GET  /bank-accounts/{id}/transactions    — transactions for one account
  POST /bank-accounts/{id}/transactions    — add manual transaction
  POST /bank-accounts/{id}/transactions/import — CSV/JSON bulk import
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from sqlalchemy.orm import selectinload
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timezone, timedelta
import uuid

from app.database import get_db
from app.utils.deps import get_current_user
from app.utils.enum_utils import ev
from app.models.user import User
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction, BankTxType, BankTxCategory, INCOME_CATEGORIES
from app.models.card import CreditCard
from app.models.emi import EMI, EMIStatus
from app.models.loan import Loan
from app.schemas.bank_account import BankAccountCreate, BankAccountUpdate, BankAccountOut

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _fmt(v: float) -> str:
    if v >= 1_00_00_000: return f"₹{v/1_00_00_000:.1f}Cr"
    if v >= 1_00_000:    return f"₹{v/1_00_000:.1f}L"
    if v >= 1_000:       return f"₹{v/1_000:.0f}K"
    return f"₹{int(v)}"


def _month_key(dt: datetime) -> str:
    return dt.strftime("%b %y")


HIDDEN_CHARGE_KEYWORDS = [
    "sms charge", "sms alert", "maintenance charge", "annual fee",
    "folio maintenance", "demat amc", "locker rent", "non-maintenance",
    "ecs return", "bounce charge", "cheque return", "cash handling",
    "account maintenance", "minimum balance", "below minimum",
]


def _is_hidden_charge(desc: str) -> bool:
    desc_lower = desc.lower()
    return any(kw in desc_lower for kw in HIDDEN_CHARGE_KEYWORDS)


# ─── Account CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=List[BankAccountOut])
async def list_bank_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BankAccount)
        .where(BankAccount.user_id == current_user.id)
        .order_by(BankAccount.is_primary.desc(), BankAccount.created_at)
    )
    return result.scalars().all()


@router.post("", response_model=BankAccountOut)
async def create_bank_account(
    data: BankAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    account = BankAccount(user_id=current_user.id, **data.model_dump())
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=BankAccountOut)
async def get_bank_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BankAccount).where(
            BankAccount.id == account_id,
            BankAccount.user_id == current_user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Bank account not found")
    return account


@router.patch("/{account_id}", response_model=BankAccountOut)
async def update_bank_account(
    account_id: uuid.UUID,
    data: BankAccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.commit()
    await db.refresh(account)
    return account


@router.patch("/{account_id}/balance")
async def update_balance(
    account_id: uuid.UUID,
    balance: Decimal,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick balance update — logs a synthetic adjustment transaction."""
    result = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    old_balance = float(account.current_balance or 0)
    new_balance = float(balance)
    diff = new_balance - old_balance

    # Log adjustment transaction
    if diff != 0:
        tx = BankTransaction(
            user_id         = current_user.id,
            account_id      = account_id,
            transaction_date = datetime.now(timezone.utc),
            description     = notes or "Manual balance adjustment",
            amount          = Decimal(str(abs(diff))),
            tx_type         = BankTxType.CREDIT if diff > 0 else BankTxType.DEBIT,
            category        = BankTxCategory.OTHER,
            balance_after   = balance,
            import_source   = "MANUAL",
        )
        db.add(tx)

    account.current_balance = balance
    await db.commit()
    await db.refresh(account)
    return {"ok": True, "balance": float(balance), "change": diff}


@router.delete("/{account_id}")
async def delete_bank_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    await db.delete(account)
    await db.commit()
    return {"ok": True}


# ─── Transactions ─────────────────────────────────────────────────────────────

@router.get("/{account_id}/transactions")
async def list_transactions(
    account_id: uuid.UUID,
    page: int = 1,
    page_size: int = 50,
    category: Optional[str] = None,
    tx_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filters = [
        BankTransaction.account_id == account_id,
        BankTransaction.user_id    == current_user.id,
        BankTransaction.is_excluded == False,
    ]
    if category: filters.append(BankTransaction.category == category)
    if tx_type:  filters.append(BankTransaction.tx_type  == tx_type)

    total_res = await db.execute(select(func.count()).where(*filters))
    total = total_res.scalar() or 0

    txs_res = await db.execute(
        select(BankTransaction)
        .where(*filters)
        .order_by(BankTransaction.transaction_date.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    txs = txs_res.scalars().all()

    return {
        "items": [_tx_out(t) for t in txs],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/{account_id}/transactions")
async def add_transaction(
    account_id: uuid.UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify account ownership
    acc_res = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == current_user.id)
    )
    account = acc_res.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    amount      = Decimal(str(data.get("amount", 0)))
    tx_type     = data.get("tx_type", "DEBIT")
    description = data.get("description", "")
    category    = data.get("category", "OTHER")
    tx_date     = datetime.fromisoformat(data["transaction_date"]) if "transaction_date" in data else datetime.now(timezone.utc)

    is_hidden   = _is_hidden_charge(description)

    tx = BankTransaction(
        user_id          = current_user.id,
        account_id       = account_id,
        transaction_date = tx_date,
        description      = description,
        amount           = amount,
        tx_type          = tx_type,
        category         = category,
        merchant_name    = data.get("merchant_name"),
        reference_no     = data.get("reference_no"),
        is_hidden_charge = is_hidden,
        import_source    = "MANUAL",
    )
    db.add(tx)

    # Update account balance based on direction of transaction
    credit_types = {BankTxType.CREDIT, BankTxType.TRANSFER_IN}
    debit_types  = {BankTxType.DEBIT,  BankTxType.TRANSFER_OUT}
    try:
        tx_type_enum = BankTxType(tx_type)
    except ValueError:
        tx_type_enum = None
    if tx_type_enum in credit_types:
        account.current_balance = (account.current_balance or Decimal(0)) + amount
    elif tx_type_enum in debit_types:
        account.current_balance = (account.current_balance or Decimal(0)) - amount

    await db.commit()
    await db.refresh(tx)
    return _tx_out(tx)


@router.post("/{account_id}/transactions/import")
async def import_transactions(
    account_id: uuid.UUID,
    transactions: List[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bulk import bank transactions (from CSV/Excel parser)."""
    acc_res = await db.execute(
        select(BankAccount).where(BankAccount.id == account_id, BankAccount.user_id == current_user.id)
    )
    account = acc_res.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    created = 0
    duplicates = 0
    for row in transactions:
        # Duplicate check by date + amount + description
        dup_check = await db.execute(
            select(BankTransaction).where(
                BankTransaction.account_id == account_id,
                BankTransaction.amount == Decimal(str(row.get("amount", 0))),
                BankTransaction.description == row.get("description", ""),
            ).limit(1)
        )
        if dup_check.scalar_one_or_none():
            duplicates += 1
            continue

        tx = BankTransaction(
            user_id          = current_user.id,
            account_id       = account_id,
            transaction_date = datetime.fromisoformat(row["transaction_date"]),
            description      = row.get("description", ""),
            amount           = Decimal(str(row.get("amount", 0))),
            tx_type          = row.get("tx_type", "DEBIT"),
            category         = row.get("category", "OTHER"),
            merchant_name    = row.get("merchant_name"),
            reference_no     = row.get("reference_no"),
            balance_after    = Decimal(str(row["balance_after"])) if "balance_after" in row else None,
            is_hidden_charge = _is_hidden_charge(row.get("description", "")),
            import_source    = row.get("import_source", "CSV"),
        )
        db.add(tx)
        created += 1

    await db.commit()
    return {"created": created, "duplicates": duplicates, "total": len(transactions)}


# ─── Cash Flow Intelligence ───────────────────────────────────────────────────

@router.get("/analytics/cashflow")
async def cashflow_intelligence(
    months: int = 6,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cash Flow Command Center payload.
    Aggregates bank transactions + CC data + loan EMIs for full picture.
    """
    uid = current_user.id
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=months * 31)

    # ── Accounts ──────────────────────────────────────────────────────────────
    acc_res = await db.execute(
        select(BankAccount).where(BankAccount.user_id == uid, BankAccount.is_active == True)
    )
    accounts = acc_res.scalars().all()
    total_balance = sum(float(a.current_balance or 0) for a in accounts)
    liquid_balance = sum(float(a.current_balance or 0) for a in accounts
                         if a.account_type in ("SAVINGS","CURRENT","SALARY","WALLET","UPI","CASH"))

    # ── Bank transactions in window ────────────────────────────────────────────
    tx_res = await db.execute(
        select(BankTransaction)
        .where(
            BankTransaction.user_id == uid,
            BankTransaction.transaction_date >= since,
            BankTransaction.is_excluded == False,
        )
        .order_by(BankTransaction.transaction_date)
    )
    txs = tx_res.scalars().all()

    # Monthly buckets
    monthly_map: dict = {}
    for tx in txs:
        mkey = _month_key(tx.transaction_date)
        if mkey not in monthly_map:
            monthly_map[mkey] = {"month": mkey, "inflow": 0.0, "outflow": 0.0, "net": 0.0}
        if tx.tx_type == BankTxType.CREDIT:
            monthly_map[mkey]["inflow"] += float(tx.amount)
        elif tx.tx_type == BankTxType.DEBIT:
            monthly_map[mkey]["outflow"] += float(tx.amount)
    for v in monthly_map.values():
        v["net"] = v["inflow"] - v["outflow"]
    monthly_cashflow = list(monthly_map.values())

    # Totals over window
    total_inflow  = sum(float(t.amount) for t in txs if t.tx_type == BankTxType.CREDIT)
    total_outflow = sum(float(t.amount) for t in txs if t.tx_type == BankTxType.DEBIT)
    monthly_avg_in  = total_inflow  / months if months else 0
    monthly_avg_out = total_outflow / months if months else 0

    # ── Hidden charges ─────────────────────────────────────────────────────────
    hidden = [_tx_out(t) for t in txs if t.is_hidden_charge]
    hidden_total = sum(float(t.amount) for t in txs if t.is_hidden_charge)

    # ── Category spending breakdown (debits only) ──────────────────────────────
    cat_map: dict = {}
    for tx in txs:
        if tx.tx_type != BankTxType.DEBIT: continue
        cat = ev(tx.category) or "OTHER"
        cat_map[cat] = cat_map.get(cat, 0.0) + float(tx.amount)
    category_breakdown = [
        {"category": k.replace("_", " ").title(), "amount": round(v, 2)}
        for k, v in sorted(cat_map.items(), key=lambda x: -x[1])
    ]

    # ── Burn rate & runway ─────────────────────────────────────────────────────
    # Use avg outflow or fall back to EMI + loan EMI
    loan_res = await db.execute(
        select(Loan).where(Loan.user_id == uid, Loan.status == "ACTIVE")
    )
    loans = loan_res.scalars().all()
    monthly_loan_emi = sum(float(l.emi_amount or 0) for l in loans)

    emi_res = await db.execute(
        select(EMI).where(EMI.user_id == uid, EMI.status == EMIStatus.ACTIVE)
    )
    emis = emi_res.scalars().all()
    monthly_emi = sum(float(e.monthly_emi or 0) for e in emis)

    burn_rate = monthly_avg_out if monthly_avg_out > 0 else (monthly_loan_emi + monthly_emi)
    runway_months = (liquid_balance / burn_rate) if burn_rate > 0 else 99.0

    # ── Upcoming payments ─────────────────────────────────────────────────────
    upcoming = []
    for loan in loans:
        due_day = loan.emi_due_day or 5
        today = now.day
        if due_day >= today:
            days_left = due_day - today
        else:
            days_left = (31 - today) + due_day  # next month
        upcoming.append({
            "label": f"{loan.nickname or ev(loan.loan_type).replace('_', ' ').title()} EMI",
            "amount": float(loan.emi_amount or 0),
            "days_left": days_left,
            "type": "LOAN",
        })
    for emi in emis:
        if emi.next_due_date:
            try:
                nd = datetime.fromisoformat(str(emi.next_due_date))
                days_left = max(0, (nd.date() - now.date()).days)
                upcoming.append({
                    "label": emi.product_name,
                    "amount": float(emi.monthly_emi or 0),
                    "days_left": days_left,
                    "type": "EMI",
                })
            except Exception:
                pass
    upcoming.sort(key=lambda x: x["days_left"])

    # ── Insights ─────────────────────────────────────────────────────────────
    insights = _cashflow_insights(
        liquid_balance=liquid_balance,
        burn_rate=burn_rate,
        runway_months=runway_months,
        monthly_avg_in=monthly_avg_in,
        monthly_avg_out=monthly_avg_out,
        hidden_total=hidden_total,
        category_breakdown=category_breakdown,
        accounts=accounts,
    )

    # ── Per-account health ─────────────────────────────────────────────────────
    account_health = []
    for acc in accounts:
        bal = float(acc.current_balance or 0)
        min_bal = float(acc.minimum_balance or 0)
        below_min = bal < min_bal and min_bal > 0
        account_health.append({
            "id":              str(acc.id),
            "nickname":        acc.nickname,
            "bank_name":       acc.bank_name,
            "account_type":    acc.account_type,
            "balance":         bal,
            "minimum_balance": min_bal,
            "below_min":       below_min,
            "interest_rate":   float(acc.interest_rate or 0),
            "account_color":   acc.account_color,
            "is_primary":      acc.is_primary,
        })

    return {
        # Summary
        "total_balance":     round(total_balance, 2),
        "liquid_balance":    round(liquid_balance, 2),
        "monthly_avg_in":    round(monthly_avg_in, 2),
        "monthly_avg_out":   round(monthly_avg_out, 2),
        "burn_rate":         round(burn_rate, 2),
        "runway_months":     round(min(runway_months, 99.0), 1),
        "monthly_loan_emi":  round(monthly_loan_emi, 2),
        "monthly_emi":       round(monthly_emi, 2),
        "hidden_total":      round(hidden_total, 2),
        "hidden_count":      len(hidden),

        # Structured data
        "monthly_cashflow":      monthly_cashflow,
        "category_breakdown":    category_breakdown[:8],
        "hidden_charges":        hidden[:10],
        "upcoming_payments":     upcoming[:8],
        "account_health":        account_health,
        "insights":              insights,
    }


def _cashflow_insights(liquid_balance, burn_rate, runway_months, monthly_avg_in,
                        monthly_avg_out, hidden_total, category_breakdown, accounts):
    items = []

    if runway_months < 1 and burn_rate > 0:
        items.append({"severity": "CRITICAL", "title": "Cash Runway Critical",
            "body": f"At current burn rate of {_fmt(burn_rate)}/month, you have less than 1 month of runway.",
            "action": "banking"})
    elif runway_months < 3 and burn_rate > 0:
        items.append({"severity": "WARNING", "title": f"{runway_months:.1f} Months Runway",
            "body": f"Build liquid reserves. Target 6 months ({_fmt(burn_rate * 6)}) for financial safety.",
            "action": "banking"})

    if monthly_avg_in > 0 and monthly_avg_out > monthly_avg_in * 0.9:
        ratio = monthly_avg_out / monthly_avg_in * 100
        items.append({"severity": "WARNING", "title": "Spending Exceeds Income",
            "body": f"You're spending {ratio:.0f}% of inflows. Average out: {_fmt(monthly_avg_out)}, in: {_fmt(monthly_avg_in)}.",
            "action": "banking"})

    if hidden_total > 0:
        items.append({"severity": "WARNING", "title": f"Hidden Bank Fees Detected",
            "body": f"{_fmt(hidden_total)} charged in undisclosed fees. Review and switch to zero-maintenance accounts.",
            "action": "banking"})

    for acc in accounts:
        bal = float(acc.current_balance or 0)
        min_bal = float(acc.minimum_balance or 0)
        if min_bal > 0 and bal < min_bal:
            items.append({"severity": "WARNING", "title": f"{acc.nickname} Below Minimum",
                "body": f"Balance {_fmt(bal)} is below minimum {_fmt(min_bal)}. Penalty charges will apply.",
                "action": "banking"})

    if category_breakdown:
        top = category_breakdown[0]
        if top["amount"] > (monthly_avg_out * 0.4) and monthly_avg_out > 0:
            items.append({"severity": "INFO", "title": f"Top Expense: {top['category']}",
                "body": f"{_fmt(top['amount'])} ({top['amount']/monthly_avg_out*100:.0f}% of spending). Review if this aligns with your goals.",
                "action": "banking"})

    # Savings rate insight
    if monthly_avg_in > 0:
        savings = monthly_avg_in - monthly_avg_out
        savings_rate = (savings / monthly_avg_in) * 100
        if savings_rate >= 20:
            items.append({"severity": "INFO", "title": f"Saving {savings_rate:.0f}% of Income",
                "body": f"Great discipline — you're saving {_fmt(savings)}/month. Consider allocating surplus to investments or goals.",
                "action": "banking"})
        elif savings_rate > 0:
            items.append({"severity": "WARNING", "title": f"Low Savings Rate: {savings_rate:.0f}%",
                "body": f"You're saving only {_fmt(savings)}/month. Target 20%+ ({_fmt(monthly_avg_in * 0.2)}) for long-term financial health.",
                "action": "banking"})

    # Recurring vs discretionary insight
    if category_breakdown and monthly_avg_out > 0:
        recurring_cats = {"EMI", "RENT", "UTILITIES", "SUBSCRIPTION", "INSURANCE"}
        recurring_total = sum(c["amount"] for c in category_breakdown if c["category"].upper().replace(" ", "_") in recurring_cats)
        if recurring_total > 0:
            pct = recurring_total / monthly_avg_out * 100
            if pct > 60:
                items.append({"severity": "WARNING", "title": f"{pct:.0f}% Fixed Commitments",
                    "body": f"{_fmt(recurring_total)}/month locked in recurring expenses (EMI, rent, subscriptions). Limited flexibility for emergencies.",
                    "action": "banking"})
            else:
                items.append({"severity": "INFO", "title": f"Fixed Costs: {pct:.0f}% of Spending",
                    "body": f"{_fmt(recurring_total)}/month in recurring commitments. The remaining {100-pct:.0f}% is discretionary spending.",
                    "action": "banking"})

    if not items:
        items.append({"severity": "INFO", "title": "Add Bank Transactions",
            "body": "Import your bank statements to see spending patterns, cash flow analysis and hidden charge detection.",
            "action": "banking"})

    return items[:5]


def _tx_out(tx: BankTransaction) -> dict:
    return {
        "id":               str(tx.id),
        "account_id":       str(tx.account_id),
        "transaction_date": tx.transaction_date.isoformat(),
        "description":      tx.description,
        "amount":           float(tx.amount),
        "tx_type":          ev(tx.tx_type),
        "category":         ev(tx.category),
        "merchant_name":    tx.merchant_name,
        "reference_no":     tx.reference_no,
        "balance_after":    float(tx.balance_after) if tx.balance_after else None,
        "is_hidden_charge": tx.is_hidden_charge,
        "is_recurring":     tx.is_recurring,
        "is_duplicate":     tx.is_duplicate,
        "import_source":    tx.import_source,
        "notes":            tx.notes,
    }
