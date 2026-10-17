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
