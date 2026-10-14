# AddressRail AI — Unified Payments Core v1 (synthetic)

Standalone Java 21 / Quarkus educational payments-data service. **No live bank rail or Swift connectivity.** It is intentionally **not integrated** with the existing GitHub Pages, Cloudflare Workers/D1, Turnstile, Render/Gemini service, DNS or SEO registrations.

## Run locally

Requires Java 21 and Maven (both free). From this directory:

```bash
mvn test
mvn quarkus:dev
curl http://127.0.0.1:8081/api/v1/payments/PAY-10001
curl http://127.0.0.1:8081/api/v1/payments/PAY-10001/events
curl http://127.0.0.1:8081/api/v1/payments/PAY-10001/investigation
```

The dev database is a local file as `payments-core/addressrail-payments.mv.db` (H2), so data survives restarts. Tests use an isolated in-memory H2 database. **Do not put real payment or personal information in this service.**

For a future, explicitly provisioned deployment, PostgreSQL JDBC configuration is available through `PAYMENTS_JDBC_URL`, `PAYMENTS_DB_USER` and `PAYMENTS_DB_PASSWORD` under the Quarkus production profile. Production schema provisioning/migration is **not** implemented; Hibernate validates existing schema, it does not create it.

## API

- `GET /api/v1/payments/{id}` — synthetic payment metadata and last known stored status
- `GET /api/v1/payments/{id}/events` — chronological event trail with source and evidence reference
- `GET /api/v1/payments/{id}/investigation` — deterministic evidence view for a future LLM tool

The original payment collection remains **read-only**. A separate synthetic-only learning endpoint can create local test records in dev/test modes, but is **disabled in production**. There are no AI calls, no external payment lookups, and no CORS access. Host binds to `127.0.0.1` for local development. These controls intentionally prevent this unauthenticated prototype from being exposed as a production SaaS. A future release must add authentication, multi-tenancy, durable ingestion, immutable audit, idempotency, concurrency controls, PostgreSQL migrations and tested integrations before any real payments.

The sample `PAY-10001` models a hypothetical `pacs.008` rejection with AC01. Its timestamps, references, agents and state transitions are **simulated**, not a universal scheme flow or a Swift production record.

## Next

Implement versioned scheme/rail-aware identities, payment event ingestion, correlation and authentic access controls. Only then connect read-only, evidence-grounded Gemini tool calls for investigation; retain human approval for actions.

## SEPA SCT v2 — local simulation with persisted events

The public [SCT XML builder](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/sepa-sct/) remains browser-only. The new Java local lab provides *separate* same-origin simulation and event persistence. **Do not expose Quarkus to the internet.**

With `mvn quarkus:dev` running in `payments-core/`, open:

**http://127.0.0.1:8081/labs/sepa-sct/**

Choose `accepted`, `invalid-iban`, or `csm-reject`, then click **Create synthetic payment**. The page displays a new `SCT-...` payment ID, persisted events, and the read-only investigation view.

The dedicated API is `POST /api/v1/labs/sepa-sct/simulations`, **enabled only in dev/test profiles** and disabled otherwise. It requires `synthetic: true` and synthetic-prefixed names; it is for education, not real banking input. Unlike the original `/api/v1/payments` collection, this lab endpoint can create records *only* under the local learning feature flag. Account details and scheme controls are illustrative, not officially validated.

To investigate a generated ID with the separately running LangGraph/Gemini service (e.g. port 8093):

```bash
curl -sS -X POST http://127.0.0.1:8093/investigate \
  -H 'Content-Type: application/json' \
  -d '{"payment_id":"SCT-REPLACE-WITH-ID-FROM-LOCAL-LAB"}'
```

The agent retrieves the same Quarkus payment and event history. Use a real generated synthetic ID. The AI explanation is optional; payment statuses and evidence remain deterministic. `ACTC` is used as a teaching example of **technical acceptance only** and does not establish settlement or beneficiary credit. The CSM rejection scenario is hypothetical and not an actual STEP2 response.

These locally persisted records have no tenant isolation, idempotency, authenticated write access, source attestation or immutable audit. Production remains disabled and does not expose a payment simulation service.
