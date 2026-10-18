# Payment Investigation Agent v1 — synthetic educational lab

This is a **separate, local-only Python AI lab** for the full AddressRail AI SaaS roadmap. It does not change or connect to Cloudflare, Turnstile, Render, the existing website, SEO registrations or the public Gemini backend. Do not expose this API publicly or send real customer data.

## Local setup

First start the Java service separately:

```bash
cd payments-core
mvn quarkus:dev
```

In another terminal (from the repository root):

```bash
python3 -m venv .venv-investigation
source .venv-investigation/bin/activate
pip install -r ai-agents/investigation/requirements.txt
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests
PYTHONPATH=ai-agents python -m uvicorn investigation.app:app --host 127.0.0.1 --port 8092
```

Then call:

```bash
curl -s -X POST http://127.0.0.1:8092/investigate -H 'content-type: application/json' -d '{"payment_id":"PAY-10001"}'
```

By default the deterministic investigation works with **no LLM or credentials**. The LangGraph graph uses two read-only tools, verifies synthetic-only source evidence and returns review-required conclusions; no payment mutation tools exist.

**Optional personal Gemini trial**: Set `INVESTIGATION_ENABLE_GEMINI=true` and a private environment variable `GEMINI_API_KEY` locally; never write keys to repository, chat or public pages. `INVESTIGATION_GEMINI_MODEL` is configurable. This is a separate, bounded advisory request and does not change payment status or source evidence. It is disabled by default. Model availability, free usage, privacy and quotas depend on your account and location. Do not use any non-synthetic input.

The service logs outcome, whether AI was used and duration (not raw payments or prompts). This is an educational stage: it lacks identity/tenant isolation, persistent case approvals, source-attested events, production policy enforcement, durable traces and public deployment. Human approval is *required by contract*, not yet an operational approval UI.

Run tests without Java or Gemini: tests use `httpx.MockTransport`. Next: stateful case persistence, prompt registry, evaluation corpus, local UI, authenticated tool access, and optional source-grounded RAG.

## Testing Gemini locally (optional)

The Gemini advisory is **disabled by default** and never changes the deterministic payment status, evidence references or review requirement. It requests JSON, checks an exact status and exact evidence reference list, and refuses malformed or unsupported conclusions. These checks are defensive filters, **not a guarantee** of factual AI accuracy.

With the local Quarkus and investigation services running, restart the investigation process after setting the environment variables in its own terminal:

```bash
export INVESTIGATION_ENABLE_GEMINI=true
export INVESTIGATION_GEMINI_MODEL=gemini-3.8-flash
# Enter your own key securely in the terminal; do not paste it into chat or commit it.
read -s GEMINI_API_KEY
export GEMINI_API_KEY
PYTHONPATH=ai-agents python -m uvicorn investigation.app:app --host 127.0.0.1 --port 8092
```

Then POST the same synthetic PAY-10001 case. If the selected Gemini model is supported, the quota permits a response and the output passes evidence checks, `ai_used` becomes `true`. Otherwise it remains `false` with the deterministic evidence preserved. **Do not connect this unauthenticated local API to a public network.**

For offline AI-output evaluations (no network or API key), run:

```bash
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests
```

## Diagnosing structured Gemini output

The request specifies a JSON schema and a 1024 output-token budget. The adapter checks Gemini's `finishReason` before parsing; `MAX_TOKENS`, `SAFETY`, missing/empty output, invalid JSON or unsupported evidence claims fall back to deterministic investigation. Uvicorn logs include only safe reason codes, such as `finish_MAX_TOKENS`, `invalid_json`, `empty_output`, `evidence_validation`, or `http_status_503`. They do not include prompts, responses or credentials. A passing mock test does **not** verify a successful live Gemini response; check for `ai_used: true` in a real synthetic investigation.

Only use models available to your own free-tier account. No paid plan or billing change is needed for the deterministic workflow.

## Investigation Agent v2 — SEPA SCT, SCT Inst, and CHAPS

This release extends the **read-only** evidence-grounded workflow to the synthetic events produced by all three Quarkus teaching modules. It distinguishes recorded `RJCT`, `PENDING`, `UNKNOWN`, `ACTC`, `ACSC`, and `SIMULATED` statuses. Unsupported event types continue to be reported as `OTHER`. No model can change the payment status or override a mismatched last event; every result requires human review.

| Recorded synthetic status | Deterministic interpretation |
| --- | --- |
| `RJCT` | Rejected according to the last recorded synthetic event, with its evidence reference. |
| `PENDING` | Recorded processing or liquidity hold; no settlement is established. |
| `UNKNOWN` | Missing or uncertain outcome; reconcile before retrying or taking an action. |
| `ACTC` | Technical acceptance only; not settlement. |
| `ACSC` | Lab-recorded ACSC; no external settlement or beneficiary-credit attestation. |
| `SIMULATED` | A teaching trace, not an actual payment. |

Optional Gemini structured commentary now accepts all these evidence-grounded findings (and `OTHER`). The model must echo **exact** payment status, ordered evidence references, and human-review requirement. Existing unsupported-settlement checks and deterministic fallback remain in place.

**Gemini availability:** HTTP 503 triggers **one** extra attempt after a short 250 ms wait; a second 503 falls back immediately. HTTP 429 is **not retried**. No retries occur after a success. This does not ensure availability, and a real successful CHAPS/SCT Inst Gemini response remains unverified until tested with a legitimate synthetic local case. HTTP reason codes are logged without response content or credentials. The extra request can consume an additional quota unit; Gemini is opt-in only.

