-- Lifeline Care Supply: initial relational schema draft.
-- PostgreSQL. Review and test in a non-production database before applying.
-- No investment amounts, return rates, fees, taxes or eligibility rules are preset.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE investor_status AS ENUM ('pending', 'active', 'restricted', 'closed');
CREATE TYPE verification_status AS ENUM ('not_started', 'pending', 'approved', 'rejected', 'needs_more_information');
CREATE TYPE admin_role AS ENUM ('super_admin', 'finance_admin', 'investment_manager', 'compliance_officer', 'support_admin');
CREATE TYPE package_status AS ENUM ('draft', 'published', 'paused', 'retired');
CREATE TYPE investment_status AS ENUM ('pending_payment', 'pending_review', 'active', 'matured', 'cancelled', 'rejected');
CREATE TYPE request_status AS ENUM ('pending', 'under_review', 'approved', 'rejected', 'completed', 'cancelled');
CREATE TYPE ledger_status AS ENUM ('pending', 'posted', 'reversed', 'failed');
CREATE TYPE ledger_entry_side AS ENUM ('debit', 'credit');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE,
  phone_e164 TEXT UNIQUE,
  status investor_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL)
);

CREATE TABLE investor_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth DATE,
  country_code CHAR(2),
  preferred_currency CHAR(3),
  verification_state verification_status NOT NULL DEFAULT 'not_started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_subject TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role admin_role NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  mfa_enrolled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investment_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  currency CHAR(3) NOT NULL,
  investment_amount NUMERIC(20,2) NOT NULL CHECK (investment_amount > 0),
  duration_days INTEGER CHECK (duration_days IS NULL OR duration_days > 0),
  return_structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_disclosure TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  status package_status NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  package_id UUID REFERENCES investment_packages(id) ON DELETE RESTRICT,
  package_snapshot JSONB NOT NULL,
  principal_amount NUMERIC(20,2) NOT NULL CHECK (principal_amount > 0),
  currency CHAR(3) NOT NULL,
  status investment_status NOT NULL DEFAULT 'pending_payment',
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  matures_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (matures_at IS NULL OR started_at IS NULL OR matures_at > started_at)
);

CREATE INDEX investments_investor_created_idx ON investments(investor_id, created_at DESC);
CREATE INDEX investments_status_idx ON investments(status);

CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  currency CHAR(3) NOT NULL,
  account_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (owner_user_id IS NOT NULL OR account_code LIKE 'PLATFORM_%'),
  UNIQUE (owner_user_id, account_code, currency)
);

CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  transaction_type TEXT NOT NULL,
  status ledger_status NOT NULL DEFAULT 'pending',
  currency CHAR(3) NOT NULL,
  related_entity_type TEXT,
  related_entity_id UUID,
  description TEXT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  created_by_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  posted_at TIMESTAMPTZ,
  reversed_transaction_id UUID REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  side ledger_entry_side NOT NULL,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ledger_entries_transaction_idx ON ledger_entries(transaction_id);
CREATE INDEX ledger_entries_account_created_idx ON ledger_entries(account_id, created_at DESC);

CREATE TABLE deposit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  payment_method TEXT,
  provider_reference TEXT,
  status request_status NOT NULL DEFAULT 'pending',
  ledger_transaction_id UUID UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX deposit_requests_investor_created_idx ON deposit_requests(investor_id, created_at DESC);
CREATE INDEX deposit_requests_status_idx ON deposit_requests(status);

CREATE TABLE withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount NUMERIC(20,2) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL,
  payout_method TEXT,
  payout_details_private JSONB,
  status request_status NOT NULL DEFAULT 'pending',
  ledger_transaction_id UUID UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX withdrawal_requests_investor_created_idx ON withdrawal_requests(investor_id, created_at DESC);
CREATE INDEX withdrawal_requests_status_idx ON withdrawal_requests(status);

CREATE TABLE verification_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verification_type TEXT NOT NULL,
  status verification_status NOT NULL DEFAULT 'pending',
  private_document_key TEXT,
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (actor_admin_id IS NOT NULL OR actor_user_id IS NOT NULL)
);

CREATE INDEX audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_logs_created_idx ON audit_logs(created_at DESC);

-- Implementation requirements before production:
-- 1. Add a deferred constraint trigger that rejects posted ledger transactions
--    unless debit and credit totals balance exactly per currency.
-- 2. Enforce account/entry/transaction currency consistency.
-- 3. Restrict updates/deletes to posted ledger entries; use compensating reversals.
-- 4. Add database row-level security or equivalent API authorization policies.
-- 5. Encrypt and tightly restrict payout_details_private and document references.
-- 6. Add retention, backup, restore and audit-integrity controls.
-- 7. Keep financial timestamps timezone-aware and render business time in EAT.
