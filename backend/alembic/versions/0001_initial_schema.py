"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("username", sa.String(100), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(200)),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("is_superuser", sa.Boolean(), default=False),
        sa.Column("currency", sa.String(10), default="INR"),
        sa.Column("timezone", sa.String(50), default="Asia/Kolkata"),
        sa.Column("monthly_budget", sa.Numeric(12, 2), default=0),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column("last_login", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    # ── credit_cards ──────────────────────────────────────────────────────────
    op.create_table(
        "credit_cards",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("nickname", sa.String(100), nullable=False),
        sa.Column("bank_name", sa.String(100), nullable=False),
        sa.Column("card_name", sa.String(200)),
        sa.Column("last_four", sa.String(4)),
        sa.Column("network", sa.String(20), default="VISA"),
        sa.Column("status", sa.String(20), default="ACTIVE"),
        sa.Column("card_color", sa.String(20)),
        sa.Column("credit_limit", sa.Numeric(12, 2), default=0),
        sa.Column("available_limit", sa.Numeric(12, 2), default=0),
        sa.Column("current_outstanding", sa.Numeric(12, 2), default=0),
        sa.Column("interest_rate", sa.Numeric(6, 2), default=0),
        sa.Column("cash_advance_rate", sa.Numeric(6, 2), default=0),
        sa.Column("billing_cycle_day", sa.Integer(), default=1),
        sa.Column("due_date_day", sa.Integer(), default=25),
        sa.Column("statement_day", sa.Integer(), default=1),
        sa.Column("annual_fee", sa.Numeric(10, 2), default=0),
        sa.Column("joining_fee", sa.Numeric(10, 2), default=0),
        sa.Column("annual_fee_waiver_spend", sa.Numeric(12, 2), default=0),
        sa.Column("reward_program", sa.String(100)),
        sa.Column("reward_rate", sa.Numeric(5, 2), default=0),
        sa.Column("total_reward_points", sa.Integer(), default=0),
        sa.Column("lounge_access", sa.Boolean(), default=False),
        sa.Column("lounge_quota_quarterly", sa.Integer(), default=0),
        sa.Column("expiry_month", sa.Integer()),
        sa.Column("expiry_year", sa.Integer()),
        sa.Column("card_image_url", sa.String(500)),
        sa.Column("notes", sa.Text()),
        sa.Column("extra_data", postgresql.JSONB(), default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── statements ────────────────────────────────────────────────────────────
    op.create_table(
        "statements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_cards.id", ondelete="SET NULL")),
        sa.Column("filename", sa.String(500), nullable=False),
        sa.Column("file_path", sa.String(1000)),
        sa.Column("file_size", sa.Integer()),
        sa.Column("is_password_protected", sa.Boolean(), default=False),
        sa.Column("statement_date", sa.DateTime(timezone=True)),
        sa.Column("period_from", sa.DateTime(timezone=True)),
        sa.Column("period_to", sa.DateTime(timezone=True)),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("opening_balance", sa.Numeric(12, 2), default=0),
        sa.Column("closing_balance", sa.Numeric(12, 2), default=0),
        sa.Column("total_due", sa.Numeric(12, 2), default=0),
        sa.Column("minimum_due", sa.Numeric(12, 2), default=0),
        sa.Column("available_credit", sa.Numeric(12, 2), default=0),
        sa.Column("credit_limit", sa.Numeric(12, 2), default=0),
        sa.Column("cash_limit", sa.Numeric(12, 2), default=0),
        sa.Column("total_payments", sa.Numeric(12, 2), default=0),
        sa.Column("total_purchases", sa.Numeric(12, 2), default=0),
        sa.Column("total_emi", sa.Numeric(12, 2), default=0),
        sa.Column("total_fees", sa.Numeric(12, 2), default=0),
        sa.Column("total_interest", sa.Numeric(12, 2), default=0),
        sa.Column("reward_points_earned", sa.Integer(), default=0),
        sa.Column("reward_points_balance", sa.Integer(), default=0),
        sa.Column("status", sa.String(20), default="PENDING"),
        sa.Column("bank_detected", sa.String(50)),
        sa.Column("parse_error", sa.Text()),
        sa.Column("transaction_count", sa.Integer(), default=0),
        sa.Column("raw_data", postgresql.JSONB(), default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── transactions ──────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_cards.id", ondelete="SET NULL"), index=True),
        sa.Column("statement_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("statements.id", ondelete="SET NULL")),
        sa.Column("transaction_date", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("posted_date", sa.DateTime(timezone=True)),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("merchant_name", sa.String(200)),
        sa.Column("merchant_category", sa.String(50)),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(10), default="INR"),
        sa.Column("transaction_type", sa.String(20), default="PURCHASE"),
        sa.Column("category", sa.String(50), default="OTHER"),
        sa.Column("is_emi", sa.Boolean(), default=False),
        sa.Column("emi_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("emis.id", ondelete="SET NULL")),
        sa.Column("emi_installment_no", sa.Integer()),
        sa.Column("gst_amount", sa.Numeric(10, 2), default=0),
        sa.Column("cashback_amount", sa.Numeric(10, 2), default=0),
        sa.Column("reward_points", sa.Integer(), default=0),
        sa.Column("forex_markup", sa.Numeric(8, 2), default=0),
        sa.Column("is_recurring", sa.Boolean(), default=False),
        sa.Column("is_subscription", sa.Boolean(), default=False),
        sa.Column("is_duplicate", sa.Boolean(), default=False),
        sa.Column("is_suspicious", sa.Boolean(), default=False),
        sa.Column("is_manual", sa.Boolean(), default=False),
        sa.Column("is_excluded", sa.Boolean(), default=False),
        sa.Column("notes", sa.Text()),
        sa.Column("tags", postgresql.ARRAY(sa.String()), default=list),
        sa.Column("raw_description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── friends ───────────────────────────────────────────────────────────────
    op.create_table(
        "friends",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(20)),
        sa.Column("whatsapp", sa.String(20)),
        sa.Column("email", sa.String(255)),
        sa.Column("relation", sa.String(50), default="FRIEND"),
        sa.Column("avatar_color", sa.String(20)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("extra_data", postgresql.JSONB(), default=dict),
        sa.Column("total_emi_amount", sa.Numeric(12, 2), default=0),
        sa.Column("total_collected", sa.Numeric(12, 2), default=0),
        sa.Column("total_pending", sa.Numeric(12, 2), default=0),
        sa.Column("active_emi_count", sa.Integer(), default=0),
        sa.Column("risk_level", sa.String(10), default="LOW"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── emis ──────────────────────────────────────────────────────────────────
    op.create_table(
        "emis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("credit_cards.id", ondelete="SET NULL")),
        sa.Column("friend_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("friends.id", ondelete="SET NULL")),
        sa.Column("product_name", sa.String(300), nullable=False),
        sa.Column("merchant_name", sa.String(200)),
        sa.Column("purchase_date", sa.DateTime(timezone=True)),
        sa.Column("purchase_amount", sa.Numeric(12, 2), default=0),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("monthly_emi", sa.Numeric(10, 2), nullable=False),
        sa.Column("tenure_months", sa.Integer(), nullable=False),
        sa.Column("interest_rate", sa.Numeric(6, 2), default=0),
        sa.Column("is_no_cost_emi", sa.Boolean(), default=False),
        sa.Column("processing_fee", sa.Numeric(10, 2), default=0),
        sa.Column("total_interest", sa.Numeric(12, 2), default=0),
        sa.Column("paid_months", sa.Integer(), default=0),
        sa.Column("remaining_months", sa.Integer(), default=0),
        sa.Column("amount_paid", sa.Numeric(12, 2), default=0),
        sa.Column("amount_remaining", sa.Numeric(12, 2), default=0),
        sa.Column("start_date", sa.DateTime(timezone=True)),
        sa.Column("end_date", sa.DateTime(timezone=True)),
        sa.Column("next_due_date", sa.DateTime(timezone=True)),
        sa.Column("owner_type", sa.String(20), default="SELF"),
        sa.Column("user_share_percent", sa.Numeric(5, 2), default=100),
        sa.Column("status", sa.String(20), default="ACTIVE"),
        sa.Column("preclosure_date", sa.DateTime(timezone=True)),
        sa.Column("preclosure_charges", sa.Numeric(10, 2), default=0),
        sa.Column("amount_collected", sa.Numeric(12, 2), default=0),
        sa.Column("last_collection_date", sa.DateTime(timezone=True)),
        sa.Column("reminder_enabled", sa.Boolean(), default=True),
        sa.Column("reminder_day", sa.Integer(), default=1),
        sa.Column("notes", sa.Text()),
        sa.Column("extra_data", postgresql.JSONB(), default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── emi_payments ──────────────────────────────────────────────────────────
    op.create_table(
        "emi_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("emi_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("emis.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("installment_no", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True)),
        sa.Column("paid_date", sa.DateTime(timezone=True)),
        sa.Column("expected_amount", sa.Numeric(10, 2)),
        sa.Column("paid_amount", sa.Numeric(10, 2)),
        sa.Column("is_paid", sa.Boolean(), default=False),
        sa.Column("is_overdue", sa.Boolean(), default=False),
        sa.Column("late_fee", sa.Numeric(10, 2), default=0),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── categories ────────────────────────────────────────────────────────────
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("icon", sa.String(50)),
        sa.Column("color", sa.String(20)),
        sa.Column("parent_category", sa.String(100)),
        sa.Column("is_system", sa.Boolean(), default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── merchant_rules ────────────────────────────────────────────────────────
    op.create_table(
        "merchant_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("pattern", sa.String(500), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("merchant_name", sa.String(200)),
        sa.Column("is_regex", sa.Boolean(), default=False),
        sa.Column("priority", sa.Integer(), default=0),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── insights ──────────────────────────────────────────────────────────────
    op.create_table(
        "insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("insight_type", sa.String(50), nullable=False),
        sa.Column("severity", sa.String(10), default="INFO"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("action_label", sa.String(100)),
        sa.Column("action_url", sa.String(255)),
        sa.Column("is_read", sa.Boolean(), default=False),
        sa.Column("is_dismissed", sa.Boolean(), default=False),
        sa.Column("insight_data", postgresql.JSONB(), default=dict),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("resource_type", sa.String(100)),
        sa.Column("resource_id", sa.String(100)),
        sa.Column("ip_address", sa.String(50)),
        sa.Column("user_agent", sa.String(500)),
        sa.Column("changes", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("insights")
    op.drop_table("merchant_rules")
    op.drop_table("categories")
    op.drop_table("emi_payments")
    op.drop_table("transactions")
    op.drop_table("emis")
    op.drop_table("friends")
    op.drop_table("statements")
    op.drop_table("credit_cards")
    op.drop_table("users")
