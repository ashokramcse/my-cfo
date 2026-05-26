import logging
from typing import Optional
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


def get_sync_db():
    """Sync SQLAlchemy session for Celery workers."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.config import settings
    engine = create_engine(settings.sync_database_url)
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task(bind=True, name="app.workers.tasks.parse_statement_task", max_retries=3)
def parse_statement_task(self, statement_id: str, file_path: str, password: Optional[str], user_id: str):
    """Parse a credit card statement PDF and persist transactions."""
    from app.models.statement import Statement, StatementStatus
    from app.models.transaction import Transaction
    from app.services.pdf_parser import parse_statement_pdf
    from app.services.categorizer import categorize, extract_merchant_name
    import uuid

    db = get_sync_db()
    try:
        stmt = db.get(Statement, uuid.UUID(statement_id))
        if not stmt:
            logger.error(f"Statement {statement_id} not found")
            return

        stmt.status = StatementStatus.PROCESSING
        db.commit()

        parsed = parse_statement_pdf(file_path, password)

        # Update statement financials
        stmt.bank_detected = parsed.bank_name
        stmt.statement_date = parsed.statement_date
        stmt.period_from = parsed.period_from
        stmt.period_to = parsed.period_to
        stmt.due_date = parsed.due_date
        stmt.opening_balance = parsed.opening_balance
        stmt.closing_balance = parsed.closing_balance
        stmt.total_due = parsed.total_due
        stmt.minimum_due = parsed.minimum_due
        stmt.credit_limit = parsed.credit_limit
        stmt.available_credit = parsed.available_credit
        stmt.total_fees = parsed.total_fees
        stmt.total_interest = parsed.total_interest
        stmt.reward_points_earned = parsed.reward_points_earned
        stmt.transaction_count = len(parsed.transactions)
        stmt.raw_data = {
            "parse_confidence": parsed.parse_confidence,
            "raw_text_length": len(parsed.raw_text),
        }

        # Persist transactions
        from sqlalchemy import and_, func, cast, Date
        from decimal import Decimal as _D
        from datetime import timedelta
        from app.models.statement import Statement as StmtModel

        _AMOUNT_TOLERANCE  = _D("1.00")  # ±₹1 — rounding differences between sources
        _DATE_WINDOW_DAYS  = 2           # ±2 days — billing date vs transaction date skew

        # Authority ranking: official bank parsers beat CC-app / generic PDFs.
        # Higher number = more authoritative. Bank statement always wins over CC app.
        _AUTHORITY: dict[str, int] = {
            "HDFC": 10, "ICICI": 10, "SBI": 10, "AXIS": 10,
            "AMEX": 10, "KOTAK": 10, "IDFC": 10, "AU": 10,
            "FEDERAL": 10, "SC": 10, "ONECARD": 10,
            "GENERIC": 1, "UNKNOWN": 1,
        }

        def _authority(bank: str | None) -> int:
            if not bank:
                return 1
            return _AUTHORITY.get(bank.upper(), 1)

        def _existing_authority(tx: Transaction) -> int:
            """Resolve the authority of an already-stored transaction."""
            if not tx.statement_id:
                return 1
            s = db.get(StmtModel, tx.statement_id)
            return _authority(s.bank_detected if s else None)

        def _build_dup_tx(**kwargs) -> Transaction:
            """Return a Transaction pre-flagged as duplicate + excluded."""
            return Transaction(
                user_id=uuid.UUID(user_id),
                card_id=stmt.card_id,
                statement_id=stmt.id,
                is_duplicate=True,
                is_excluded=True,
                **kwargs,
            )

        incoming_authority = _authority(parsed.bank_name)

        # Track which existing tx IDs have already been matched in this import
        # batch. Prevents two identical transactions on the same day (e.g. two
        # ₹500 Swiggy orders) from both hitting "ambiguous" and inserting fresh
        # when the second source also has both — they are matched 1-to-1 in order.
        consumed_ids: set[uuid.UUID] = set()

        tx_count = 0
        for ptx in parsed.transactions:
            merchant  = extract_merchant_name(ptx.description)
            category  = categorize(ptx.description, merchant)

            # ── Common tx fields (reused for both authoritative + dup inserts) ──
            tx_fields = dict(
                transaction_date  = ptx.date,
                description       = ptx.description,
                merchant_name     = merchant,
                amount            = ptx.amount,
                currency          = ptx.currency,
                transaction_type  = ptx.transaction_type,
                category          = category,
                is_emi            = ptx.is_emi,
                gst_amount        = ptx.gst_amount,
                cashback_amount   = ptx.cashback_amount,
                reward_points     = ptx.reward_points,
                raw_description   = ptx.raw_text,
            )

            # ── Duplicate detection ──────────────────────────────────────────
            # Skip dedup when card_id is None (bank-account uploads have no
            # shared key to match CC transactions against).
            if stmt.card_id is None:
                db.add(Transaction(
                    user_id=uuid.UUID(user_id),
                    card_id=stmt.card_id,
                    statement_id=stmt.id,
                    **tx_fields,
                ))
                tx_count += 1
                continue

            date_lo = ptx.date - timedelta(days=_DATE_WINDOW_DAYS)
            date_hi = ptx.date + timedelta(days=_DATE_WINDOW_DAYS)

            # Fetch all non-duplicate, not-yet-consumed candidates within the
            # date window + amount tolerance for this card + transaction_type.
            candidates = db.query(Transaction).filter(
                and_(
                    Transaction.card_id          == stmt.card_id,
                    Transaction.transaction_type == ptx.transaction_type,
                    Transaction.amount           >= ptx.amount - _AMOUNT_TOLERANCE,
                    Transaction.amount           <= ptx.amount + _AMOUNT_TOLERANCE,
                    Transaction.transaction_date >= date_lo,
                    Transaction.transaction_date <= date_hi,
                    Transaction.is_duplicate     == False,
                )
            ).all()

            # Exclude candidates already matched earlier in this batch
            candidates = [c for c in candidates if c.id not in consumed_ids]

            # ── Pick best candidate ────────────────────────────────────────
            # Sort by date proximity (closest first) so same-day exact matches
            # beat nearby-day fuzzy matches. When two identical transactions
            # exist on the same day (e.g. two ₹500 Swiggy orders), the first
            # ptx consumes the first candidate, leaving the second available
            # for the next ptx — correct 1-to-1 matching.
            candidates.sort(key=lambda c: abs((c.transaction_date - ptx.date).days))

            existing = candidates[0] if candidates else None

            if existing is None:
                # No match → fresh transaction
                db.add(Transaction(
                    user_id=uuid.UUID(user_id),
                    card_id=stmt.card_id,
                    statement_id=stmt.id,
                    **tx_fields,
                ))
                tx_count += 1
                continue

            # Mark candidate consumed so the next ptx doesn't re-match it
            consumed_ids.add(existing.id)

            # ── Authority comparison ───────────────────────────────────────
            existing_auth = _existing_authority(existing)

            if incoming_authority > existing_auth:
                # Incoming (bank PDF) beats existing (CC app PDF).
                # Demote existing → duplicate, promote incoming → authoritative.
                existing.is_duplicate = True
                existing.is_excluded  = True
                db.add(existing)
                db.add(Transaction(
                    user_id=uuid.UUID(user_id),
                    card_id=stmt.card_id,
                    statement_id=stmt.id,
                    **tx_fields,
                ))
                tx_count += 1
            else:
                # Existing is equal or more authoritative — incoming is the dup.
                # Persist for audit trail but fully suppress from all totals.
                db.add(_build_dup_tx(**tx_fields))
                # do NOT increment tx_count

        stmt.status = StatementStatus.PARSED
        db.commit()
        logger.info(f"Parsed {tx_count} transactions from statement {statement_id}")

        # Trigger insights generation
        generate_insights_task.delay(user_id)

    except Exception as exc:
        db.rollback()
        logger.error(f"Statement parsing failed: {exc}", exc_info=True)
        if stmt:
            stmt.status = StatementStatus.FAILED
            stmt.parse_error = str(exc)[:500]
            db.commit()
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.generate_insights_task")
def generate_insights_task(user_id: str):
    """Generate AI-powered insights for a user."""
    import asyncio
    from app.database import AsyncSessionLocal
    from app.services.insights import generate_insights_for_user

    async def _run():
        async with AsyncSessionLocal() as db:
            await generate_insights_for_user(user_id, db)
            await db.commit()

    asyncio.run(_run())


@celery_app.task(name="app.workers.tasks.run_daily_insights")
def run_daily_insights():
    """Run insights for all active users daily."""
    from sqlalchemy import create_engine, text
    from app.config import settings

    engine = create_engine(settings.sync_database_url)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT id FROM users WHERE is_active = true"))
        for row in result:
            generate_insights_task.delay(str(row[0]))


@celery_app.task(name="app.workers.tasks.take_daily_net_worth_snapshots")
def take_daily_net_worth_snapshots():
    """Take net worth snapshots for all active users. Run daily via beat."""
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from app.config import settings
    from app.models.user import User
    from app.models.net_worth import NetWorthSnapshot
    from app.services.financial_context import build_financial_context
    from sqlalchemy import select

    async def _run():
        engine = create_async_engine(settings.database_url)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        async with async_session() as db:
            users_result = await db.execute(select(User).where(User.is_active == True))
            users = users_result.scalars().all()
            for user in users:
                try:
                    data = await build_financial_context(db, user.id)
                    # Get last snapshot for change calculation
                    last_res = await db.execute(
                        select(NetWorthSnapshot)
                        .where(NetWorthSnapshot.user_id == user.id)
                        .order_by(NetWorthSnapshot.snapshot_date.desc())
                        .limit(1)
                    )
                    last = last_res.scalar_one_or_none()
                    prev_nw = float(last.net_worth or 0) if last else 0
                    change = data["net_worth"] - prev_nw
                    change_pct = (change / abs(prev_nw) * 100) if prev_nw else 0
                    snap = NetWorthSnapshot(
                        user_id=user.id,
                        bank_balance=data["bank_total"],
                        investment_value=data["investment_value"],
                        asset_value=data["asset_value"],
                        total_assets=data["total_assets"],
                        credit_card_outstanding=data["cc_outstanding"],
                        loan_outstanding=data["loan_outstanding"],
                        total_liabilities=data["total_liabilities"],
                        net_worth=data["net_worth"],
                        change_amount=change,
                        change_pct=change_pct,
                        extra_data={
                            "liquid_net_worth": data["liquid_net_worth"],
                            "health_score": 0,
                            "debt_ratio": data["debt_ratio"],
                            "investment_ratio": data["investment_ratio"],
                            "emergency_months": data["emergency_months"],
                            "monthly_surplus": data["monthly_surplus"],
                        },
                    )
                    db.add(snap)
                except Exception as e:
                    logger.error(f"Net worth snapshot failed for user {user.id}: {e}")
            await db.commit()
        await engine.dispose()

    asyncio.run(_run())


@celery_app.task(name="app.workers.tasks.check_loan_overdue_notifications")
def check_loan_overdue_notifications():
    """Check for overdue loans and upcoming EMI dues. Run daily."""
    from app.models.loan import Loan, LoanStatus
    from app.models.insurance import Insurance
    from datetime import date, timedelta
    db = get_sync_db()
    try:
        today = date.today()
        warning_date = today + timedelta(days=7)
        # Find loans overdue
        overdue = db.query(Loan).filter(Loan.status == LoanStatus.OVERDUE).all()
        for loan in overdue:
            logger.warning(f"OVERDUE LOAN: user={loan.user_id} loan={loan.id} amount={loan.outstanding_balance}")
        # Find insurance renewals within 30 days
        renewals = db.query(Insurance).filter(
            Insurance.is_active == True,
            Insurance.renewal_date != None,
            Insurance.renewal_date <= today + timedelta(days=30),
            Insurance.renewal_date >= today,
        ).all()
        for ins in renewals:
            days = (ins.renewal_date - today).days
            logger.info(f"INSURANCE RENEWAL in {days} days: user={ins.user_id} policy={ins.policy_name}")
    finally:
        db.close()


@celery_app.task(name="workers.tasks.advance_emi_progress")
def advance_emi_progress():
    """Auto-advance paid_months for EMIs where next payment date has passed."""
    import asyncio
    from datetime import date
    async def _run():
        from app.database import AsyncSessionLocal
        from app.models.emi import EMI, EMIStatus
        from sqlalchemy import select
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(EMI).where(EMI.status == EMIStatus.ACTIVE)
            )
            emis = result.scalars().all()
            today = date.today()
            for emi in emis:
                if emi.start_date and emi.total_months:
                    from dateutil.relativedelta import relativedelta
                    months_elapsed = (today.year - emi.start_date.year) * 12 + (today.month - emi.start_date.month)
                    expected_paid = min(months_elapsed, emi.total_months)
                    if expected_paid > (emi.paid_months or 0):
                        emi.paid_months = expected_paid
                        if emi.paid_months >= emi.total_months:
                            emi.status = EMIStatus.COMPLETED
            await db.commit()
    asyncio.run(_run())


@celery_app.task(name="app.workers.tasks.update_all_friend_totals")
def update_all_friend_totals():
    """Recompute friend totals from EMI data."""
    from sqlalchemy import create_engine, text
    from app.config import settings

    engine = create_engine(settings.sync_database_url)
    with engine.connect() as conn:
        conn.execute(text("""
            UPDATE friends f SET
                total_emi_amount = COALESCE((
                    SELECT SUM(total_amount) FROM emis WHERE friend_id = f.id AND status = 'ACTIVE'
                ), 0),
                total_collected = COALESCE((
                    SELECT SUM(amount_collected) FROM emis WHERE friend_id = f.id
                ), 0),
                total_pending = COALESCE((
                    SELECT SUM(total_amount - amount_collected) FROM emis WHERE friend_id = f.id AND status = 'ACTIVE'
                ), 0),
                active_emi_count = COALESCE((
                    SELECT COUNT(*) FROM emis WHERE friend_id = f.id AND status = 'ACTIVE'
                ), 0),
                risk_level = CASE
                    WHEN (SELECT SUM(total_amount - amount_collected) FROM emis WHERE friend_id = f.id AND status = 'ACTIVE') > 50000 THEN 'HIGH'
                    WHEN (SELECT SUM(total_amount - amount_collected) FROM emis WHERE friend_id = f.id AND status = 'ACTIVE') > 10000 THEN 'MEDIUM'
                    ELSE 'LOW'
                END
        """))
        conn.commit()
