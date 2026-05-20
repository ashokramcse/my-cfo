import logging
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
def parse_statement_task(self, statement_id: str, file_path: str, password: str | None, user_id: str):
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
        tx_count = 0
        for ptx in parsed.transactions:
            merchant = extract_merchant_name(ptx.description)
            category = categorize(ptx.description, merchant)

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
