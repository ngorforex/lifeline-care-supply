# Lifeline Care Supply — Cloudflare Architecture

## Product scope
Lifeline Care Supply supports individual investors only. Business and organization investor accounts are out of scope.

## Applications
1. Public website: platform information, package disclosures, FAQs and legal disclosures.
2. Investor portal: personal profile, verification, dashboard, packages, investments, transactions, referrals and account security.
3. Administrator portal: investor administration, package administration, investment operations, deposit and withdrawal review, reports, staff permissions and audit logs.

## Cloudflare runtime
- Cloudflare Worker: API, authentication, authorization and business logic.
- Workers Static Assets: public website and investor/admin interfaces.
- D1: authoritative relational application database. Production database is `lifeline-care-supply-db`, EU jurisdiction, bound as `DB`.
- R2: candidate private object storage for identity and supporting documents; not provisioned yet.
- Queues / Workflows: candidate asynchronous processing; not enabled.
- Turnstile and rate limiting: candidate abuse controls; not yet configured.
- GitHub: source control on `main`.
- Cloudflare Workers Builds: production deployment workflow.

## Identity model
- Investors: phone number + password. Registration collects first name, optional middle name, last name, phone number and password; no email.
- Administrator accounts are provisioned separately and never through public investor registration.
- Session credentials must be opaque, random, stored only as hashes, delivered in Secure, HttpOnly, SameSite cookies, and expire/revoke server-side.
- Passwords must be stored using a modern password hashing scheme with unique salts and server-side parameters; never store plaintext passwords.
- Public registration must never accept a role or administrator flag.
- Phone normalization uses E.164. SMS-based verification or recovery requires an explicitly configured SMS provider; do not claim phone ownership is verified without it.

## Security boundaries
- All database access goes through the Worker API and parameterized D1 statements.
- Investor routes only expose the authenticated investor's own records.
- Administrator permissions are role-based and least-privilege.
- Admin provisioning is controlled and audited.
- Financial changes are recorded in an append-only double-entry ledger.
- Every money-moving command is idempotent and auditable.
- Payout details and identity documents are private and encrypted/restricted.
- Secrets are stored in Cloudflare's secret manager, never committed to Git.

## Financial invariants
- Pending deposits are not spendable balance.
- Withdrawals cannot exceed available, settled funds.
- Ledger transactions must balance before commit.
- Reversals are compensating entries; historical financial records are not deleted.
- Investment purchases retain a snapshot of terms accepted at purchase time.
- Package edits do not silently alter existing investments.
- Timestamps are persisted as UTC ISO-8601 and displayed in East Africa Time (EAT).
- Currency, package prices, duration, return formulas, taxes, fees, eligibility rules and referral rewards remain unconfigured until approved.

## Current status
- Dedicated EU-jurisdiction D1 database created and initial schema applied.
- Worker source still needs API/auth implementation and runtime tests before investor/admin portals can be connected.
- Neon is not used by the intended Cloudflare architecture. The existing Neon project is retained temporarily as a rollback/reference resource; it has not been deleted.
- No investor financial records have been migrated; no live money movement is enabled.

## Release sequence
1. Implement and test phone/password investor authentication and separate admin authentication.
2. Add strict role and ownership authorization to API routes.
3. Implement investor and admin read APIs.
4. Implement approved operational workflows and balanced ledger posting.
5. Add abuse controls, backup/restore drills, audit-integrity and security testing.
6. Enable real-money activity only after formal approval and end-to-end verification.
