# Free Cloudflare payment microservices (synthetic only)

This is an **additional deployment path** alongside the existing Go rail engine, Quarkus labs and Python investigation agent. It does **not** run Java/Go/Python containers or Kubernetes on Cloudflare. Each `wrangler.<role>.toml` publishes a separately deployable JavaScript Worker, with private Service Bindings for backend-to-backend calls.

## What is implemented

- `gateway`: single configured demo API key, database-backed daily quota, internal routing.
- `cbpr`: deliberately narrow MT / MX structural example check (NOT ISO XSD validation or full CBPR+ translation).
- `swift-network`, `bank`, `gpi`: synthetic bank-directed request, network acknowledgement, bank status and UETR tracking response.
- `sepa`, `sepa-clearing`: synthetic SCT, SCT Inst, SDD Core/B2B, recall, return and refund routing, **NOT rulebook-complete flows**.
- `rtgs`, `chaps`, `t2`: simulated settlement outcomes; no real funds or finality.
- `GET /health`: per-service health information; no real transaction status.
- JSON output always declares `simulated:true`; all non-gateway requests require an internal token.
- Every request must set `synthetic:true`. No real payment data should be uploaded.

**These are infrastructure skeletons and narrow demonstrators, not complete message processors.** Full pain/pacs/camt validation, XSD/version profiles, payment message lifecycle handling, authoritative RTGS and bank network contracts, SDD mandates, clearing/settlement accounting, SWIFT's licensed translation library, AI investigation, persistent GPI event tracking, customer multi-tenancy and production audit controls remain separate development work. The existing Go/Java/Python components are not migrated or replaced.

## Local contract tests

From repository root: `node --test tests/cloudflare-payment-microservices.test.mjs`.

## Deployment and smoke verification

Use the manually gated workflow and environment setup in [deployment instructions](../../docs/CLOUDFLARE-GITHUB-DEPLOY-PREPARATION.md). Run commands from repository root. `npm ci`, then `npm test` runs contracts and a real local Worker/D1 integration test. CI bundles all ten configs using the lockfile-pinned Wrangler.

Internal Workers disable workers.dev and preview URLs. Gateway requires a configured API key and D1; both orchestration and service routes share the daily quota. The workflow initializes D1 with the generated gateway configuration, deploys secrets with code, and automatically tests the real gateway service chain after deployment. Local tests do not establish a live deployment result.

## Example API paths (gateway)

`POST /v1/cbpr/validate`, `/v1/gpi/payments`, `/v1/sepa/payments`, `/v1/rtgs/settle`, `/v1/chaps/payments`, `/v1/t2/payments`.

The gateway routes by service name. Service-specific JSON validation requirements are in `worker.mjs`. These endpoints intentionally **do not** communicate with SWIFT FIN/InterAct/gpi, SEPA CSMs, BoE RTGS/CHAPS, or Eurosystem T2.
