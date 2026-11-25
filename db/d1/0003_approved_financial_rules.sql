PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS platform_settings(setting_key TEXT PRIMARY KEY,setting_value TEXT NOT NULL,updated_at TEXT NOT NULL);
INSERT OR REPLACE INTO platform_settings VALUES
('currency','UGX','2026-11-24T00:00:00Z'),('timezone','Africa/Kampala','2026-11-24T00:00:00Z'),
('welcome_bonus_ugx','2000','2026-11-24T00:00:00Z'),('minimum_deposit_ugx','10000','2026-11-24T00:00:00Z'),
('minimum_withdrawal_ugx','2000','2026-11-24T00:00:00Z'),
('withdrawal_eligibility','successful_deposit_and_at_least_one_active_investment','2026-11-24T00:00:00Z'),
('earnings_schedule','daily_at_00:00_Africa/Kampala','2026-11-24T00:00:00Z'),
('referral_commission_basis','first_successful_qualifying_deposit','2026-11-24T00:00:00Z'),
('referral_level_1_bps','2500','2026-11-24T00:00:00Z'),('referral_level_2_bps','200','2026-11-24T00:00:00Z'),('referral_level_3_bps','100','2026-11-24T00:00:00Z');
INSERT OR IGNORE INTO ledger_accounts(id,owner_user_id,account_code,currency,account_name,is_active,created_at) VALUES
('platform-welcome-bonus-expense',NULL,'PLATFORM_WELCOME_BONUS_EXPENSE','UGX','Welcome bonus expense',1,'2026-11-24T00:00:00Z'),
('platform-deposit-clearing',NULL,'PLATFORM_DEPOSIT_CLEARING','UGX','ObPay deposit clearing',1,'2026-11-24T00:00:00Z'),
('platform-investment-earnings-expense',NULL,'PLATFORM_INVESTMENT_EARNINGS_EXPENSE','UGX','Investment earnings expense',1,'2026-11-24T00:00:00Z'),
('platform-referral-expense',NULL,'PLATFORM_REFERRAL_EXPENSE','UGX','Referral commission expense',1,'2026-11-24T00:00:00Z'),
('platform-withdrawal-clearing',NULL,'PLATFORM_WITHDRAWAL_CLEARING','UGX','ObPay withdrawal clearing',1,'2026-11-24T00:00:00Z');
CREATE TABLE IF NOT EXISTS provider_webhook_events(id TEXT PRIMARY KEY,provider TEXT NOT NULL,provider_event_id TEXT NOT NULL,provider_reference TEXT,event_type TEXT NOT NULL,payload_hash TEXT NOT NULL,received_at TEXT NOT NULL,processed_at TEXT,UNIQUE(provider,provider_event_id));
CREATE TABLE IF NOT EXISTS investment_earnings(id TEXT PRIMARY KEY,investment_id TEXT NOT NULL REFERENCES investments(id) ON DELETE RESTRICT,investor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,earning_date TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor>0),ledger_transaction_id TEXT NOT NULL UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,created_at TEXT NOT NULL,UNIQUE(investment_id,earning_date));
CREATE TABLE IF NOT EXISTS referral_commissions(id TEXT PRIMARY KEY,deposit_request_id TEXT NOT NULL REFERENCES deposit_requests(id) ON DELETE RESTRICT,referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,level INTEGER NOT NULL CHECK(level BETWEEN 1 AND 3),rate_bps INTEGER NOT NULL CHECK(rate_bps>0),amount_minor INTEGER NOT NULL CHECK(amount_minor>0),ledger_transaction_id TEXT NOT NULL UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,created_at TEXT NOT NULL,UNIQUE(deposit_request_id,level));
ALTER TABLE deposit_requests ADD COLUMN provider_transaction_id TEXT;
ALTER TABLE deposit_requests ADD COLUMN payment_phone_e164 TEXT;
ALTER TABLE deposit_requests ADD COLUMN provider_status TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS deposit_provider_transaction_unique ON deposit_requests(provider_transaction_id) WHERE provider_transaction_id IS NOT NULL;
ALTER TABLE withdrawal_requests ADD COLUMN payout_phone_e164 TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN provider_reference TEXT;
ALTER TABLE withdrawal_requests ADD COLUMN provider_status TEXT;
CREATE INDEX IF NOT EXISTS investment_earnings_date_idx ON investment_earnings(earning_date);
CREATE INDEX IF NOT EXISTS referral_commissions_referrer_idx ON referral_commissions(referrer_user_id,created_at DESC);
INSERT OR IGNORE INTO investment_packages(id,code,name,description,currency,investment_amount,duration_days,return_structure,risk_disclosure,terms_version,status,published_at,created_at,updated_at) VALUES
('pkg-thermometer','THERMOMETER','Digital Thermometer','Fixed 90-day package','UGX','10000',90,'{"daily_income_ugx":2000,"total_return_ugx":180000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-bp-monitor','BP-MONITOR','Blood Pressure Monitor','Fixed 90-day package','UGX','15000',90,'{"daily_income_ugx":3000,"total_return_ugx":270000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-pulse-oximeter','PULSE-OXIMETER','Pulse Oximeter','Fixed 90-day package','UGX','20000',90,'{"daily_income_ugx":4000,"total_return_ugx":360000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-nebulizer','NEBULIZER','Nebulizer','Fixed 90-day package','UGX','30000',90,'{"daily_income_ugx":6000,"total_return_ugx":540000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-glucometer','GLUCOMETER','Glucometer','Fixed 90-day package','UGX','50000',90,'{"daily_income_ugx":8000,"total_return_ugx":720000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-ecg-machine','ECG-MACHINE','ECG Machine','Fixed 90-day package','UGX','80000',90,'{"daily_income_ugx":11000,"total_return_ugx":990000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-patient-monitor','PATIENT-MONITOR','Patient Monitor','Fixed 90-day package','UGX','100000',90,'{"daily_income_ugx":20000,"total_return_ugx":1800000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-microscope','MICROSCOPE','Microscope','Fixed 90-day package','UGX','150000',90,'{"daily_income_ugx":30000,"total_return_ugx":2700000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-oxygen-concentrator','OXYGEN-CONCENTRATOR','Oxygen Concentrator','Fixed 90-day package','UGX','200000',90,'{"daily_income_ugx":40000,"total_return_ugx":3600000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z'),
('pkg-ultrasound-scanner','ULTRASOUND-SCANNER','Ultrasound Scanner','Fixed 90-day package','UGX','250000',90,'{"daily_income_ugx":48000,"total_return_ugx":4320000}','Projected earnings are not guaranteed.','LCS-2026-11-24','published','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z','2026-11-24T00:00:00Z');
