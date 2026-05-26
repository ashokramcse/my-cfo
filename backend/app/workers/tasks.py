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
        from sqlalchemy import and_, func
        from decimal import Decimal as _D

        _AMOUNT_TOLERANCE = _D("1.00")  # ±₹1 for rounding differences between sources

        tx_count = 0
        for ptx in parsed.transactions:
            merchant = extract_merchant_name(ptx.description)
            category = categorize(ptx.description, merchant)

            # ── Duplicate detection ──────────────────────────────────────────
            # Match key: same card + same date + amount within ±₹1 + same
            # transaction_type (catches Cred vs bank rounding differences).
            # card_id may be None for bank-account-linked uploads — in that
            # case skip dedup (no shared key to match on).
            is_dup = False
            if stmt.card_id is not None:
                existing = db.query(Transaction).filter(
                    and_(
                        Transaction.card_id == stmt.card_id,
                        Transaction.transaction_date == ptx.date,
                        Transaction.transaction_type == ptx.transaction_type,
                        Transaction.amount >= ptx.amount - _AMOUNT_TOLERANCE,
                        Transaction.amount <= ptx.amount + _AMOUNT_TOLERANCE,
                        Transaction.is_duplicate == False,  # don't match against already-duped rows
                    )
                ).first()

                if existing:
                    # The INCOMING tx is the duplicate — keep the existing
                    # (first-uploaded) record as authoritative. Insert the
                    # incoming tx as a suppressed duplicate so it's auditable.
                    tx = Transaction(
                        user_id=uuid.UUID(user_id),
                        card_id=stmt.card_id,
                        statement_id=stmt.id,
                        transaction_date=ptx.date,
                        description=ptx.description,
                        merchant_name=merchant,
                        amount=ptx.amount,
                        currency=ptx.currency,
                        transaction_type=ptx.transaction_type,
                        category=category,
                        is_emi=ptx.is_emi,
                        gst_amount=ptx.gst_amount,
                        cashback_amount=ptx.cashback_amount,
                        reward_points=ptx.reward_points,
                        raw_description=ptx.raw_text,
                        is_duplicate=True,
                        is_excluded=True,   # fully invisible in all spend totals
                    )
                    db.add(tx)
                    continue  # do NOT count as a new transaction

            tx = Transaction(
                user_id=uuid.UUID(user_id),
                card_id=stmt.card_id,
                statement_id=stmt.id,
                transaction_date=ptx.date,
                description=ptx.description,
                merchant_name=merchant,
                amount=ptx.amount,
                currency=ptx.currency,
                transaction_type=ptx.transaction_type,
                category=category,
                is_emi=ptx.is_emi,
                gst_amount=ptx.gst_amount,
                cashback_amount=ptx.cashback_amount,
                reward_points=ptx.reward_points,
                raw_description=ptx.raw_text,
            )
            db.add(tx)
            tx_count += 1

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
