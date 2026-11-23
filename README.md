# Lifeline Care Supply

Individual-investor fixed-package investment platform.

## Current foundation

- Cloudflare Worker with static asset delivery.
- Responsive public landing page.
- PostgreSQL schema draft for individual investors, fixed packages, investments, ledger records, deposits, withdrawals, verification and audit logs.
- Architecture and security notes in \`docs/architecture.md\`.

## Local preview

The public site is served from \`public/\`. For a local Cloudflare Worker preview, install Wrangler and run:

\`\`\`sh
npx wrangler dev
\`\`\`

## Deployment

Production deployments are managed through Cloudflare Workers Builds from the GitHub \`main\` branch. Do not deploy through a separate API workflow.

## Important

This repository currently contains a foundation only. No production database, authentication provider, payment integration, live balances, investment activation or earnings calculation is enabled. Investment terms and regulatory requirements must be approved before real-money activity is implemented.
