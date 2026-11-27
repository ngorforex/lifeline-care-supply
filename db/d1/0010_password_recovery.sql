-- Yoola Verify-backed password recovery challenges.
-- OTP values are never stored by Lifeline; Yoola owns OTP generation and verification.
CREATE TABLE IF NOT EXISTS password_reset_challenges (
  id TEXT PRIMARY KEY,
  challenge_hash TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL,
  yoola_request_id TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS password_reset_challenges_expiry_idx
  ON password_reset_challenges(expires_at);
CREATE INDEX IF NOT EXISTS password_reset_challenges_user_idx
  ON password_reset_challenges(user_id, created_at DESC);
