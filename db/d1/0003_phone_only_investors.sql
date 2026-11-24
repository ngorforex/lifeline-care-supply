-- Investor registration now uses phone number and password only.
-- Names are optional profile information and are not collected at signup.
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;
CREATE TABLE investor_profiles_new (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  date_of_birth TEXT,
  country_code TEXT,
  preferred_currency TEXT,
  verification_state TEXT NOT NULL DEFAULT 'not_started' CHECK (verification_state IN ('not_started','pending','approved','rejected','needs_more_information')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO investor_profiles_new (
  user_id, first_name, middle_name, last_name, date_of_birth, country_code,
  preferred_currency, verification_state, created_at, updated_at
)
SELECT user_id, NULL, NULL, NULL, date_of_birth, country_code,
       preferred_currency, verification_state, created_at, updated_at
FROM investor_profiles;
DROP TABLE investor_profiles;
ALTER TABLE investor_profiles_new RENAME TO investor_profiles;
COMMIT;
PRAGMA foreign_keys = ON;
