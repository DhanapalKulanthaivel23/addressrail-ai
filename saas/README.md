# AddressRail B2B Tenant API: PostgreSQL RLS staging reference

This is a **separate, opt-in synthetic staging service**, not a deployed production SaaS. It provides real relational PostgreSQL row-level security (RLS), strict signed RS256 OIDC access-token verification against a configured public key, roles, immutable per-case JSON report export and scoped audit entries. It does **not** allow payments or authenticate to Swift and is **not wired to the shared non-tenant Kafka pipeline**. The separation is intentional: do not expose any unscoped local services to customers.

## Controls

- Tenant context is derived **only** from a verified signed JWT claim `tenant_id` (UUID). No `X-Tenant` override, query/body tenant selector or trusted browser-origin claim.
- JWT signature, issuer, audience, expiry, `nbf`, `iat`, subject and allowed roles are checked; **RS256 only**. Test-only signing keys are generated in CI and not committed.
- Every database transaction uses `set_config('app.tenant_id', claim, true)`; PostgreSQL `FORCE ROW LEVEL SECURITY` applies to cases, reports and audit tables. API role must be a non-owner without `BYPASSRLS`.
- Immutable JSON report with safe false settlement/retry flags; reports are marked **user-submitted synthetic/unverified**, not verified bank engine outputs.
- Reviewer/viewer cannot create cases, audit logs visible to admin only.
- Fails closed when `SAAS_ENABLE_API` is not true, missing OIDC config or DB inaccessible.
- This simple starter requires an OIDC provider's RS256 verification public key loaded via a managed secret/config channel. A production release must implement provider JWKS rotation, SSO provisioning, mTLS, per-tenant quotas, MFA policies, security monitoring and secure request buffering.
- Existing public GitHub Pages stays independent; frontend cannot call this API without a real identity provider.

## Configuration (no hardcoded real secrets)

Set `SAAS_ENABLE_API=true`, `SAAS_DATABASE_URL` to a **least-privilege** `addressrail_api` PostgreSQL connection, `SAAS_OIDC_ISSUER`, `SAAS_OIDC_AUDIENCE`, `SAAS_OIDC_PUBLIC_KEY_PEM` (PEM public key only). Install `saas/requirements.txt`. Start `python -m uvicorn saas.app:app --host 127.0.0.1 --port 8097`. Use a TLS-terminating ingress and real IdP for any network deployment, not an internet-exposed local test token service.

Initialize tables using `saas/schema.sql` as a DB administrator. Create `addressrail_api` as a **different non-owner login**, with no SUPERUSER, CREATEROLE or BYPASSRLS. Never connect to the app as postgres/superuser.

## Tests

`saas/tests/test_tenant_api.py` starts with two synthetic tenants, signed RSA claims and a **real ephemeral PostgreSQL container** in GitHub Actions. It demonstrates that neither API reads nor **direct SQL reads with an application connection** can retrieve a different tenant's case, even if the query itself omits the tenant predicate. The tests also check wrong audience, expiry, role, forged tokens, duplicate records and report export.

For full commercial readiness also requires: migration versioning (Flyway/Alembic), verified IdP JWKS rotation, secret manager, PostgreSQL backup+restore drills, tenancy in Kafka events and all Java/Go/Python consumers, transactional outbox, tenant-safe observability, pentesting, disaster recovery, permitted standards documents, SLA, rate limiting and billing. Do not enable live data before completion.


## Opt-in private network bridge (synthetic local staging only)

The SaaS now has a **server-side** bridge to the *separately maintained, PRIVATE* `addressrail-network-core` API. No private core Python files or credentials are copied into this public repository or browser. The bridge is **disabled by default**, and it **does not** use real Swift or external payment networks.

Enable only on a trusted local development machine with `SAAS_ENABLE_API=true`, `SAAS_ENABLE_NETWORK_BRIDGE=true`, `SAAS_SIM_NETWORK_URL=http://127.0.0.1:18310`, and `SAAS_SIM_NETWORK_SERVICE_KEY` set to the same 32+ character **test-only** key as the private SAA process. The bridge rejects all non-loopback destinations, client-provided target URLs and redirections. The key is read solely from the backend environment and never included in JSON output. All endpoints require a signed RS256 OIDC tenant token and PostgreSQL FORCE RLS.

A tenant `ADMIN` or `INVESTIGATOR` may call `POST /v1/tenancy/network/simulations` with JSON `{"reference":"MY-DEMO-0001","scenario":"REJECT","synthetic":true}`. Supported scenarios: `ACCEPT`, `REJECT`, `PENDING`. Only fixed fictional BICs and `<Synthetic/>` are sent downstream. Each (tenant, client reference) is transformed into a deterministic tenant-scoped **fictional network reference** before being sent to the private `/v1/async/messages` API. PostgreSQL stores the network correlation ID in an RLS-protected mapping; the public API does **not** expose it or let clients supply an arbitrary network message ID. The original client reference can then be used with `GET /v1/tenancy/network/simulations/{reference}` to retrieve a synthetic network ACK and Bank B outcome. The GET route works for signed tenant roles including `VIEWER`.

Submission is reservation-first: if the private API is down, the reservation remains `SUBMITTING` and can be retried using **the same reference and scenario**. Upstream idempotency prevents synthetic duplicate processing. Conflicting scenario reuse returns HTTP 409. This is an **illustrative server-to-server staging integration**, not yet a live deployed private network connection or scheme-validating transaction processor. CI tests use a contract-compatible localhost HTTP stub together with **real PostgreSQL RLS**, not the private source or a real bank. Actual private-service cross-repository integration is a separate acceptance gate.

Required for production: non-loopback zero-trust service identity, mTLS and secure ingress, IdP key rotation, quotas/rate limiting, tenant-propagating signed network contracts, secret rotation, operational audit, retries/reconciliation, and end-to-end workload identity isolation. **Never expose or run this plaintext, shared-key development bridge outside loopback.**
