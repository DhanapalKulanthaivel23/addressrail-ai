# AI Payment Investigation Copilot — P1 implementation and verification

**Status (16 October 2026): local synthetic engineering prototype, NOT a production banking service.**

This deliberately does **not** replace the existing GitHub Pages user interface or claim live bank connections. It adds an opt-in `/api/copilot/v1/investigate` API to the isolated Python service and a LangGraph workflow backed by existing Java Quarkus and Go processes.

## Four P1 requirements

| Requirement | Implementation | Evidence / limitation |
|---|---|---|
| Real Gemini-generated explanations | `copilot_llm.py` uses the real Gemini `generateContent` HTTPS API; JSON schema, required status and evidence refs, exact Go rule IDs, bounded citations, human-review gate | Real invocation **requires** a private `GEMINI_API_KEY` and explicit enable flag. CI uses mocked responses. No production deployment or actual live output claimed. |
| Version-aware Swift/ISO RAG | `rag.py` uses deterministic local sparse TF-IDF vector similarity and metadata (source URL, version, reviewed and effective date) over a small curated original-paraphrase catalogue | Eight verified-source *short summaries*, NOT complete licensed rulebooks/XSDs, semantic embedding API, managed vector DB or scheme implementation guidelines. Abstain when no relevant evidence. |
| Real model-output recording and evaluation | `eval_harness.py`: 10 synthetic cases; offline retrieval metrics; opt-in live provider recording capturing model/version/date/prompt SHA-256/response ID/tokens/model output and rule-based evaluations | **No fabricated live recordings.** A genuine key and explicit live invocation are needed. Never commit test provider outputs or credentials without review. |
| Explain Go validation findings through AI | `copilot.py` LangGraph chain: Java payment/event evidence → Go reconciliation and optional Go XML finding paths/IDs → versioned RAG → Gemini structured answer; exact IDs bound by validator | Go remains the deterministic checker. If Go is required but unavailable, provider call is skipped; the AI cannot authorise settlement or retry. |

## Architecture / services

```text
Local/API gateway (opt-in bearer token, no browser Origin)
    |
    v
Python FastAPI + LangGraph (read-only synthetic case)
    |                 |                    |
    |                 |                    +--> Versioned, allowlisted standards
    |                 |                         local sparse vector search
    |                 |                         [id, version, effective date, URL]
    |                 +--> Go localhost rules engine 127.0.0.1:8094
    |                      (event reconciliation and streaming XML inspection)
    +--> Java Quarkus 127.0.0.1:8081
         (persisted synthetic event facts)
                          |
               [bounded text and citation IDs only]
                          v
                Managed Google Gemini API
                          |
             strict Pydantic + immutable-status
             citations and Go-rule binding
                          |
            human-review advice OR abstention
```

**Secure data access:** Python retrieves only existing read-only Java case/status/events; Go only accepts synthetic payloads; the LLM receives the status/evidence reference, short deterministic findings, Go rule IDs and short paraphrased source summaries. **Raw XML, customer names, bank account fields and backend credentials are never included in the copilot Gemini prompt.** A synthetic marker and a small regex blocklist cannot reliably detect all personal or bank data; real banking integration requires a governed PII/DLP pipeline and legal approval.

**API gateway:** `COPILOT_ENABLE_API=true` and a random `COPILOT_API_TOKEN` of at least 32 characters are required. Direct browser-Origin requests are refused, no CORS is added, body size is bounded, responses are not cached, and there is a small in-memory throttle. This is a **local training gate**, not enterprise IAM or production API management.

**Event-driven workflow:** `event_queue.py` provides a bounded, optional, in-process `asyncio.Queue` with enqueue/process/review states and expiry. It is **not durable**, not Kafka and not distributed exactly-once delivery. Introduce a managed message broker, idempotency keys and an outbox pattern before claiming bank-grade event orchestration.

## Run locally

Start Go:

```bash
cd rail-engine && go run ./cmd/raild
```

Start Java Quarkus:

```bash
cd payments-core && mvn quarkus:dev
```

In a third terminal, create a random API token **without writing it to a file or repository**:

```bash
python -m pip install -r ai-agents/investigation/requirements.txt
export COPILOT_ENABLE_API=true
export COPILOT_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(36))')"
export COPILOT_REQUIRE_GO=true
PYTHONPATH=ai-agents python -m uvicorn investigation.app:app --host 127.0.0.1 --port 8092
```

