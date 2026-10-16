# GitHub-only deployment preparation

Cloudflare has **not** been deployed from this branch. The workflow is manually triggered and requires the literal `DEPLOY_SYNTHETIC_ONLY` input. It cannot deploy until the repository owner configures a GitHub Actions environment named `cloudflare-synthetic` and the following environment settings:

| Name | GitHub setting |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Environment secret: token scoped to required Workers Scripts + D1 edit rights |
| `CLOUDFLARE_ACCOUNT_ID` | Environment secret |
| `AR_INTERNAL_TOKEN` | Environment secret: strong random value (32+ characters) |
| `AR_DEMO_API_KEY` | Environment secret: strong random value (32+ characters) |
| `CLOUDFLARE_D1_DATABASE_ID` | Environment variable: existing D1 database ID |

The D1 database must first be created by an authorised Cloudflare administrator under the name `addressrail-payment-usage`. **Do not place any secrets in GitHub files, issues, PRs, logs or this conversation.** This is an optional, not-yet-verified deployment workflow. Manual invocation can mutate the Cloudflare account; costs/entitlements must be independently verified. Internal Workers now default to `workers_dev=false` and are called through service bindings. The public gateway remains enabled.

For an additional safety check, configure deployment environment reviewers in GitHub Settings so a manual run requires approval. Inspect all script behaviour and use Cloudflare Free entitlements only.

## Known limitations and follow-ups

1. The synthetic-only workflow has not been verified against a live Cloudflare account or real D1 database.
2. The payment orchestration gateway performs API key checks, but the demo uses one hard-coded tenant and does not implement full production multi-tenancy, identity, atomic rate limiting of payment submissions or bank integrations.
3. Worker role separation remains a shared JavaScript module with independent config; it is not a Kubernetes installation, and it does not run Java Quarkus/Python/Go processes on Cloudflare.
4. Validation and lifecycle behaviour are educational subsets, not official SWIFT, EPC, Bank of England or Eurosystem conformance.
5. Run GitHub CI and manually review deploy logs and gateway REST responses before inviting users.
