-- Balanced ledger counterpart for the approved UGX 2,000 registration welcome bonus.
INSERT INTO ledger_accounts (id, owner_user_id, account_code, currency, account_name, created_at)
VALUES ('platform-welcome-bonus-ugx', NULL, 'PLATFORM_WELCOME_BONUS_EXPENSE', 'UGX', 'Welcome bonus expense', datetime('now'))
ON CONFLICT(id) DO NOTHING;
