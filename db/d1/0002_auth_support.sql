-- Authentication support: phone ownership is not verified until an explicit
-- SMS verification flow/provider is configured. Registration does not collect email.
ALTER TABLE users ADD COLUMN phone_verified_at TEXT;

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_updated_idx ON auth_rate_limits(updated_at);
