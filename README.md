# Lifeline Care Supply

Individual-investor fixed-package investment platform.

## Current infrastructure

- Cloudflare Worker serves the application and will host the API.
- Cloudflare Workers Static Assets serves the public and portal interfaces.
- Cloudflare D1 is the dedicated relational database, created in the EU jurisdiction.
- D1 schema is versioned in `db/d1/`; apply the new `0010_password_recovery.sql` migration before enabling password recovery.
- Worker binding: `DB` → `lifeline-care-supply-db`.
- GitHub `main` is connected to Cloudflare Workers Builds for deployment.

## Investor identity

Individual investors register with an international-format phone number and password; registration includes a confirm-password check. Investor names and email addresses are not collected. Password recovery must verify ownership of the registered phone number before allowing a reset. Administrator identities are provisioned separately.

## Local preview

Install dependencies using the repository lockfile, then run:

```sh
npx wrangler dev
```

## Deployment

Production deployments are managed through Cloudflare Workers Builds from GitHub `main`. Do not deploy through a separate API workflow.

## Important operational boundaries

- Investor registration, login, logout, session validation, authenticated password changes and Yoola Verify SMS password recovery are implemented. Dashboard data is loaded from the authenticated investor's D1 records.
- No legacy investor accounts or financial records have been migrated. New registrations are stored in D1.
- No package amounts, return rates, taxes, fees, eligibility conditions or referral rewards are configured.
- No live deposits, payouts, wallet balances, investment activation or earnings calculation are enabled.
- Do not enable real-money operations until ledger balancing, idempotency, access control, audit integrity, security review and recovery testing are complete.
- Persist timestamps in UTC ISO-8601 form and display operational time in East Africa Time (EAT).
- Configure `YOOLA_API_KEY` as a Cloudflare Worker secret (never as a plain variable or committed value) before enabling SMS password recovery. Obtain the key from the Yoola SMS dashboard. The application calls Yoola Verify `verify-send` and `verify-check`; OTPs are generated and verified by Yoola.
- After adding the D1 migration and Worker secret, deploy through the configured Cloudflare Workers Builds → Deploy to main workflow. Do not deploy through a separate API workflow.
- Never commit credentials or secrets.
