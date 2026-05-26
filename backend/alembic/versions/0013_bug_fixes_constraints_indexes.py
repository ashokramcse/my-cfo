"""
Bug fixes: DB constraints, indexes, type corrections.

Fixes:
- S-001: CHECK (amount > 0) on transactions and bank_transactions
- S-002: CHECK (current_outstanding >= 0) on credit_cards
- S-005: Composite index on transactions(user_id, transaction_date, is_excluded)
- S-006: Composite index on bank_transactions(account_id, is_excluded, tx_type)
- S-007: Index on bank_transactions(linked_tx_id)
- S-008: Index on bank_transactions(user_id, reference_no) for reconciler UTR lookups
"""

from alembic import op
import sqlalchemy as sa

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    # ── S-001: Positive amount constraints ───────────────────────────────────
    op.execute("""
        ALTER TABLE transactions
        ADD CONSTRAINT chk_tx_amount_positive
        CHECK (amount > 0)
        NOT VALID
    """)
    op.execute("ALTER TABLE transactions VALIDATE CONSTRAINT chk_tx_amount_positive")

    op.execute("""
        ALTER TABLE bank_transactions
        ADD CONSTRAINT chk_bank_tx_amount_positive
        CHECK (amount > 0)
        NOT VALID
    """)
    op.execute("ALTER TABLE bank_transactions VALIDATE CONSTRAINT chk_bank_tx_amount_positive")

    # ── S-002: Non-negative outstanding ──────────────────────────────────────
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'chk_cc_outstanding_non_negative'
            ) THEN
                ALTER TABLE credit_cards
                ADD CONSTRAINT chk_cc_outstanding_non_negative
                CHECK (current_outstanding >= 0)
                NOT VALID;
            END IF;
        END$$
    """)

    # ── S-005: Composite index for analytics queries ──────────────────────────
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_tx_user_date_excluded
        ON transactions (user_id, transaction_date, is_excluded)
        WHERE is_excluded = false
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_tx_user_date_type
        ON transactions (user_id, transaction_date, transaction_type)
        WHERE is_excluded = false
    """)

    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_tx_card_date_excluded
        ON transactions (card_id, transaction_date, is_excluded)
        WHERE is_excluded = false AND card_id IS NOT NULL
    """)

    # ── S-006: Bank transaction composite index ───────────────────────────────
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_bank_tx_account_type_excluded
        ON bank_transactions (account_id, tx_type, is_excluded)
        WHERE is_excluded = false
    """)

    # ── S-007: Index on linked_tx_id for reconciliation joins ─────────────────
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_bank_tx_linked_tx_id
        ON bank_transactions (linked_tx_id)
        WHERE linked_tx_id IS NOT NULL
    """)

    # ── S-008: UTR lookup index ───────────────────────────────────────────────
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS
        ix_bank_tx_user_refno
        ON bank_transactions (user_id, reference_no)
        WHERE reference_no IS NOT NULL
    """)


def downgrade():
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bank_tx_user_refno")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bank_tx_linked_tx_id")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bank_tx_account_type_excluded")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tx_card_date_excluded")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tx_user_date_type")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_tx_user_date_excluded")
    op.execute("ALTER TABLE credit_cards DROP CONSTRAINT IF EXISTS chk_cc_outstanding_non_negative")
    op.execute("ALTER TABLE bank_transactions DROP CONSTRAINT IF EXISTS chk_bank_tx_amount_positive")
    op.execute("ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_tx_amount_positive")
