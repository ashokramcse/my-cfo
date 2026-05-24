"""Add TRANSFER_IN and TRANSFER_OUT to banktxtype enum

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-24
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE banktxtype ADD VALUE IF NOT EXISTS 'TRANSFER_IN'")
    op.execute("ALTER TYPE banktxtype ADD VALUE IF NOT EXISTS 'TRANSFER_OUT'")


def downgrade():
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass
