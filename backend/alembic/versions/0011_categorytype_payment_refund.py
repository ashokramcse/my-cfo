"""Add PAYMENT and REFUND to categorytype enum

Revision ID: 0011
Revises: 0010
Create Date: 2026-05-24
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE categorytype ADD VALUE IF NOT EXISTS 'PAYMENT'")
    op.execute("ALTER TYPE categorytype ADD VALUE IF NOT EXISTS 'REFUND'")


def downgrade():
    pass  # PostgreSQL cannot remove enum values
