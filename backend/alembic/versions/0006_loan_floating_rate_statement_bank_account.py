"""Add floating rate fields to loans and bank_account_id to statements

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade():
    # D-09: Floating rate fields on loans
    op.add_column('loans', sa.Column('is_floating_rate', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('loans', sa.Column('next_rate_reset_date', sa.Date(), nullable=True))
    op.add_column('loans', sa.Column('floating_rate_index', sa.String(50), nullable=True))

    # D-11: bank_account_id on statements
    op.add_column('statements', sa.Column('bank_account_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_statements_bank_account', 'statements', 'bank_accounts',
        ['bank_account_id'], ['id'], ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_statements_bank_account', 'statements', type_='foreignkey')
    op.drop_column('statements', 'bank_account_id')
    op.drop_column('loans', 'floating_rate_index')
    op.drop_column('loans', 'next_rate_reset_date')
    op.drop_column('loans', 'is_floating_rate')
