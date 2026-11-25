-- Withdrawal tax and provider net payout amounts.
-- Applied to the production D1 database on 2026-11-25.
ALTER TABLE withdrawal_requests ADD COLUMN payout_amount_minor INTEGER;
ALTER TABLE withdrawal_requests ADD COLUMN tax_amount_minor INTEGER NOT NULL DEFAULT 0;
INSERT OR REPLACE INTO platform_settings(setting_key,setting_value,updated_at)
VALUES('withdrawal_tax_bps','1500',datetime('now'));
