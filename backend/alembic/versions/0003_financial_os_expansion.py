"""Financial OS expansion — bank accounts, investments, loans, assets, net worth

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def _table_exists(table_name: str) -> bool:
    from sqlalchemy import inspect as sa_inspect
    bind = op.get_bind()
    return sa_inspect(bind).has_table(table_name)


def upgrade() -> None:
    # ── bank_accounts ─────────────────────────────────────────────────────────
    if not _table_exists("bank_accounts"):
        op.create_table(
            "bank_accounts",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("nickname", sa.String(100), nullable=False),
            sa.Column("bank_name", sa.String(100), nullable=False),
            sa.Column("account_type", sa.String(20), nullable=False, server_default="SAVINGS"),
            sa.Column("account_number_last4", sa.String(4)),
            sa.Column("ifsc_code", sa.String(20)),
            sa.Column("branch", sa.String(200)),
            sa.Column("current_balance", sa.Numeric(15, 2), server_default="0"),
            sa.Column("minimum_balance", sa.Numeric(12, 2), server_default="0"),
            sa.Column("interest_rate", sa.Numeric(5, 2), server_default="0"),
            sa.Column("maturity_date", sa.DateTime(timezone=True)),
            sa.Column("maturity_amount", sa.Numeric(15, 2)),
            sa.Column("account_color", sa.String(7), server_default="#0EA5E9"),
            sa.Column("is_active", sa.Boolean, server_default="true"),
            sa.Column("is_primary", sa.Boolean, server_default="false"),
            sa.Column("notes", sa.Text),
            sa.Column("extra_data", postgresql.JSONB, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_bank_accounts_user_id", "bank_accounts", ["user_id"])

    # ── investments ───────────────────────────────────────────────────────────
    if not _table_exists("investments"):
        op.create_table(
            "investments",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("investment_type", sa.String(20), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("symbol", sa.String(50)),
            sa.Column("folio_number", sa.String(100)),
            sa.Column("units", sa.Numeric(15, 4), server_default="0"),
            sa.Column("avg_buy_price", sa.Numeric(15, 4), server_default="0"),
            sa.Column("current_price", sa.Numeric(15, 4), server_default="0"),
            sa.Column("current_value", sa.Numeric(15, 2), server_default="0"),
            sa.Column("invested_amount", sa.Numeric(15, 2), server_default="0"),
            sa.Column("is_sip", sa.Boolean, server_default="false"),
            sa.Column("sip_amount", sa.Numeric(12, 2)),
            sa.Column("sip_date", sa.Integer),
            sa.Column("sip_status", sa.String(10), server_default="ACTIVE"),
            sa.Column("sip_start_date", sa.Date),
            sa.Column("sip_end_date", sa.Date),
            sa.Column("weight_grams", sa.Numeric(10, 3)),
            sa.Column("purity", sa.String(10)),
            sa.Column("broker", sa.String(100)),
            sa.Column("platform", sa.String(100)),
            sa.Column("lock_in_until", sa.Date),
            sa.Column("is_locked", sa.Boolean, server_default="false"),
            sa.Column("unrealized_pnl", sa.Numeric(15, 2), server_default="0"),
            sa.Column("realized_pnl", sa.Numeric(15, 2), server_default="0"),
            sa.Column("xirr", sa.Numeric(8, 4)),
            sa.Column("cagr", sa.Numeric(8, 4)),
            sa.Column("purchase_date", sa.Date),
            sa.Column("notes", sa.Text),
            sa.Column("extra_data", postgresql.JSONB, server_default="{}"),
            sa.Column("last_price_updated", sa.DateTime(timezone=True)),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_investments_user_id", "investments", ["user_id"])

    # ── loans ─────────────────────────────────────────────────────────────────
    if not _table_exists("loans"):
        op.create_table(
            "loans",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("loan_type", sa.String(20), nullable=False),
            sa.Column("lender_name", sa.String(200), nullable=False),
            sa.Column("loan_account_number", sa.String(100)),
            sa.Column("nickname", sa.String(100)),
            sa.Column("principal_amount", sa.Numeric(15, 2), nullable=False),
            sa.Column("outstanding_balance", sa.Numeric(15, 2), nullable=False),
            sa.Column("emi_amount", sa.Numeric(12, 2)),
            sa.Column("total_paid", sa.Numeric(15, 2), server_default="0"),
            sa.Column("total_interest_paid", sa.Numeric(15, 2), server_default="0"),
            sa.Column("interest_rate", sa.Numeric(6, 3), nullable=False),
            sa.Column("tenure_months", sa.Integer),
            sa.Column("remaining_months", sa.Integer),
            sa.Column("start_date", sa.Date, nullable=False),
            sa.Column("end_date", sa.Date),
            sa.Column("emi_due_day", sa.Integer, server_default="5"),
            sa.Column("status", sa.String(20), server_default="ACTIVE"),
            sa.Column("is_secured", sa.Boolean, server_default="false"),
            sa.Column("collateral", sa.String(200)),
            sa.Column("prepayment_penalty", sa.Numeric(5, 2), server_default="0"),
            sa.Column("notes", sa.Text),
            sa.Column("extra_data", postgresql.JSONB, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_loans_user_id", "loans", ["user_id"])

    # ── assets ────────────────────────────────────────────────────────────────
    if not _table_exists("assets"):
        op.create_table(
            "assets",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("asset_type", sa.String(20), nullable=False),
            sa.Column("name", sa.String(200), nullable=False),
            sa.Column("description", sa.Text),
            sa.Column("purchase_price", sa.Numeric(15, 2)),
            sa.Column("current_value", sa.Numeric(15, 2), nullable=False),
            sa.Column("purchase_date", sa.Date),
            sa.Column("depreciation_rate", sa.Numeric(5, 2), server_default="0"),
            sa.Column("depreciation_method", sa.String(20), server_default="NONE"),
            sa.Column("location", sa.String(300)),
            sa.Column("area_sqft", sa.Numeric(10, 2)),
            sa.Column("registration_number", sa.String(50)),
            sa.Column("make_model", sa.String(200)),
            sa.Column("year_of_manufacture", sa.Integer),
            sa.Column("is_insured", sa.Boolean, server_default="false"),
            sa.Column("insurance_expiry", sa.Date),
            sa.Column("insurance_value", sa.Numeric(15, 2)),
            sa.Column("ownership_docs", sa.String(200)),
            sa.Column("is_mortgaged", sa.Boolean, server_default="false"),
            sa.Column("mortgage_outstanding", sa.Numeric(15, 2), server_default="0"),
            sa.Column("notes", sa.Text),
            sa.Column("extra_data", postgresql.JSONB, server_default="{}"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_assets_user_id", "assets", ["user_id"])

    # ── net_worth_snapshots ───────────────────────────────────────────────────
    if not _table_exists("net_worth_snapshots"):
        op.create_table(
            "net_worth_snapshots",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("snapshot_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("bank_balance", sa.Numeric(15, 2), server_default="0"),
            sa.Column("investment_value", sa.Numeric(15, 2), server_default="0"),
            sa.Column("asset_value", sa.Numeric(15, 2), server_default="0"),
            sa.Column("total_assets", sa.Numeric(15, 2), server_default="0"),
            sa.Column("credit_card_outstanding", sa.Numeric(15, 2), server_default="0"),
            sa.Column("loan_outstanding", sa.Numeric(15, 2), server_default="0"),
            sa.Column("total_liabilities", sa.Numeric(15, 2), server_default="0"),
            sa.Column("net_worth", sa.Numeric(15, 2), server_default="0"),
            sa.Column("change_amount", sa.Numeric(15, 2), server_default="0"),
            sa.Column("change_pct", sa.Numeric(8, 4), server_default="0"),
            sa.Column("notes", sa.Text),
            sa.Column("extra_data", postgresql.JSONB, server_default="{}"),
        )
        op.create_index("ix_net_worth_snapshots_user_id", "net_worth_snapshots", ["user_id"])


def downgrade() -> None:
    for table in ["net_worth_snapshots", "assets", "loans", "investments", "bank_accounts"]:
        op.drop_table(table)
