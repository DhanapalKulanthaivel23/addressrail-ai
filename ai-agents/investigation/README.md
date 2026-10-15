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
