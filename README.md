# Lifeline Care Supply

Individual-investor fixed-package investment platform.

## Current infrastructure

- Cloudflare Worker serves the application and will host the API.
- Cloudflare Workers Static Assets serves the public and portal interfaces.
- Cloudflare D1 is the dedicated relational database, created in the EU jurisdiction.
- D1 schema is versioned in `db/d1/0001_initial.sql`.
- Worker binding: `DB` → `lifeline-care-supply-db`.
- GitHub `main` is connected to Cloudflare Workers Builds for deployment.

## Investor identity

Individual investors register with first name, optional middle name, last name, phone number and password. Investor email is not collected or required. Administrator identities are provisioned separately.

## Local preview

Install dependencies using the repository lockfile, then run:

```sh
npx wrangler dev
```

## Deployment

Production deployments are managed through Cloudflare Workers Builds from GitHub `main`. Do not deploy through a separate API workflow.

## Important operational boundaries

- D1 currently contains the foundational schema only. Authentication and application API routes must be implemented and tested before the portal is connected.
- No real investor accounts or financial records have been migrated.
- No package amounts, return rates, taxes, fees, eligibility conditions or referral rewards are configured.
- No live deposits, payouts, wallet balances, investment activation or earnings calculation are enabled.
- Do not enable real-money operations until ledger balancing, idempotency, access control, audit integrity, security review and recovery testing are complete.
- Persist timestamps in UTC ISO-8601 form and display operational time in East Africa Time (EAT).
- Never commit credentials or secrets.
