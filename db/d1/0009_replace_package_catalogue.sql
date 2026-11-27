-- Replace the old visible package catalogue in place.
-- Preserve the canonical package IDs/codes so historical investments and image mappings remain valid.
UPDATE investment_packages
SET status='retired', updated_at=datetime('now')
WHERE code NOT IN (
 'THERMOMETER','BP-MONITOR','PULSE-OXIMETER','NEBULIZER','GLUCOMETER',
 'ECG-MACHINE','PATIENT-MONITOR','MICROSCOPE','OXYGEN-CONCENTRATOR','ULTRASOUND-SCANNER'
);

UPDATE investment_packages SET
 name='Digital Thermometer',
 description='Digital infrared thermometer',
 investment_amount='15000', duration_days=150,
 return_structure='{"daily_income_ugx":3500,"total_return_ugx":525000}',
 status='published', updated_at=datetime('now')
WHERE code='THERMOMETER';

UPDATE investment_packages SET
 name='Blood Pressure Monitor',
 description='Digital blood pressure monitor',
 investment_amount='30000', duration_days=150,
 return_structure='{"daily_income_ugx":7000,"total_return_ugx":1050000}',
 status='published', updated_at=datetime('now')
WHERE code='BP-MONITOR';

UPDATE investment_packages SET
 name='Pulse Oximeter',
 description='Finger pulse oximeter',
 investment_amount='45000', duration_days=150,
 return_structure='{"daily_income_ugx":10500,"total_return_ugx":1575000}',
 status='published', updated_at=datetime('now')
WHERE code='PULSE-OXIMETER';

UPDATE investment_packages SET
 name='Nebulizer',
 description='Medical nebulizer device',
 investment_amount='60000', duration_days=150,
 return_structure='{"daily_income_ugx":14000,"total_return_ugx":2100000}',
 status='published', updated_at=datetime('now')
WHERE code='NEBULIZER';

UPDATE investment_packages SET
 name='Glucometer',
 description='Blood glucose monitoring device',
 investment_amount='75000', duration_days=150,
 return_structure='{"daily_income_ugx":17500,"total_return_ugx":2625000}',
 status='published', updated_at=datetime('now')
WHERE code='GLUCOMETER';

UPDATE investment_packages SET
 name='ECG Machine',
 description='Electrocardiogram monitoring machine',
 investment_amount='90000', duration_days=150,
 return_structure='{"daily_income_ugx":21000,"total_return_ugx":3150000}',
 status='published', updated_at=datetime('now')
WHERE code='ECG-MACHINE';

UPDATE investment_packages SET
 name='Patient Monitor',
 description='Multiparameter patient monitor',
 investment_amount='115000', duration_days=150,
 return_structure='{"daily_income_ugx":24500,"total_return_ugx":3675000}',
 status='published', updated_at=datetime('now')
WHERE code='PATIENT-MONITOR';

UPDATE investment_packages SET
 name='Microscope',
 description='Laboratory microscope',
 investment_amount='130000', duration_days=150,
 return_structure='{"daily_income_ugx":28000,"total_return_ugx":4200000}',
 status='published', updated_at=datetime('now')
WHERE code='MICROSCOPE';

UPDATE investment_packages SET
 name='Oxygen Concentrator',
 description='Medical oxygen concentrator',
 investment_amount='145000', duration_days=150,
 return_structure='{"daily_income_ugx":31500,"total_return_ugx":4725000}',
 status='published', updated_at=datetime('now')
WHERE code='OXYGEN-CONCENTRATOR';

UPDATE investment_packages SET
 name='Ultrasound Scanner',
 description='Medical diagnostic ultrasound scanner',
 investment_amount='160000', duration_days=150,
 return_structure='{"daily_income_ugx":35000,"total_return_ugx":5250000}',
 status='published', updated_at=datetime('now')
WHERE code='ULTRASOUND-SCANNER';
