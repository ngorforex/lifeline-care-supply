-- Referral tracking foundation. No commission rate or reward liability is configured.
-- Apply only after reviewing in a non-production PostgreSQL database.

CREATE TYPE referral_status AS ENUM ('registered', 'qualified', 'rejected');

CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ,
  CHECK (code = upper(code)),
  CHECK ((is_active AND disabled_at IS NULL) OR (NOT is_active))
);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE RESTRICT,
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  referred_user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  status referral_status NOT NULL DEFAULT 'registered',
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  reviewed_by_admin_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  CHECK (referrer_user_id <> referred_user_id),
  CHECK ((status = 'qualified' AND qualified_at IS NOT NULL) OR status <> 'qualified')
);

CREATE INDEX referrals_referrer_registered_idx ON referrals(referrer_user_id, registered_at DESC);
CREATE INDEX referrals_status_registered_idx ON referrals(status, registered_at DESC);

-- Security and business-rule requirements before production:
-- 1. Generate high-entropy, non-guessable codes server-side; never accept a
--    client-supplied referrer_user_id as authority.
-- 2. Bind a referral exactly once at registration; reject self-referrals and
--    attempts to overwrite an existing referral relationship.
-- 3. Define and approve qualification rules before allowing status changes.
-- 4. Define reward rates, caps, timing, reversals and disclosures separately;
--    do not infer them from referral counts or qualification status.
-- 5. If rewards are approved, post them through balanced, idempotent ledger
--    transactions with auditable admin approval; never edit balances directly.
-- 6. Enforce access controls so investors see only their own referral records.