In another terminal, use the **same secret** privately, not pasted into README/chat:

```bash
curl -fsS http://127.0.0.1:8092/api/copilot/v1/investigate \
 -H "Authorization: Bearer $COPILOT_API_TOKEN" \
 -H "Content-Type: application/json" \
 -d '{"payment_id":"PAY-10001","question":"Explain CBPR+ pacs.008 rejection and missing status evidence"}'
```

Gemini is disabled by default: the response contains citations and deterministic findings but `ai_used:false`. To test actual Gemini from a private shell, **opt in** to `INVESTIGATION_ENABLE_GEMINI=true`, choose a model accessible in your provider account, and set `GEMINI_API_KEY` securely. Model names and provider availability change; there is no guarantee of a free quota. Do not put keys in Github Pages/config.js.

Optional synthetic-XML case (no raw XML reaches the model): add `synthetic_xml` with a fictional `<Document ...>` string to the request. Go will inspect the XML and pass selected rule IDs/paths to the LLM.

## Evaluation and reproducible evidence

Offline CI:

```bash
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests
PYTHONPATH=ai-agents python -m investigation.eval_harness
```

Opt-in, actual Gemini output capture (may consume paid quota):

```bash
INVESTIGATION_ENABLE_GEMINI=true GEMINI_API_KEY="<private key in environment>" \
 PYTHONPATH=ai-agents python -m investigation.eval_harness --live \
 --confirm-live-provider-cost --limit 5 --output /tmp/addressrail-gemini-real-run.jsonl
```

**Do not copy a key into CLI history:** set `GEMINI_API_KEY` by your secret manager or interactive secure read. The command above illustrates the variable's presence, not a recommendation to type a secret on the command line.

The recording function requires a provider response ID and fails without creating a file if it cannot verify each requested response. It uses a new output path and restrictive file permissions, saves no provider key and retains only synthetic prompts/outputs. An internal tool or independent reviewer should review contents before distribution.

Offline suite is **not** proof of actual Gemini success, provider availability, or model accuracy. Report acceptance/failure per case with dated provenance; do not describe authored fixtures as production metrics.

## Recommended suites: current versus future

| Concern | Implemented here | Appropriate production services to evaluate |
|---|---|---|
| Orchestration | Python LangGraph | LangGraph durable execution + LangSmith traces/evaluations (subject to data controls) |
| Managed LLM | Gemini REST with strict JSON and evidence gates | Vertex AI or another managed LLM provider with region, retention, policy and quota review |
| Retrieval/vector | Versioned local sparse TF-IDF vectors; original-paraphrase summaries | Postgres/pgvector, Azure AI Search, Vertex AI Vector Search, OpenSearch k-NN (with licensed source ingestion and access controls) |
| LLM evaluation | Own deterministic synthetic corpus and provider-output recorder | promptfoo, DeepEval, Ragas, LangSmith datasets, red-team/security regression suites |
| PII/DLP | Conservative heuristic precheck and no raw XML prompt | Microsoft Presidio + institution DLP controls and encrypted private tenancy |
| Secure gateway | Local bearer token/no CORS/bounds | OAuth2/OIDC, Kong/Apigee/Azure API Management, WAF and enterprise RBAC |
| Asynchronous events | Bounded in-process `asyncio.Queue` training example | Kafka/Confluent, Pub/Sub, Event Hubs, durable retry/dead-letter, idempotent consumers |
| Monitoring | Safe metadata-only logs | OpenTelemetry, restricted traces, SIEM integration, provider safety telemetry |

**Do not claim you have shipped this to production.** Real production readiness requires authentication, network isolation, observability, threat model, rulebook licences, standards SME sign-off, consumer account governance, rollback, change control, durable traces, evaluation on authorised data, and sign-off from risk/legal/compliance.

## Acceptance / safety invariants

- Rejection, pending and unknown states cannot be overwritten by an LLM.
- Gemini responses cannot introduce new citation IDs, Go rule IDs or payment evidence refs.
- Any unsupported statement about real settlement, sanctions clearance or safe retries must be rejected.
- Prompt-injection text in source summaries or user questions is not treated as instruction.
- Missing source records, missing Go evidence or malformed provider response yields no LLM advice.
- Each synthetic case retains `requires_human_review:true`, `settlement_attested:false`, `safe_to_retry:false`.
- Failed tests must be fixed before declaring any milestone passed.
