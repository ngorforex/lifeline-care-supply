# Lifeline Care Supply

Individual-investor fixed-package investment platform.

## Production architecture

- Cloudflare Worker: `src/index.js` serves the API and application routing.
- Cloudflare Workers Static Assets: `public/` serves the investor portal and administrator interface.
- Cloudflare D1: `lifeline-care-supply-db` is the relational system of record.
- Worker D1 binding: `DB`.
- GitHub `main` is connected to Cloudflare Workers Builds.
- Persist timestamps in UTC ISO-8601 form. Display operational timestamps in East Africa Time (`Africa/Kampala`).

## Investor accounts

- Individual investors register and sign in using their mobile phone number and password.
- Phone numbers are normalized to Uganda international format (`+2567XXXXXXXX`); local `07XXXXXXXX` input is accepted and normalized.
- Investor names and email addresses are not required for account registration.
- Administrator accounts are provisioned separately.
- Password recovery uses Yoola Verify SMS. The D1 migration `0010_password_recovery.sql` and Worker secret `YOOLA_API_KEY` are required for that feature. The Yoola key must be stored as a Worker secret, never as a plain variable or committed value.

## Customer financial flows

The following customer API flows are implemented in `src/index.js`; they are not merely planned features:

- **Deposits:** `POST /api/investor/deposits` initiates an ObPay mobile-money collection. A deposit remains pending until a provider transaction lookup confirms the matching local reference, amount, UGX currency, payer phone and provider transaction ID. Only then is the wallet credited through the ledger.
- **Withdrawals:** `POST /api/investor/withdrawals` validates the investor, eligibility, available balance, withdrawal tax and recipient name, then submits an ObPay payout. Funds are reserved while the payout is pending; confirmed success settles the withdrawal, while confirmed failure releases the reservation.
- **Provider callbacks:** `POST /obpay/webhook` validates the webhook signature and independently verifies the provider transaction before changing financial state.
- **Reconciliation:** scheduled Worker execution checks pending ObPay transactions. Webhook and reconciliation processing must remain idempotent.
- **Wallet and ledger:** customer balances are derived from balanced ledger entries; do not credit a wallet from a browser response or an unverified webhook.
- **Investments:** `POST /api/investor/investments` purchases a published package only after the investor accepts its current terms and has sufficient available wallet funds.
- **Daily check-in:** `/api/investor/daily-checkin` exposes the once-per-EAT-day reward claim.

The Worker currently contains an enabled ObPay payout code path (`OBPAY_PAYOUTS_ENABLED = true`). The payout fee mode is presently hard-coded as `account`; this must be checked against the actual merchant-account setting before live payouts are relied upon. The ObPay secret must be configured as the `OBPAY_SECRET_KEY` Worker secret.

### Payment verification and operational status

An ObPay connection check or webhook registration is not proof that a customer payment has succeeded. Customer deposits and withdrawals must be shown as completed only after the provider's final transaction status has been independently verified. A pending response is not a completed payment.

The production database's previously inspected transaction history contained one rejected ObPay deposit, no successful deposits, and no withdrawal records. Therefore the integration code is present, but a successful end-to-end customer deposit and payout have not yet been demonstrated. Do not describe the payment integration as fully production-verified until controlled end-to-end tests pass and the merchant payout fee mode is confirmed.

## Financial configuration

The production D1 `platform_settings` table is the source of truth for minimum deposit and withdrawal amounts, registration and daily rewards, withdrawal tax, referral rates, currency and timezone. The investment package catalogue is stored in `investment_packages`; the published rows in D1, not old seed examples or retired catalogue rows, determine what customers can purchase.

Current production settings inspected on 27 November 2026 include:

- Currency: UGX
- Timezone: `Africa/Kampala`
- Minimum deposit: UGX 15,000
- Minimum withdrawal: UGX 5,000
- Registration bonus: UGX 5,000
- Daily check-in: UGX 200
- Withdrawal tax: 15%
- Referral rates: L1 25%, L2 2%, L3 1%

Do not change these values or the published package terms without an explicit approved change. Historical migration files contain older values and are migration history, not the current production configuration.

## Local preview

Install dependencies using the repository lockfile, then run:

```sh
npx wrangler dev
```

## Deployment

Production deployments are managed through Cloudflare Workers Builds from GitHub `main`. After committing changes, use the configured **Builds → Deploy to main** workflow. Do not deploy through a separate Cloudflare API workflow.

## Production release controls

Before declaring real-money transactions ready for unrestricted customer use, verify all of the following:

1. `OBPAY_SECRET_KEY` is present as a Worker secret and the live ObPay account is the intended merchant account.
2. The merchant dashboard's payout fee mode matches the mode assumed by the Worker; do not rely solely on the hard-coded `account` value.
3. A controlled deposit succeeds end to end: provider final status, exact transaction matching, one wallet credit, and balanced ledger entries.
4. A controlled payout succeeds end to end: recipient verification, fee/debit amounts, reserved funds, final provider status, and balanced ledger settlement.
5. Duplicate callbacks, repeated reconciliation and uncertain provider responses do not duplicate credits, payouts, refunds or ledger postings.
6. Admin and investor views show the same persisted transaction status and EAT timestamps.
7. Relevant database migrations are applied and the deployed Worker has the required bindings and secrets.

Do not bypass provider verification or release controls to make a transaction appear successful. Never commit credentials, API keys, OTPs or other secrets.

## Important distinction

This repository contains implementation for customer financial operations. That does not mean every live-money path has passed production acceptance testing. Keep operational claims aligned with verified provider transactions and ledger evidence.
