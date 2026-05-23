"""auth_sharing: user_sessions, user_relationships, share_permissions, share_invitations + user profile fields

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── Extend users table (idempotent via IF NOT EXISTS) ─────────────────────
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(3) DEFAULT 'IN'"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_bio TEXT"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true"))

    # ── user_sessions ─────────────────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
            device_name VARCHAR(255),
            user_agent TEXT,
            ip_address VARCHAR(45),
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_used_at TIMESTAMPTZ DEFAULT now(),
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions(user_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_sessions_refresh_token_hash ON user_sessions(refresh_token_hash)"))

    # ── user_relationships ────────────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS user_relationships (
            id UUID PRIMARY KEY,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            related_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL DEFAULT 'other',
            label VARCHAR(100),
            is_trusted BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_relationships_owner_id ON user_relationships(owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_user_relationships_related_user_id ON user_relationships(related_user_id)"))

    # ── share_permissions ─────────────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS share_permissions (
            id UUID PRIMARY KEY,
            owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            relationship_id UUID REFERENCES user_relationships(id) ON DELETE SET NULL,
            modules JSONB,
            access_type VARCHAR(50) NOT NULL DEFAULT 'full_read',
            expires_at TIMESTAMPTZ,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_share_permissions_owner_id ON share_permissions(owner_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_share_permissions_grantee_id ON share_permissions(grantee_id)"))

    # ── share_invitations ─────────────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS share_invitations (
            id UUID PRIMARY KEY,
            inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            invitee_identifier VARCHAR(255) NOT NULL,
            invitee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            invite_code VARCHAR(64) NOT NULL UNIQUE,
            modules JSONB,
            access_type VARCHAR(50) NOT NULL DEFAULT 'full_read',
            relationship_type VARCHAR(50) NOT NULL DEFAULT 'other',
            relationship_label VARCHAR(100),
            access_duration_days VARCHAR(20),
            message TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            share_permission_id UUID REFERENCES share_permissions(id) ON DELETE SET NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            responded_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_share_invitations_inviter_id ON share_invitations(inviter_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_share_invitations_invitee_user_id ON share_invitations(invitee_user_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_share_invitations_invite_code ON share_invitations(invite_code)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP TABLE IF EXISTS share_invitations"))
    conn.execute(text("DROP TABLE IF EXISTS share_permissions"))
    conn.execute(text("DROP TABLE IF EXISTS user_relationships"))
    conn.execute(text("DROP TABLE IF EXISTS user_sessions"))
    conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS is_verified"))
    conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS profile_bio"))
    conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS country"))
    conn.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS phone"))
