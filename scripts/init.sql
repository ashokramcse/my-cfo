-- CC-Bill Database Initialization
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Enums
CREATE TYPE card_network AS ENUM ('VISA', 'MASTERCARD', 'AMEX', 'RUPAY', 'DINERS', 'OTHER');
CREATE TYPE card_status AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED', 'CLOSED');
CREATE TYPE transaction_type AS ENUM ('PURCHASE', 'EMI', 'CASH_ADVANCE', 'PAYMENT', 'REFUND', 'FEE', 'INTEREST', 'REWARD_REDEMPTION', 'OTHER');
CREATE TYPE emi_status AS ENUM ('ACTIVE', 'COMPLETED', 'PRECLOSED', 'DEFAULTED');
CREATE TYPE emi_owner_type AS ENUM ('SELF', 'FRIEND', 'FAMILY', 'OFFICE', 'SHARED');
CREATE TYPE statement_status AS ENUM ('PENDING', 'PROCESSING', 'PARSED', 'FAILED');
CREATE TYPE category_type AS ENUM ('FOOD', 'FUEL', 'SHOPPING', 'RENT', 'EMI', 'TRAVEL', 'UTILITIES', 'ENTERTAINMENT', 'INVESTMENT', 'HEALTHCARE', 'SUBSCRIPTION', 'EDUCATION', 'GROCERIES', 'DINING', 'CASH_WITHDRAWAL', 'TRANSFER', 'FEES', 'OTHER');

-- Indexes will be created by Alembic migrations
-- This file sets up extensions and types only

SELECT 'CC-Bill database initialized successfully' AS status;
