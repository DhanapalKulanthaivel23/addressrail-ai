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

## Deploy with GitHub + Cloudflare Free

Install Node and run `npx wrangler login`. You need a Cloudflare account authorised to deploy Workers.

1. Create D1: `npx wrangler d1 create addressrail-payment-usage`. Insert the resulting database ID by uncommenting `[[d1_databases]]` in `wrangler.gateway.toml`, **do not leave the placeholder**.
2. Initialise D1 schema: `npx wrangler d1 execute addressrail-payment-usage --remote --file=cloudflare/payment-microservices/schema.sql`.
3. Deploy from this directory in order: `bank`, `swift-network`, `cbpr`, `gpi`, `sepa-clearing`, `sepa`, `rtgs`, `chaps`, `t2`, `gateway`. Example: `npx wrangler deploy --config cloudflare/payment-microservices/wrangler.bank.toml`. If Wrangler resolves paths relative to configuration directory, use repository-root invocation consistently.
4. Set the **same strong random** INTERNAL_TOKEN secret on *every* Worker: `npx wrangler secret put INTERNAL_TOKEN --config cloudflare/payment-microservices/wrangler.bank.toml` (repeat per Worker). Set `API_KEY` secret on gateway in the same manner. Never commit either.
5. Run a smoke request to `https://ar-gateway.<your-subdomain>.workers.dev/v1/gpi/payments` with headers `x-api-key` and `content-type: application/json`, and synthetic body:
```json
{"synthetic":true,"messageType":"pacs.008","reference":"AR-DEMO-123","uetr":"123e4567-e89b-42d3-a456-426614174000","receiverBic":"BANKDEFF","currency":"EUR"}
```
6. Confirm the result includes `simulated:true`, `trackingStatus: "ACSP"`, `settlementAttested:false`. This is an *expected* response, not a claim that a live deployment has passed.
7. Test unknown API keys, daily quota exhaustion, duplicate requests, large requests, and outages before exposing the demo. Do not use the current simple API key design for actual multi-tenant customer onboarding.

**Important:** A separate secret on each Worker prevents direct unauthenticated calls to its public `workers.dev` endpoint, but it is not a complete network isolation boundary. Disable public routes for internal workers or apply Cloudflare Access/network policies before production use. Free-tier limits and capabilities can change. Cloudflare Worker deployments are serverless rather than k3s/Helm or always-on containers.

## Example API paths (gateway)

`POST /v1/cbpr/validate`, `/v1/gpi/payments`, `/v1/sepa/payments`, `/v1/rtgs/settle`, `/v1/chaps/payments`, `/v1/t2/payments`.

The gateway routes by service name. Service-specific JSON validation requirements are in `worker.mjs`. These endpoints intentionally **do not** communicate with SWIFT FIN/InterAct/gpi, SEPA CSMs, BoE RTGS/CHAPS, or Eurosystem T2.
