"""Bank transactions table + balance_snapshot column on bank_accounts

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def _table_exists(name):
    from sqlalchemy import inspect as sa_inspect
    return sa_inspect(op.get_bind()).has_table(name)


def _col_exists(table, col):
    from sqlalchemy import inspect as sa_inspect
    cols = [c["name"] for c in sa_inspect(op.get_bind()).get_columns(table)]
    return col in cols


def upgrade():
    if not _table_exists("bank_transactions"):
        op.create_table(
            "bank_transactions",
            sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",          postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("account_id",       postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False),
            sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("value_date",       sa.DateTime(timezone=True)),
            sa.Column("description",      sa.Text, nullable=False),
            sa.Column("amount",           sa.Numeric(15, 2), nullable=False),
            sa.Column("tx_type",          sa.String(20), nullable=False),
            sa.Column("category",         sa.String(30), server_default="OTHER"),
            sa.Column("merchant_name",    sa.String(200)),
            sa.Column("reference_no",     sa.String(100)),
            sa.Column("balance_after",    sa.Numeric(15, 2)),
            sa.Column("linked_account_id",postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("bank_accounts.id", ondelete="SET NULL")),
            sa.Column("is_duplicate",     sa.Boolean, server_default="false"),
            sa.Column("is_hidden_charge", sa.Boolean, server_default="false"),
            sa.Column("is_recurring",     sa.Boolean, server_default="false"),
            sa.Column("is_excluded",      sa.Boolean, server_default="false"),
            sa.Column("import_source",    sa.String(20), server_default="MANUAL"),
            sa.Column("raw_data",         postgresql.JSONB, server_default="{}"),
            sa.Column("notes",            sa.Text),
            sa.Column("tags",             postgresql.JSONB, server_default="[]"),
            sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",       sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_bank_tx_account_date", "bank_transactions", ["account_id", "transaction_date"])
        op.create_index("ix_bank_tx_user_date",    "bank_transactions", ["user_id",    "transaction_date"])
        op.create_index("ix_bank_tx_user_id",      "bank_transactions", ["user_id"])

    # Add balance_snapshot_date to bank_accounts if missing
    if _table_exists("bank_accounts") and not _col_exists("bank_accounts", "balance_updated_at"):
        op.add_column("bank_accounts",
            sa.Column("balance_updated_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_table("bank_transactions")
    op.drop_column("bank_accounts", "balance_updated_at")
