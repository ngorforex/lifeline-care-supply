-- Correct the catalogue in place: retain the original package records/codes so
-- existing product image mappings and any investment foreign keys remain valid.
UPDATE investment_packages SET
 name='Product 1',description='150-day fixed investment product',currency='UGX',
 investment_amount='15000',duration_days=150,
 return_structure='{"daily_income_ugx":3500,"total_return_ugx":525000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',
 terms_version='LCS-2026-11-R2',status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now')
WHERE code='THERMOMETER';

UPDATE investment_packages SET name='Product 2',description='150-day fixed investment product',currency='UGX',
 investment_amount='30000',duration_days=150,return_structure='{"daily_income_ugx":7000,"total_return_ugx":1050000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='BP-MONITOR';

UPDATE investment_packages SET name='Product 3',description='150-day fixed investment product',currency='UGX',
 investment_amount='45000',duration_days=150,return_structure='{"daily_income_ugx":10500,"total_return_ugx":1575000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='PULSE-OXIMETER';

UPDATE investment_packages SET name='Product 4',description='150-day fixed investment product',currency='UGX',
 investment_amount='60000',duration_days=150,return_structure='{"daily_income_ugx":14000,"total_return_ugx":2100000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='NEBULIZER';

UPDATE investment_packages SET name='Product 5',description='150-day fixed investment product',currency='UGX',
 investment_amount='75000',duration_days=150,return_structure='{"daily_income_ugx":17500,"total_return_ugx":2625000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='GLUCOMETER';

UPDATE investment_packages SET name='Product 6',description='150-day fixed investment product',currency='UGX',
 investment_amount='90000',duration_days=150,return_structure='{"daily_income_ugx":21000,"total_return_ugx":3150000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='ECG-MACHINE';

UPDATE investment_packages SET name='Product 7',description='150-day fixed investment product',currency='UGX',
 investment_amount='115000',duration_days=150,return_structure='{"daily_income_ugx":24500,"total_return_ugx":3675000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='PATIENT-MONITOR';

UPDATE investment_packages SET name='Product 8',description='150-day fixed investment product',currency='UGX',
 investment_amount='130000',duration_days=150,return_structure='{"daily_income_ugx":28000,"total_return_ugx":4200000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='MICROSCOPE';

UPDATE investment_packages SET name='Product 9',description='150-day fixed investment product',currency='UGX',
 investment_amount='145000',duration_days=150,return_structure='{"daily_income_ugx":31500,"total_return_ugx":4725000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='OXYGEN-CONCENTRATOR';

UPDATE investment_packages SET name='Product 10',description='150-day fixed investment product',currency='UGX',
 investment_amount='160000',duration_days=150,return_structure='{"daily_income_ugx":35000,"total_return_ugx":5250000}',
 risk_disclosure='Returns are subject to published investment terms and operational risks.',terms_version='LCS-2026-11-R2',
 status='published',published_at=COALESCE(published_at,datetime('now')),updated_at=datetime('now') WHERE code='ULTRASOUND-SCANNER';

-- Retire the accidental appended catalogue instead of deleting records that
-- might already be referenced by an investment.
UPDATE investment_packages SET status='retired',updated_at=datetime('now')
WHERE code LIKE 'LCS-PRODUCT-%';
