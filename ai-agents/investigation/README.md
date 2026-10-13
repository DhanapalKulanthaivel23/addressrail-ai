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
