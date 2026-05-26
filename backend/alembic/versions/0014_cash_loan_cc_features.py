"""
Cash Account support, Loan-Credit linking, Interest auto-split, CC Payment recognition.

Changes:
- Add new BankTxCategory enum values: CC_PAYMENT, LOAN_DISBURSEMENT, LOAN_REPAYMENT,
  CASH_WITHDRAWAL, CASH_DEPOSIT
- Add is_loan_disbursement (bool) to bank_transactions
- Add interest_amount (numeric) to bank_transactions
"""

from alembic import op
import sqlalchemy as sa

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    # ── Add new enum values to banktxcategory ────────────────────────────────
    # PostgreSQL requires ALTER TYPE ... ADD VALUE (cannot be inside a transaction block
    # for ENUM changes in older PG, but PG 12+ supports it fine outside DDL transactions)
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'CC_PAYMENT'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'LOAN_DISBURSEMENT'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'LOAN_REPAYMENT'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'CASH_WITHDRAWAL'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'CASH_DEPOSIT'")

    # ── Add new columns to bank_transactions ─────────────────────────────────
    op.add_column(
        "bank_transactions",
        sa.Column("is_loan_disbursement", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "bank_transactions",
        sa.Column("interest_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )

    # Index: quickly find all loan disbursements for net worth calculation
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bank_tx_loan_disbursement
        ON bank_transactions (user_id, linked_loan_id)
        WHERE linked_loan_id IS NOT NULL
    """)

    # Index: quickly find all CC payment legs
    op.execute("""
        CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bank_tx_linked_card
        ON bank_transactions (user_id, linked_card_id)
        WHERE linked_card_id IS NOT NULL
    """)


def downgrade():
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bank_tx_linked_card")
    op.execute("DROP INDEX CONCURRENTLY IF EXISTS ix_bank_tx_loan_disbursement")
    op.drop_column("bank_transactions", "interest_amount")
    op.drop_column("bank_transactions", "is_loan_disbursement")
    # Note: PostgreSQL doesn't support removing enum values; downgrade leaves the enum values intact
