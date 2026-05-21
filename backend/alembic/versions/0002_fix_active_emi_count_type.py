"""fix active_emi_count to integer

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        'friends', 'active_emi_count',
        existing_type=sa.Numeric(precision=4, scale=0),
        type_=sa.Integer(),
        existing_nullable=True,
        postgresql_using='active_emi_count::integer',
    )


def downgrade() -> None:
    op.alter_column(
        'friends', 'active_emi_count',
        existing_type=sa.Integer(),
        type_=sa.Numeric(precision=4, scale=0),
        existing_nullable=True,
    )
