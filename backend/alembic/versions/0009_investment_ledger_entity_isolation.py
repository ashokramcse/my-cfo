"""
0009 — Investment Transaction Ledger + Entity Isolation + BankTx enrichment

Changes:
  P0: investment_transactions table (full portfolio ledger)
  P0: bank_transactions — linked_*_id FKs, status, TDS fields
  P1: investments — maturity_date, coupon_rate, price_source
  P2: financial_entities table
  P2: assets — RECEIVABLE type, counterparty fields, entity_id
  P2: investments, bank_accounts, loans — entity_id column
"""

from alembic import op
from sqlalchemy import text

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. financial_entities ─────────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS financial_entities (
            id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            entity_type  VARCHAR(50) NOT NULL DEFAULT 'PERSONAL',
            entity_name  VARCHAR(200) NOT NULL,
            pan          VARCHAR(10),
            gstin        VARCHAR(15),
            cin          VARCHAR(21),
            description  TEXT,
            is_default   BOOLEAN DEFAULT false,
            is_active    BOOLEAN DEFAULT true,
            created_at   TIMESTAMPTZ DEFAULT now(),
            updated_at   TIMESTAMPTZ
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_financial_entities_user_id ON financial_entities(user_id)"))

    # ── 2. investment_transactions ────────────────────────────────────────────
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS investment_transactions (
            id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            investment_id       UUID NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
            user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

            tx_type             VARCHAR(20) NOT NULL,
            tx_date             DATE NOT NULL,
            units               NUMERIC(15,4) NOT NULL DEFAULT 0,
            price_per_unit      NUMERIC(15,4) DEFAULT 0,
            amount              NUMERIC(15,2) DEFAULT 0,

            settlement_date     DATE,
            linked_bank_tx_id   UUID REFERENCES bank_transactions(id) ON DELETE SET NULL,

            cost_basis          NUMERIC(15,2),
            holding_days        INTEGER,

            tax_category        VARCHAR(30),
            realized_gain       NUMERIC(15,2),
            is_ltcg             BOOLEAN,
            tax_rate            NUMERIC(5,2),
            estimated_tax       NUMERIC(12,2),
            grandfathering_price NUMERIC(15,4),

            split_ratio         VARCHAR(20),
            pre_split_units     NUMERIC(15,4),
            post_split_units    NUMERIC(15,4),

            is_sip_installment  BOOLEAN DEFAULT false,
            sip_installment_no  INTEGER,

            nav_source          VARCHAR(50) DEFAULT 'MANUAL',
            notes               TEXT,
            extra_data          JSONB DEFAULT '{}',

            created_at          TIMESTAMPTZ DEFAULT now(),
            updated_at          TIMESTAMPTZ
        )
    """))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_inv_tx_investment_id ON investment_transactions(investment_id)"))
    conn.execute(text("CREATE INDEX IF NOT EXISTS ix_inv_tx_user_date     ON investment_transactions(user_id, tx_date)"))

    # ── 3. bank_transactions — new columns ───────────────────────────────────
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SETTLED'"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS gross_amount NUMERIC(15,2)"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS tds_amount NUMERIC(15,2) DEFAULT 0"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS tds_section VARCHAR(20)"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS linked_investment_tx_id UUID"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS linked_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL"))
    conn.execute(text("ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS linked_card_id UUID REFERENCES credit_cards(id) ON DELETE SET NULL"))

    # ── 4. investments — new columns ─────────────────────────────────────────
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS maturity_date DATE"))
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS coupon_rate NUMERIC(6,3)"))
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS last_coupon_date DATE"))
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS next_coupon_date DATE"))
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS price_source VARCHAR(50) DEFAULT 'MANUAL'"))
    conn.execute(text("ALTER TABLE investments ADD COLUMN IF NOT EXISTS entity_id UUID"))

    # ── 5. assets — RECEIVABLE type + counterparty fields ────────────────────
    # Add RECEIVABLE to the enum if it doesn't exist
    conn.execute(text("ALTER TYPE assettype ADD VALUE IF NOT EXISTS 'RECEIVABLE'"))
    conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS counterparty_name VARCHAR(200)"))
    conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS counterparty_entity_id UUID"))
    conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS due_date DATE"))
    conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(6,3)"))
    conn.execute(text("ALTER TABLE assets ADD COLUMN IF NOT EXISTS entity_id UUID"))

    # ── 6. entity_id on other tables ─────────────────────────────────────────
    conn.execute(text("ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS entity_id UUID"))
    conn.execute(text("ALTER TABLE loans ADD COLUMN IF NOT EXISTS entity_id UUID"))

    # ── 7. Seed a default PERSONAL entity for every existing user ─────────────
    conn.execute(text("""
        INSERT INTO financial_entities (id, user_id, entity_type, entity_name, is_default, is_active)
        SELECT gen_random_uuid(), id, 'PERSONAL', 'Personal', true, true
        FROM users
        WHERE NOT EXISTS (
            SELECT 1 FROM financial_entities fe WHERE fe.user_id = users.id
        )
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(text("DROP TABLE IF EXISTS investment_transactions"))
    conn.execute(text("DROP TABLE IF EXISTS financial_entities"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS status"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS gross_amount"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS tds_amount"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS tds_section"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS linked_investment_tx_id"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS linked_loan_id"))
    conn.execute(text("ALTER TABLE bank_transactions DROP COLUMN IF EXISTS linked_card_id"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS maturity_date"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS coupon_rate"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS last_coupon_date"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS next_coupon_date"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS price_source"))
    conn.execute(text("ALTER TABLE investments DROP COLUMN IF EXISTS entity_id"))
    conn.execute(text("ALTER TABLE assets DROP COLUMN IF EXISTS counterparty_name"))
    conn.execute(text("ALTER TABLE assets DROP COLUMN IF EXISTS counterparty_entity_id"))
    conn.execute(text("ALTER TABLE assets DROP COLUMN IF EXISTS due_date"))
    conn.execute(text("ALTER TABLE assets DROP COLUMN IF EXISTS interest_rate"))
    conn.execute(text("ALTER TABLE assets DROP COLUMN IF EXISTS entity_id"))
    conn.execute(text("ALTER TABLE bank_accounts DROP COLUMN IF EXISTS entity_id"))
    conn.execute(text("ALTER TABLE loans DROP COLUMN IF EXISTS entity_id"))
