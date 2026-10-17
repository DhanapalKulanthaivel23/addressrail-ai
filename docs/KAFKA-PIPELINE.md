# Kafka synthetic payment pipeline — runnable engineering stage

**Scope:** Real Apache Kafka transport; separate local Java/Quarkus, Go and Python services; **only fictional ISO 20022 pacs.008 payloads**. This is not connected to Swift, clearing houses, banks or live customer data. The existing browser-only GitHub Pages demo stays independent. No cloud credentials or payments occur.

## What works

1. Submit the synthetic CBPR+ `pacs.008` XML + new or existing fictional Java payment ID (for example `PAY-KAFKA-EXAMPLE-001`) to the **protected Python API** with a unique `Idempotency-Key`.
2. Python stores the job in **SQLite** and publishes `addressrail.payments.submitted.v1` through a **real Kafka producer** with broker delivery acknowledgement.
3. A separate `validate` consumer asks the **Go** service to stream-check XML and publishes `addressrail.payments.validated.v1`, including rule IDs, element paths and an educational subset validity result.
4. A separate `investigate` consumer creates or reuses a **fictional payment record** in Java/H2 (default simulated RJCT status), then calls **Python LangGraph**, which retrieves authoritative-for-this-*synthetic-lab* Java events, calls Go for event correlation, fetches dated sources from the local RAG index and optionally requests Gemini advice when configured. It creates or reuses a **Java H2-backed training case** and publishes `addressrail.payments.investigated.v1`.
5. A separate `report` consumer writes an **immutable JSON investigation report** to SQLite. `GET /api/pipeline/v1/submissions/{job_id}/report` downloads the report.

Each Kafka worker is independently runnable but shares one Python code package for transport orchestration. **The Go and Java services are separate OS processes; their Kafka interaction is currently through the Python workers and HTTP, not through native Go or Java Kafka consumers.** This distinction matters for bank-grade service decomposition.

## Run locally (no paid services)

Prerequisites: Docker Compose, Java 21 + Maven, Go 1.23+, Python 3.12+.

In the repository root:

```bash
docker compose -f deploy/compose.kafka.yml up -d
python3 -m venv .venv
. .venv/bin/activate
pip install -r ai-agents/investigation/requirements.txt
PYTHONPATH=ai-agents python -m investigation.kafka_workers topics
```

Start the **Go** service:

```bash
cd rail-engine && go run ./cmd/raild
```

Start **Java/Quarkus** in another terminal:

```bash
cd payments-core && mvn quarkus:dev -Ddebug=false
```

Start the **Python API** (only localhost), in a third terminal:

```bash
export COPILOT_API_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(36))')"
export COPILOT_ENABLE_API=true
export ADDRESSRAIL_ENABLE_KAFKA_PIPELINE=true
export PIPELINE_DB_PATH=./addressrail-pipeline.sqlite3
PYTHONPATH=ai-agents python -m uvicorn investigation.app:app --host 127.0.0.1 --port 8092
```

Start **three independent Kafka consumers** in three additional terminals, with `PIPELINE_DB_PATH` pointing to that same absolute SQLite path:

```bash
PYTHONPATH=ai-agents python -m investigation.kafka_workers validate
PYTHONPATH=ai-agents python -m investigation.kafka_workers investigate
PYTHONPATH=ai-agents python -m investigation.kafka_workers report
```

**Note:** if each terminal has a different current directory, export the same **absolute** `PIPELINE_DB_PATH` in all of them. Keep the API secret in the current shell or your local secret manager; don't commit it.

Submit via JSON:

```bash
curl -fsS -X POST 'http://127.0.0.1:8092/api/pipeline/v1/submissions' \
  -H "Authorization: Bearer $COPILOT_API_TOKEN" \
  -H "Idempotency-Key: AR-DEMO-UPLOAD-001" \
  -H 'Content-Type: application/json' \
  --data-binary @examples/kafka/pacs008-request.json
```

Then retrieve using the response's job ID:

```bash
curl -fsS -H "Authorization: Bearer $COPILOT_API_TOKEN" \
  "http://127.0.0.1:8092/api/pipeline/v1/submissions/AR-JOB-<id>"
curl -fsS -H "Authorization: Bearer $COPILOT_API_TOKEN" \
  "http://127.0.0.1:8092/api/pipeline/v1/submissions/AR-JOB-<id>/report" \
  -o synthetic-investigation-report.json
```

## Kafka topics and guarantees

| Topic | Producer → Consumer |
|---|---|
| `addressrail.payments.submitted.v1` | API → validation worker |
| `addressrail.payments.validated.v1` | validation → investigation worker |
| `addressrail.payments.investigated.v1` | investigation → report writer |
| `addressrail.payments.deadletter.v1` | failed workers after bounded retries |
| `addressrail.payments.retry.v1` | reserved, not automatically consumed |

The producer enables Kafka idempotence; workers use **manual offset commits after downstream publish**. There are up to two delayed republishes for recoverable event-processing errors before the DLQ (the error envelope omits raw XML). Existing Java training cases are reused after duplicate deliveries, and the final report cannot be silently replaced. This is **at-least-once**, not exactly once: a crash can leave a queued job without an event or duplicate side effects; report finalisation idempotence does not automatically solve all external side-effect transactions.

`Idempotency-Key` is unique per fictional upload. Reusing it with a different input returns HTTP 409. Broker timeout returns 503; same key may be retried. All reports set `synthetic:true`, `settlement_attested:false`, `safe_to_retry:false` and require human review. When Gemini is unconfigured, `ai_used:false`; deterministic Go/Python explanations still accompany the report.

## Run tests

```bash
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests/test_kafka_pipeline.py
PYTHONPATH=ai-agents python -m pytest -q ai-agents/investigation/tests
```

The **real Kafka/Go/Java** integration is gated by `ADDRESSRAIL_LIVE_KAFKA_TEST=true` and is run from GitHub Actions `kafka-payment-integration.yml` with services on localhost. It verifies submit, Kafka stage consumption and published events, Java case persistence, Go validation, full report download, and AI-off provider semantics.

### Limitations before any actual SaaS claim

No tenant-scoped Kafka partitions, OIDC, managed Kafka, durable outbox, robust PII/DLP, Java/Go native Kafka consumers, full ISO XSD/CBPR+ validation, bank-approved AI traces, distributed rate limits, schema registry or full per-rail microservices have been delivered by this stage. The pipeline creates or reuses a **fictional** Java/H2 record and status event for each unique PAY-* ID; XML upload does not transmit a live payment or derive an authoritative payment status. Never use real bank data.

Until Cloudflare/hosting accounts and security controls are explicitly provisioned, this entire event pipeline is **local development only**, not an internet-hosted product.
