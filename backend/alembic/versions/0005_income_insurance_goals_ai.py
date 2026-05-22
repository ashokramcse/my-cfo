"""Income, Insurance, Goals, AI Conversations tables

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def _table_exists(name):
    from sqlalchemy import inspect as sa_inspect
    return sa_inspect(op.get_bind()).has_table(name)


def upgrade():
    # ── income_sources ────────────────────────────────────────────────────────
    if not _table_exists("income_sources"):
        op.create_table(
            "income_sources",
            sa.Column("id",              postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",         postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name",            sa.String(200), nullable=False),
            sa.Column("income_type",     sa.String(20), nullable=False),
            sa.Column("employer",        sa.String(200)),
            sa.Column("monthly_amount",  sa.Numeric(15, 2), nullable=False),
            sa.Column("is_variable",     sa.Boolean, server_default="false"),
            sa.Column("variable_min",    sa.Numeric(15, 2)),
            sa.Column("variable_max",    sa.Numeric(15, 2)),
            sa.Column("tax_deducted_pct",sa.Numeric(5, 2), server_default="0"),
            sa.Column("is_active",       sa.Boolean, server_default="true"),
            sa.Column("start_date",      sa.Date),
            sa.Column("notes",           sa.Text),
            sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_income_sources_user", "income_sources", ["user_id"])

    # ── income_entries ────────────────────────────────────────────────────────
    if not _table_exists("income_entries"):
        op.create_table(
            "income_entries",
            sa.Column("id",         postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",    postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_id",  postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("income_sources.id", ondelete="CASCADE"), nullable=False),
            sa.Column("entry_date", sa.Date, nullable=False),
            sa.Column("amount",     sa.Numeric(15, 2), nullable=False),
            sa.Column("notes",      sa.Text),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_income_entries_user_date", "income_entries", ["user_id", "entry_date"])

    # ── insurances ────────────────────────────────────────────────────────────
    if not _table_exists("insurances"):
        op.create_table(
            "insurances",
            sa.Column("id",                 postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",            postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("insurance_type",     sa.String(20), nullable=False),
            sa.Column("policy_name",        sa.String(200), nullable=False),
            sa.Column("insurer",            sa.String(200), nullable=False),
            sa.Column("policy_number",      sa.String(100)),
            sa.Column("premium_amount",     sa.Numeric(12, 2), nullable=False),
            sa.Column("premium_frequency",  sa.String(20), server_default="YEARLY"),
            sa.Column("sum_assured",        sa.Numeric(15, 2)),
            sa.Column("cover_amount",       sa.Numeric(15, 2)),
            sa.Column("start_date",         sa.Date),
            sa.Column("end_date",           sa.Date),
            sa.Column("renewal_date",       sa.Date),
            sa.Column("beneficiary",        sa.String(300)),
            sa.Column("is_active",          sa.Boolean, server_default="true"),
            sa.Column("notes",              sa.Text),
            sa.Column("extra_data",         postgresql.JSONB, server_default="{}"),
            sa.Column("created_at",         sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",         sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_insurances_user", "insurances", ["user_id"])

    # ── goals ─────────────────────────────────────────────────────────────────
    if not _table_exists("goals"):
        op.create_table(
            "goals",
            sa.Column("id",                   postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",              postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name",                 sa.String(200), nullable=False),
            sa.Column("goal_type",            sa.String(30), nullable=False),
            sa.Column("target_amount",        sa.Numeric(15, 2), nullable=False),
            sa.Column("current_amount",       sa.Numeric(15, 2), server_default="0"),
            sa.Column("monthly_contribution", sa.Numeric(12, 2), server_default="0"),
            sa.Column("target_date",          sa.Date),
            sa.Column("priority",             sa.String(10), server_default="MEDIUM"),
            sa.Column("status",               sa.String(15), server_default="ACTIVE"),
            sa.Column("icon_color",           sa.String(20), server_default="#F59E0B"),
            sa.Column("notes",                sa.Text),
            sa.Column("created_at",           sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",           sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
        op.create_index("ix_goals_user", "goals", ["user_id"])

    # ── ai_conversations ──────────────────────────────────────────────────────
    if not _table_exists("ai_conversations"):
        op.create_table(
            "ai_conversations",
            sa.Column("id",               postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column("user_id",          postgresql.UUID(as_uuid=True),
                      sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.Column("session_id",       postgresql.UUID(as_uuid=True), nullable=False),
            sa.Column("role",             sa.String(15), nullable=False),
            sa.Column("content",          sa.Text, nullable=False),
            sa.Column("context_snapshot", postgresql.JSONB, server_default="{}"),
            sa.Column("model_used",       sa.String(100)),
            sa.Column("created_at",       sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index("ix_ai_conv_user_session", "ai_conversations", ["user_id", "session_id"])
        op.create_index("ix_ai_conv_user_date",    "ai_conversations", ["user_id", "created_at"])


def downgrade():
    op.drop_table("ai_conversations")
    op.drop_table("goals")
    op.drop_table("insurances")
    op.drop_table("income_entries")
    op.drop_table("income_sources")
