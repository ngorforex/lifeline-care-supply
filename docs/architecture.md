# Lifeline Care Supply — Architecture Foundation

## Product scope

Lifeline Care Supply is an investment platform for **individual investors only**. It offers fixed investment packages and has a separate administrator portal. Business investor accounts and organization management are out of scope.

## Applications

1. Public website: platform information, package disclosures, FAQs, legal disclosures and access entry points.
2. Investor portal: personal profile, verification, dashboard, packages, investments, wallet activity, transactions and account security.
3. Administrator portal: investor administration, package administration, investment operations, deposit and withdrawal review, reports, staff permissions and audit logs.

## Runtime

- Cloudflare Worker: API and request handling.
- Cloudflare Workers Static Assets: public frontend delivery.
- PostgreSQL: authoritative relational and financial data store (proposed; not provisioned).
- Cloudflare R2: private identity and supporting document storage (proposed; not provisioned).
- Cloudflare Queues and scheduled Worker tasks: asynchronous notifications and controlled scheduled processing (proposed; not provisioned).
- GitHub: source control on the main branch.
- Cloudflare Workers Builds: production deployment workflow.

## Security boundaries

- Investor and administrator authentication must be separate in authorization policy.
- Investor routes must only expose the authenticated investor's own records.
- Administrative permissions must be role-based and least-privilege.
- Financial changes must be recorded in an append-only ledger.
- Every money-moving command must be idempotent and auditable.
- Uploaded identity documents must be private and served only through authorized, short-lived access.
- Secrets must be stored in the deployment secret manager, never committed to Git.

## Financial invariants

- A pending deposit is not spendable balance.
- A withdrawal cannot exceed available, settled funds.
- Ledger transactions must balance before commit.
- Reversals are compensating entries; historical financial records are not deleted.
- Investment purchases retain a snapshot of the terms accepted at purchase time.
- Package edits do not silently alter existing investments.
- All persisted timestamps use timezone-aware database types. User-facing business times are displayed in East Africa Time (EAT).
- Currency, package prices, duration, return formulas, taxes, fees and eligibility rules remain unconfigured until approved.

## Not enabled in this foundation

- No live deposit or payout integration.
- No real investor accounts or authentication provider.
- No real wallet balances or investment activation.
- No return calculation or scheduled earnings.
- No referral commission logic.
- No production database or document storage has been provisioned.

## Initial release sequence

1. Approve the product terms, legal disclosures and operating model.
2. Provision database and authentication.
3. Implement and test the investor portal.
4. Implement administrator access and review workflows.
5. Implement the ledger and payment adapters.
6. Complete security, reconciliation and recovery tests before enabling real-money activity.