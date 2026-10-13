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

The dev database is a local file at `payments-core/data/` (H2), so data survives restarts. Tests use an isolated in-memory H2 database. **Do not put real payment or personal information in this service.**

For a future, explicitly provisioned deployment, PostgreSQL JDBC configuration is available through `PAYMENTS_JDBC_URL`, `PAYMENTS_DB_USER` and `PAYMENTS_DB_PASSWORD` under the Quarkus production profile. Production schema provisioning/migration is **not** implemented; Hibernate validates existing schema, it does not create it.

## API

- `GET /api/v1/payments/{id}` — synthetic payment metadata and last known stored status
- `GET /api/v1/payments/{id}/events` — chronological event trail with source and evidence reference
- `GET /api/v1/payments/{id}/investigation` — deterministic evidence view for a future LLM tool

There are **no write endpoints**, no AI calls, no external payment lookups, and no CORS access. Host binds to `127.0.0.1` for local development. These controls intentionally prevent this unauthenticated prototype from being exposed as a production SaaS. A future release must add authentication, multi-tenancy, durable ingestion, immutable audit, idempotency, concurrency controls, PostgreSQL migrations and tested integrations before any real payments.

The sample `PAY-10001` models a hypothetical `pacs.008` rejection with AC01. Its timestamps, references, agents and state transitions are **simulated**, not a universal scheme flow or a Swift production record.

## Next

Implement versioned scheme/rail-aware identities, payment event ingestion, correlation and authentic access controls. Only then connect read-only, evidence-grounded Gemini tool calls for investigation; retain human approval for actions.
