-- Approved Lifeline Care Supply fixed investment catalogue.
-- Existing image assets are reused from /product-01.jpg through /product-10.jpg.
INSERT INTO investment_packages
(id, code, name, description, currency, investment_amount, duration_days, return_structure, risk_disclosure, terms_version, status, published_at, created_at, updated_at)
VALUES
('lcs-pkg-01','THERMOMETER','Digital Thermometer','Medical equipment investment package','UGX','10000',90,'{"daily_income_ugx":2000,"total_return_ugx":180000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-02','BP-MONITOR','Blood Pressure Monitor','Medical equipment investment package','UGX','15000',90,'{"daily_income_ugx":3000,"total_return_ugx":270000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-03','PULSE-OXIMETER','Pulse Oximeter','Medical equipment investment package','UGX','20000',90,'{"daily_income_ugx":4000,"total_return_ugx":360000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-04','NEBULIZER','Nebulizer','Medical equipment investment package','UGX','30000',90,'{"daily_income_ugx":6000,"total_return_ugx":540000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-05','GLUCOMETER','Glucometer','Medical equipment investment package','UGX','50000',90,'{"daily_income_ugx":8000,"total_return_ugx":720000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-06','ECG-MACHINE','ECG Machine','Medical equipment investment package','UGX','80000',90,'{"daily_income_ugx":11000,"total_return_ugx":990000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-07','PATIENT-MONITOR','Patient Monitor','Medical equipment investment package','UGX','100000',90,'{"daily_income_ugx":20000,"total_return_ugx":1800000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-08','MICROSCOPE','Microscope','Medical equipment investment package','UGX','150000',90,'{"daily_income_ugx":30000,"total_return_ugx":2700000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-09','OXYGEN-CONCENTRATOR','Oxygen Concentrator','Medical equipment investment package','UGX','200000',90,'{"daily_income_ugx":40000,"total_return_ugx":3600000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now')),
('lcs-pkg-10','ULTRASOUND-SCANNER','Ultrasound Scanner','Medical equipment investment package','UGX','250000',90,'{"daily_income_ugx":48000,"total_return_ugx":4320000}', 'Returns are subject to the published investment terms and operational risks.','LCS-2026-01','published',datetime('now'),datetime('now'),datetime('now'))
ON CONFLICT(code) DO UPDATE SET
 name=excluded.name, description=excluded.description, currency=excluded.currency,
 investment_amount=excluded.investment_amount, duration_days=excluded.duration_days,
 return_structure=excluded.return_structure, risk_disclosure=excluded.risk_disclosure,
 terms_version=excluded.terms_version, status='published', updated_at=datetime('now');
