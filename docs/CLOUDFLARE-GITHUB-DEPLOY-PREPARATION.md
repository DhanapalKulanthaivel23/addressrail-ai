# Manually gated synthetic Cloudflare deployment

This workflow has not been deployed as part of this hardening change. It deploys only on `workflow_dispatch`, on `feature/cloudflare-payment-microservices`, with literal confirmation `DEPLOY_SYNTHETIC_ONLY`. Checkout uses the dispatch commit SHA, not a moving branch. Nothing merges automatically.

Configure the `cloudflare-synthetic` GitHub environment:

| Setting | Kind |
| --- | --- |
| CLOUDFLARE_API_TOKEN | Secret; account-scoped Workers Scripts edit and D1 edit permissions |
| CLOUDFLARE_ACCOUNT_ID | Secret; 32 hexadecimal characters |
| AR_INTERNAL_TOKEN | Secret; random 32+ characters |
| AR_DEMO_API_KEY | Secret; different random 32+ characters |
| CLOUDFLARE_D1_DATABASE_ID | Variable; existing D1 UUID |
| CLOUDFLARE_GATEWAY_URL | Variable; `https://ar-gateway.<your-subdomain>.workers.dev/` |

Create the D1 database `addressrail-payment-usage` with an authorized administrator. Enable the account's workers.dev subdomain first. Do not paste credentials in code, chat, issues or logs. Configure environment reviewers and deployment branch restrictions where your GitHub plan supports them. The workflow file may need to exist on the default branch to appear in GitHub's dispatch UI; this change does not merge it.

## Deployment behavior

`npm ci` installs locked deployment tooling. `scripts/cloudflare-config.mjs` validates the UUID and generates a sibling gateway config, preserving the `./worker.mjs` path. D1 schema initialization explicitly uses `--config .../wrangler.gateway.deploy.toml` and binding `DB`; it is idempotent CREATE IF NOT EXISTS, not a migration framework. All ten bundles are checked separately by CI without credentials.

The deploy script validates every required setting before any remote command, initializes the existing database, then deploys backend dependencies before gateway. Secrets are JSON files with mode 0600 in a temporary directory and sent using `wrangler deploy --secrets-file`, alongside code. They are removed on exit; no secret values are printed or uploaded as artifacts. Internal Workers disable workers.dev and preview URLs. Inspect any existing custom routes separately; these configs do not audit account-level routing.

Deployment is sequential, not transactional. A failure can leave a partially updated graph. Rotating the shared internal token can cause transient failures while Workers update. Restore a reviewed commit and matching secrets with an authorized manual run; do not assume automatic rollback.

## Actual smoke automation

After deployment `scripts/cloudflare-smoke.mjs` calls the configured HTTPS gateway with redirects disabled and bounded timeouts. It checks gateway health, invalid-key rejection, an unknown path, rejection of non-synthetic input and an actual GPI → SWIFT → bank service-binding response. It requires HTTP 200, ACSP, simulated network ACK, simulated=true and settlementAttested=false. Any failure fails the workflow. It consumes two of the demo's 25 daily quota units, so an already exhausted quota causes a truthful smoke failure. It does not exhaust a live account's quota or submit a durable payment.

CI runs the same smoke function against real local workerd Workers with SQLite-backed D1, plus durable payment creation/replay/events, quota concurrency, orchestration quota checks and missing-table failures. These are local results, not evidence of live Cloudflare deployment.

## Quota and Free-plan scope

One configured API key maps to tenant `demo`. All authenticated recognized gateway API requests, including payment reads and retries, consume a daily UTC quota unit before parsing. Health, invalid keys, unknown paths and unsupported methods do not. Atomic conditional SQL increments permit only the configured number of requests under concurrency. DB failures return 503, exhausted quota 429. DAILY_LIMIT must be an integer 1–1000 and defaults to 25. Downstream or invalid-body failures still consume the accepted request's unit.

Application quota does not cap unauthorized traffic, health requests, storage growth or account-wide Cloudflare usage. This lab uses Workers, Service Bindings and D1, not paid queues or containers; account entitlements and existing usage must still be checked by the owner. It does not set billing controls or guarantee zero cost. Review current [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) and [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).

This remains a synthetic educational subset, not SWIFT/EPC/CHAPS/T2 conformance or live payment connectivity.
