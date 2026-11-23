-- Lifeline Care Supply D1 schema (SQLite).
-- Individual investors only. No financial terms or commission rates are preset.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','restricted','closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investor_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  date_of_birth TEXT,
  country_code TEXT,
  preferred_currency TEXT,
  verification_state TEXT NOT NULL DEFAULT 'not_started' CHECK (verification_state IN ('not_started','pending','approved','rejected','needs_more_information')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  password_changed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  admin_user_id TEXT,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  CHECK ((user_id IS NOT NULL AND admin_user_id IS NULL) OR (user_id IS NULL AND admin_user_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  auth_subject TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','finance_admin','investment_manager','compliance_officer','support_admin')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  mfa_enrolled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS investment_packages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  currency TEXT NOT NULL,
  investment_amount TEXT NOT NULL,
  duration_days INTEGER,
  return_structure TEXT NOT NULL DEFAULT '{}',
  risk_disclosure TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','paused','retired')),
  created_by TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (duration_days IS NULL OR duration_days > 0)
);

CREATE TABLE IF NOT EXISTS investments (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  package_id TEXT REFERENCES investment_packages(id) ON DELETE RESTRICT,
  package_snapshot TEXT NOT NULL,
  principal_amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','pending_review','active','matured','cancelled','rejected')),
  terms_version TEXT NOT NULL,
  terms_accepted_at TEXT NOT NULL,
  started_at TEXT,
  matures_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (matures_at IS NULL OR started_at IS NULL OR matures_at > started_at)
);
CREATE INDEX IF NOT EXISTS investments_investor_created_idx ON investments(investor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS investments_status_idx ON investments(status);

CREATE TABLE IF NOT EXISTS ledger_accounts (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  account_code TEXT NOT NULL,
  currency TEXT NOT NULL,
  account_name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  CHECK (owner_user_id IS NOT NULL OR account_code LIKE 'PLATFORM_%'),
  UNIQUE (owner_user_id, account_code, currency)
);

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  transaction_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','posted','reversed','failed')),
  currency TEXT NOT NULL,
  related_entity_type TEXT,
  related_entity_id TEXT,
  description TEXT,
  created_by_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  created_by_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  posted_at TEXT,
  reversed_transaction_id TEXT REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  account_id TEXT NOT NULL REFERENCES ledger_accounts(id) ON DELETE RESTRICT,
  side TEXT NOT NULL CHECK (side IN ('debit','credit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_entries_transaction_idx ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS ledger_entries_account_created_idx ON ledger_entries(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS deposit_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  payment_method TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','completed','cancelled')),
  ledger_transaction_id TEXT UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  reviewed_by_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deposit_requests_investor_created_idx ON deposit_requests(investor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposit_requests_status_idx ON deposit_requests(status);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency TEXT NOT NULL,
  payout_method TEXT,
  payout_details_private TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','under_review','approved','rejected','completed','cancelled')),
  ledger_transaction_id TEXT UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  reviewed_by_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS withdrawal_requests_investor_created_idx ON withdrawal_requests(investor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawal_requests_status_idx ON withdrawal_requests(status);

CREATE TABLE IF NOT EXISTS verification_records (
  id TEXT PRIMARY KEY,
  investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  verification_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('not_started','pending','approved','rejected','needs_more_information')),
  private_document_key TEXT,
  reviewed_by_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  actor_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  CHECK (actor_admin_id IS NOT NULL OR actor_user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL,
  disabled_at TEXT,
  CHECK (code = upper(code)),
  CHECK ((is_active = 1 AND disabled_at IS NULL) OR is_active = 0)
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referral_code_id TEXT NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referred_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','qualified','rejected')),
  registered_at TEXT NOT NULL,
  qualified_at TEXT,
  reviewed_by_admin_id TEXT REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TEXT,
  review_note TEXT,
  CHECK (referrer_user_id <> referred_user_id),
  CHECK ((status = 'qualified' AND qualified_at IS NOT NULL) OR status <> 'qualified')
);
CREATE INDEX IF NOT EXISTS referrals_referrer_registered_idx ON referrals(referrer_user_id, registered_at DESC);
CREATE INDEX IF NOT EXISTS referrals_status_registered_idx ON referrals(status, registered_at DESC);

-- Financial controls still required before any live money movement:
-- balanced-ledger enforcement, currency consistency, immutable posted entries,
-- idempotent posting/reversal services, private payout-data encryption, strict
-- authorization and audit integrity. No package terms or rewards are configured.
