"""Wallet/UPI reconciliation: new categories, is_transfer_leg, linked_tx_id

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    # ── New BankTxCategory enum values ──────────────────────────────────────
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'WALLET_LOAD'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'CC_WALLET_LOAD'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'WALLET_TRANSFER'")
    op.execute("ALTER TYPE banktxcategory ADD VALUE IF NOT EXISTS 'WALLET_FEE'")

    # ── linked_tx_id — peer transaction in a transfer pair ───────────────────
    op.add_column(
        "bank_transactions",
        sa.Column(
            "linked_tx_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bank_transactions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    # ── is_transfer_leg flag ─────────────────────────────────────────────────
    op.add_column(
        "bank_transactions",
        sa.Column("is_transfer_leg", sa.Boolean(), server_default="false", nullable=False),
    )

    # Index for fast reconciliation lookups (user + reference_no)
    op.create_index(
        "ix_bank_tx_user_refno",
        "bank_transactions",
        ["user_id", "reference_no"],
        postgresql_where=sa.text("reference_no IS NOT NULL"),
    )


def downgrade():
    op.drop_index("ix_bank_tx_user_refno", table_name="bank_transactions")
    op.drop_column("bank_transactions", "is_transfer_leg")
    op.drop_column("bank_transactions", "linked_tx_id")
    # PostgreSQL cannot remove enum values — intentional