Run the offline test suite with `PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests`. For integration, start Quarkus dev mode, create a synthetic SCT, SCT Inst, or CHAPS record in its local lab and pass the generated ID to `/investigate`. A result with `ai_used: false` still retains evidence-grounded deterministic findings. The lab has no real-world state authority or autonomous payment-repair actions.

## Unified Investigation Dashboard v1 (local)

With **Quarkus Payments Core** running locally on port 8081 and the Python investigation service on port 8093, open:

**http://127.0.0.1:8093/dashboard**

Launch from the repository root:

```bash
cd payments-core && mvn quarkus:dev
# In a second terminal, from repository root:
PYTHONPATH=ai-agents .venv-investigation/bin/python -m uvicorn investigation.app:app --host 127.0.0.1 --port 8093
```

Use the dashboard to browse up to 40 local synthetic cases at a time, filter by recorded status or search an exact ID; view chronological event evidence; and explicitly choose **Investigate selected payment**. Only that button invokes the LangGraph workflow and optional Gemini advisory. No Gemini call occurs while listing or opening cases. A clear badge reports whether the output was model-generated or deterministic; both require human review.

The dashboard uses **same-origin requests to FastAPI** and read-only server-side calls to Quarkus. It does not require browser CORS access to either API. The Quarkus `GET /api/v1/labs/cases` endpoint is enabled **only in local dev/test profiles**, returns synthetic records only, and caps results at 100; it has no mutation method. The existing public GitHub Pages website and Render/Cloudflare integrations are unchanged. **Never bind either local server to a public interface**: there is no authentication, tenancy isolation or CSRF defence suitable for production.

Technical limitations: the catalogue is not a paginated enterprise search, filters currently operate on a bounded local list, case-event history is synthetic and mutable in H2, and the dashboard provides no human approval persistence. These require authentication, audit, tenant isolation, data retention controls and verified integrations before banks can use a hosted SaaS.

## Synthetic Investigation Case Management v1

The existing unified dashboard at **http://127.0.0.1:8093/dashboard** now includes a **Training case management** panel. Start Quarkus locally on port 8081 and the investigation agent on port 8093, then select a synthetic payment. You can open one synthetic case for it, add short notes, change state among `OPEN`, `IN_REVIEW`, `ESCALATED`, and `CLOSED`, assign an invented `TRAINING-*` owner label, and inspect a chronological activity list. Existing payment records, event histories and status cannot be mutated by case-management operations. Case activity is application-append-only, but not tamper-proof: H2 is an unprotected local training database.

**No real identities or approvals:** reviewer and owner strings are invented labels such as `TRAINING-Analyst1`; they do **not** authenticate, authorise or identify users. An `ESCALATED` or `CLOSED` case has no effect on payment processing or settlement. Do not enter names, real customer information or private evidence into training notes.

The Quarkus case-management API is at `/api/v1/labs/investigation-cases`, with same-origin FastAPI dashboard proxy endpoints under `/api/dashboard/workflow`. It is enabled **only under the local dev/test profiles** and disabled by default and in production. Unlike the separate read-only payment APIs, this teaching endpoint intentionally persists synthetic case activity. The dashboard operates without authentication only because both services must be bound to loopback and must **never** be published to the network.

Before any bank pilot, this module still requires authentication, real reviewer identity and access control, tenant isolation, optimistic concurrency verification across clients, immutable externally anchored audit, evidence snapshots, secure note handling, data retention, and approval separation of duties. No billable resources, cloud access or new production deployment are part of this milestone.

## Optional Go independent evidence validation

The Python LangGraph agent has an opt-in second deterministic check against the local Go `rail-engine`. Python remains responsible for structured investigation and optional Gemini explanations. Java Quarkus remains the primary payment/events data owner.

Start `rail-engine` on `127.0.0.1:8094` and Quarkus on `127.0.0.1:8081`, then run the agent with:

```bash
INVESTIGATION_ENABLE_GO_RULES=true GO_RULES_URL=http://127.0.0.1:8094 \
  uvicorn investigation.app:app --host 127.0.0.1 --port 8093
```

With `INVESTIGATION_ENABLE_GO_RULES=true`, the agent checks the **same fictional payment and event history** with Go before allowing optional LLM explanation. `UNKNOWN` and `PENDING` remain unknown/pending and require human reconciliation. Mismatched event IDs, timestamps, status or missing Go service lead to an `INSUFFICIENT_EVIDENCE` outcome; Go never authorises a retry or settlement. When disabled (default), the existing Python-only investigation works unchanged.

`GoRulesClient` allows loopback `http://127.0.0.1:<port>` only; requests are bounded, redirect-following is disabled, and unexpected Go contract replies are rejected. This is a local *synthetic educational* integration and not an independent trusted production status source. Never pass real customer or bank data.

### Go streaming XML subset as a Python tool

An optional `GoRulesClient.inspect_xml(rail, fictional_xml)` method calls the same Go `/v1/xml/inspect` service. It validates the response type and refuses unexpected settlement or safe-to-retry claims. This is **not** wired to upload real payment content or authorise an LLM to execute payments.

The default investigation path still needs no Go service; enable `INVESTIGATION_ENABLE_GO_RULES=true` only when running all local components.
