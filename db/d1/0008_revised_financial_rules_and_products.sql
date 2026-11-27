-- Lifeline Care Supply revised financial rules and 150-day product catalogue.
PRAGMA foreign_keys=ON;

INSERT OR REPLACE INTO platform_settings(setting_key,setting_value,updated_at) VALUES
('currency','UGX',datetime('now')),
('timezone','Africa/Kampala',datetime('now')),
('welcome_bonus_ugx','5000',datetime('now')),
('minimum_deposit_ugx','15000',datetime('now')),
('minimum_withdrawal_ugx','5000',datetime('now')),
('daily_checkin_bonus_ugx','200',datetime('now')),
('withdrawal_tax_bps','1500',datetime('now')),
('referral_level_1_bps','2500',datetime('now')),
('referral_level_2_bps','200',datetime('now')),
('referral_level_3_bps','100',datetime('now'));

CREATE TABLE IF NOT EXISTS daily_checkins (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  checkin_date TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
  ledger_transaction_id TEXT NOT NULL UNIQUE REFERENCES ledger_transactions(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id,checkin_date)
);
CREATE INDEX IF NOT EXISTS daily_checkins_date_idx ON daily_checkins(checkin_date);

INSERT INTO investment_packages
(id,code,name,description,currency,investment_amount,duration_days,return_structure,risk_disclosure,terms_version,status,published_at,created_at,updated_at)
VALUES
('lcs-prod-01','LCS-PRODUCT-01','Product 1','150-day fixed investment product','UGX','15000',150,'{"daily_income_ugx":3500,"total_return_ugx":525000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-02','LCS-PRODUCT-02','Product 2','150-day fixed investment product','UGX','30000',150,'{"daily_income_ugx":7000,"total_return_ugx":1050000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-03','LCS-PRODUCT-03','Product 3','150-day fixed investment product','UGX','45000',150,'{"daily_income_ugx":10500,"total_return_ugx":1575000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-04','LCS-PRODUCT-04','Product 4','150-day fixed investment product','UGX','60000',150,'{"daily_income_ugx":14000,"total_return_ugx":2100000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-05','LCS-PRODUCT-05','Product 5','150-day fixed investment product','UGX','75000',150,'{"daily_income_ugx":17500,"total_return_ugx":2625000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-06','LCS-PRODUCT-06','Product 6','150-day fixed investment product','UGX','90000',150,'{"daily_income_ugx":21000,"total_return_ugx":3150000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-07','LCS-PRODUCT-07','Product 7','150-day fixed investment product','UGX','115000',150,'{"daily_income_ugx":24500,"total_return_ugx":3675000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-08','LCS-PRODUCT-08','Product 8','150-day fixed investment product','UGX','130000',150,'{"daily_income_ugx":28000,"total_return_ugx":4200000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-09','LCS-PRODUCT-09','Product 9','150-day fixed investment product','UGX','145000',150,'{"daily_income_ugx":31500,"total_return_ugx":4725000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-prod-10','LCS-PRODUCT-10','Product 10','150-day fixed investment product','UGX','160000',150,'{"daily_income_ugx":35000,"total_return_ugx":5250000}','Returns are subject to published investment terms and operational risks.','LCS-2026-11-R2','published',datetime('now'),datetime('now'),datetime('now'))
ON CONFLICT(code) DO UPDATE SET
 name=excluded.name,description=excluded.description,currency=excluded.currency,
 investment_amount=excluded.investment_amount,duration_days=excluded.duration_days,
 return_structure=excluded.return_structure,risk_disclosure=excluded.risk_disclosure,
 terms_version=excluded.terms_version,status='published',updated_at=datetime('now');
