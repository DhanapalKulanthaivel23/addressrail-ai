# AddressRail AI SaaS — release gate and operator handoff (17 October 2026)

**Currently delivered: synthetic engineering staging reference ONLY.** No internet-hosted production SaaS or official payments-scheme certification. This document intentionally blocks misleading go-live claims.

## Verified local/CI controls

1. **Tenant/identity:** `saas/app.py` verifies signed RS256 OIDC claims (issuer, audience, expiry, tenant UUID and role); `saas/schema.sql` enforces PostgreSQL `FORCE ROW LEVEL SECURITY` across cases, reports, audit. CI uses real PostgreSQL and exercises cross-tenant API and **SQL without a tenant WHERE clause**. Reports are immutable and labelled *tenant-submitted synthetic, unverified*. This service is not yet connected to shared, unscoped Kafka.
2. **Event processing:** separate Kafka validation, investigation, report consumers; HTTP to Go and Java synthetic engines; retries, dead-letter envelope and immutable local JSON report. Kafka is localhost plaintext for CI, **not an externally accessible secure cluster**.
3. **ISO 20022:** Go checks a bounded educational XML subset. Python separately validates with operator-provisioned, checksum-pinned **offline ISO base XSD** when present; absence is `SCHEMA_UNAVAILABLE`. Neither result is Swift CBPR+ Usage Guideline compliance.
4. **AI:** optional real Google Gemini 3.5 Flash-Lite with evidence-bound JSON checks; tests mock the provider; real-provider recorder gated behind `GEMINI_API_KEY` repository secret and two explicit free-tier variables. Real provider run `39032297247` recorded three responses: grounding, citation relevance and rule IDs passed 2/3; status, unsafe-claim and human-review checks passed 3/3. **AI quality acceptance is NOT complete.** The live workflow now fails for any rejected response or failed metric, retaining evidence even on failure.
5. **Monitoring and recovery:** `/ops/metrics` and `/ops/readiness` require a separate 32+ character token and explicit opt-in. Metrics have only fixed stage/outcome labels; no customer ID, UETR or payment XML. `recovery.py` encrypts local SQLite snapshots with operator-supplied Fernet key, restores only to **new** destinations and checks SQLite integrity. PostgreSQL ephemeral CI backup/restore drill is included separately.

## Go-live criteria still NOT met

- [ ] Domain, trusted certificate and external ingress configured, approved by owner.
- [ ] Private cloud environment confirmed available (no hidden costs or unexpected billing); images scanned/pinned, containers/non-root run, network egress/ingress controlled.
- [ ] Production OIDC IdP configured with key rotation, MFA, tenant provisioning, short-lived tokens and emergency revocation.
- [ ] Complete **tenant context propagation and enforced separation** across Java, Go, Python, Kafka producers/consumers, queues and PostgreSQL databases; the current shared synthetic Kafka pipeline MUST NOT accept customer data.
- [ ] PostgreSQL backup schedule, KMS-managed encryption, PITR, offsite retention, tested disaster recovery RTO/RPO, encrypted Kafka transport with ACLs and per-tenant policies.
- [ ] Durable transactional outbox/inbox with idempotent consumers, Kafka schema registry, retry scheduler/DLQ remediation, load/chaos tests, capacity quotas.
- [ ] Full current ISO XSD packages and legally permitted Swift MyStandards/CBPR+ usage rules for each supported message and release; independently reviewed rules, no inference from RAG summaries.
- [ ] Sanctions/AML provider integration only after licensing, compliance governance and audit; current project performs no live screening.
- [ ] Provider credentials stored only in secrets manager; successful **actual Gemini outputs and evals**, model/version pinned, agreed privacy terms for any non-synthetic data.
- [ ] Legal/IP/licensing review, threat model, pentest, privacy/DPIA, customer DPA, retention/deletion/export, logs/traces restricted, incident/on-call plan, SLA, usage metering and billing controls.

**Never expose the local Java training-case, Go rules or Python Kafka endpoint directly on the public internet.** The authenticated SaaS tenant API is a separate staging service; shared pipeline is not secure multi-tenant processing today.

## Recommended no-charge infrastructure pilot

Oracle Cloud Always Free **OCI Ampere A1** presently advertises a total equivalent of **2 OCPUs / 12 GB RAM** for Always Free tenancies, plus free storage/network allowances, subject to home-region quotas and capacity. This may suffice for a small synthetic pilot with Kafka/JVM/Go/Python/PostgreSQL after memory budgeting; **not an enterprise SLA**. Oracle may reclaim instances under idle conditions. Validate the exact resources on your account before provisioning and never enable Pay-as-You-Go without consent.

Cloudflare's free Workers can host lightweight HTTP edge functions and access controls, but **cannot host the entire always-running Kafka/JVM backend** as one Worker. Existing GitHub Pages site can remain static and public; keep private APIs behind an authenticated ingress, not a quick public tunnel.

Official references: 
- documented source
- documented source
- documented source
- documented source
- documented source

## Exact owner input needed for next deployment milestone

**Hosting:** confirm an eligible ARM/Linux VM exists or pick cloud account and region. Grant only least-privilege deployment access via an approved tool, or create a non-root deployment account under your control. Never share SSH private keys in chat.

**Gemini:** GitHub repository Settings → Secrets and variables → Actions → new secret `GEMINI_API_KEY`. Use a confirmed free-tier project with no linked paid billing. Set the repository variables `ADDRESSRAIL_ENABLE_REAL_GEMINI_EVAL=true` and `ADDRESSRAIL_GEMINI_FREE_TIER_CONFIRMED=true` only after checking the project. Run the manual evaluation with model `gemini-3.5-flash-lite`. Don't put keys in code or chat; Github free-tier inference may have quotas and free-tier processing terms.

**Swift/ISO:** confirm you may access, export and use the particular CBPR+ Usage Guidelines from MyStandards for your target message and release. Don't share confidential or restricted files through public GitHub; provision via a private approved workflow.

**Account/identity:** pick an OIDC identity provider and verify that it can issue signed tokens with a tenant claim. The current test harness generates synthetic signing keys locally; no production IdP credentials are committed.
