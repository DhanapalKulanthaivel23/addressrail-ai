# Enterprise Security Foundation v1 — isolated LOCAL synthetic lab

This is an explicitly **opt-in security training service**, separate from existing Quarkus payment simulations, public AddressRail AI website, Cloudflare, Render and Gemini. **Do not expose it on the internet, store genuine bank/payment/customer data or regard a training review as a genuine approval.** Its data is created for synthetic exercises only. There are **no demo user accounts or hardcoded credentials**.

## Implemented

- Password-authenticated local users with PBKDF2-HMAC-SHA256 and per-user random salts; one-hour, opaque bearer sessions stored hashed in SQLite. Logout revokes the session.
- Explicit synthetic organisation/tenant identifiers, scoped user creation and case lookup.
- Roles: `ADMIN` (manage users and synthetic cases), `INVESTIGATOR` (open cases), `REVIEWER` (make one synthetic review decision), `VIEWER` (read redacted case metadata).
- Separation: an investigator/admin cannot perform reviewer operations, reviewers cannot create cases, and the opening investigator cannot review their own case even if their role were changed later. A training decision never changes a Quarkus payment.
- Synthetic evidence and training decision notes are encrypted at rest using Fernet (AES128-CBC + HMAC via cryptography), with an externally provided secret key. The database never stores those bodies in plaintext.
- A keyed HMAC-SHA256 hash chain over action records, with admin-only verification. **Not immutable or externally anchored audit:** deletion of the most recent entries or compromise of both DB and key might go undetected. No guaranteed retention, WORM storage or independent timestamp authority.
- Fail-closed production-mode startup; no connection to real payment services, no outbound integrations.

## Local setup (no paid services)

Use a Python 3.12 environment and the existing `ai-agents/investigation/requirements.txt`. Start from the repository root:

```bash
python3 -m venv .venv-investigation
source .venv-investigation/bin/activate
pip install -r ai-agents/investigation/requirements.txt

umask 077
mkdir -p .local-enterprise
export ADDRESSRAIL_ENTERPRISE_DB="$PWD/.local-enterprise/enterprise.sqlite3"
export ADDRESSRAIL_ENTERPRISE_LAB_ENABLED=true
export ADDRESSRAIL_ENVIRONMENT=development
export ADDRESSRAIL_EVIDENCE_KEY="$(python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
export ADDRESSRAIL_AUDIT_KEY_HEX="$(python -c 'import secrets; print(secrets.token_hex(32))')"

PYTHONPATH=ai-agents python -m investigation.enterprise_bootstrap \
  --db "$ADDRESSRAIL_ENTERPRISE_DB" --tenant bank_demo --username admin_demo

PYTHONPATH=ai-agents uvicorn --factory investigation.enterprise:service_from_environment \
  --host 127.0.0.1 --port 8094
```

**Key persistence warning:** Save encryption and audit keys securely *outside the Git repository* and reload exactly the same keys when restarting. Losing an evidence key makes existing encrypted training data unreadable; changing the audit key invalidates historic HMAC verification. Do not paste keys into tickets or prompts. Do not use a free public tunnel or bind to `0.0.0.0`.

Send requests to `http://127.0.0.1:8094/v1/login` using the tenant, username and password entered during bootstrap. The returned bearer token lasts one hour. Use it as `Authorization: Bearer <token>` in `/v1/me`, `/v1/users`, `/v1/cases`, `/v1/cases/{id}`, `/v1/cases/{id}/review` and `/v1/audit/verify`. Only Admin can add users; request users with an explicit role `ADMIN`, `INVESTIGATOR`, `REVIEWER` or `VIEWER`. Open cases with `{"payment_id":"CHAPS-DEMO-001","synthetic":true,"evidence":"SYNTHETIC example note"}`. A Reviewer submits `{"decision":"APPROVED_FOR_TRAINING","note":"Evidence reviewed for teaching"}` (or `REJECTED_FOR_TRAINING`). **These are training classifications, never payment approvals.**

## Tests

```bash
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests
```

Offline tests cover unauthenticated access, wrong passwords, forged roles, cross-tenant reads and attempted reviews, reviewer independence, non-synthetic rejection, encrypted evidence at rest, HMAC audit modification detection, single-decision protection and logout.

## Before commercial use: outstanding work

This is **not** a deployable bank-grade IAM or case engine. The local training service still lacks independent identity provider/OIDC with MFA, resilient token revocation and rotation, rate limiting and credential lockout, real authorisation policy governance, user provisioning/deprovisioning, key management via a proper KMS/HSM, external/WORM tamper-resistant audit anchoring, backups and migrations, production PostgreSQL, evidence source attestation, document data-classification/DLP, formal regulatory controls, transport TLS behind a protected gateway, monitoring, vulnerability review, penetration tests and enterprise tenant lifecycle management. It is **not integrated** with existing Quarkus case-management records, and the current training evidence flag cannot prove that arbitrary submitted text is free of personal information.

No modifications to public hosting, visitor analytics, SEO registrations, or billing.

## Enterprise Security Foundation v2 — authenticated local dashboard

After completing the v1 local setup and starting the isolated enterprise server on port 8094, open:

**http://127.0.0.1:8094/enterprise/dashboard**

Sign in with your manually bootstrapped synthetic tenant and user aliases. The browser uses **only the same-origin isolated enterprise service**; it does not contact Quarkus, public GitHub Pages, Cloudflare, Render or Gemini. Its bearer token is stored only in tab memory (not cookies, localStorage or sessionStorage); closing/reloading the page discards that browser-side token. The server-side token still lives until it expires or is explicitly revoked by logout. Use **Log out** to revoke it.

The UI displays only operations allowed by the authenticated role, and the server independently checks role and tenant for every request:

| Role | Available UI controls |
| --- | --- |
| ADMIN | Tenant case list, create synthetic case, add tenant users, read evidence, verify keyed audit chain |
| INVESTIGATOR | Tenant case list, create synthetic case, read evidence |
| REVIEWER | Tenant case list, read evidence, independently decide an open synthetic case |
| VIEWER | Tenant case list, limited metadata only; no evidence plaintext |

No role in this service can release, settle, repair or modify a payment. Decisions explicitly say `APPROVED_FOR_TRAINING` or `REJECTED_FOR_TRAINING`. The reviewer cannot decide a case they themselves opened, and a decided case cannot be decided twice.

The HTML and JavaScript files are served from the local enterprise FastAPI instance with `Cache-Control: no-store`, no iframe embedding, same-origin-only scripts/connections and a restrictive Content Security Policy. Text data is rendered with `textContent`, never `innerHTML`. The dashboard requires no new NPM packages, separate frontend server, third-party fonts or paid hosting. **Do not expose this unauthenticated-by-network, password-only development server to the public internet.**

The existing public Banking Studio and local ports 8081/8093 are unchanged. Enterprise dashboard v2 is a **separate local isolated prototype**, not a migration or integration of the earlier Quarkus training cases; this avoids accidentally weakening the older demo workflows.

The new test suite additionally covers the dashboard route, browser security headers, login and logout, role forgery, no unauthenticated case access, and browser handling of bearer tokens. End-to-end interactive tests in a real browser, OIDC/MFA, KMS, external immutable audit storage, tenant data migrations, access review, vulnerability scanning and independent penetration tests remain outstanding.
