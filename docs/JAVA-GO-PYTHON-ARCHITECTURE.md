# Java + Go + Python: real contribution by responsibility

The repository contains three **substantial, different backend roles**, not just placeholder language files. The public browser site remains a static educational demo.

| Component | Main responsibility | Code |
|---|---|---|
| Java 21 / Quarkus | Payment/event persistence, training workflows, orchestration and controlled Go delegation | `payments-core/` |
| Go 1.23+ | High-throughput deterministic rule checks (IBAN, BIC, amount, UETR, rail profile), chronological event correlation, bounded concurrent batches | `rail-engine/` |
| Python 3.12 / LangGraph | Structured read-only investigations, tool orchestration, human-control findings, optional Gemini explanation with strict output safeguards | `ai-agents/investigation/` |
| JavaScript | Free static GitHub Pages demos with synthetic examples; never a bank or Go connection | `web/` |

## Why Go for these operations?

- **CPU-bound deterministic checks:** Go's strict stdlib routines can compute IBAN modulo-97, parse identifiers and check rail-specific currency/messages with low allocation and no external model/SDK.
- **Concurrent validation:** a bounded worker pool processes at most 100 synthetic records per request with stable output ordering. A standard Go benchmark and race-enabled tests quantify performance on your own hardware rather than asserting unsupported TPS figures.
- **Read-only cross-rail event reconciliation:** Go checks chronology, consistent payment ID, event source, duplicate references and status agreement. It never asserts real settlement or decides safe retry.
- **Separation of ownership:** Java controls persistence and API/domain workflows, Python controls any AI explanation and investigation. Neither needs to be rewritten into Go.

## End-to-end local integration

**Terminal A — Go rules**

```bash
cd rail-engine
go run ./cmd/raild
```

**Terminal B — Java records / workflows**

```bash
cd payments-core
ADDRESSRAIL_LAB_GO_ENGINE_ENABLED=true mvn quarkus:dev
```

**Terminal C — Python investigation (optional Gemini)**

```bash
python -m pip install -r ai-agents/investigation/requirements.txt
PYTHONPATH=ai-agents INVESTIGATION_ENABLE_GO_RULES=true \
  uvicorn investigation.app:app --host 127.0.0.1 --port 8093
```

**A request across Java → Go**

```bash
curl -fsS http://127.0.0.1:8081/api/v1/labs/go-engine/payments/PAY-10001/reconcile
```

Java reads its **locally persisted** record/events, sends only fictional IDs/timestamps/status/source/evidenceRef to Go, and returns rule IDs/verdict with `settlementAttested:false` and `safeToRetry:false`.

**An investigation across Python → Java and Go**

```bash
curl -fsS -X POST http://127.0.0.1:8093/investigate \
  -H 'Content-Type: application/json' -d '{"payment_id":"PAY-10001"}'
```

Python fetches Quarkus data, runs its own deterministic finding and asks Go for a separate event consistency check **before optional Gemini**. When Go is enabled but unavailable, Python returns an insufficient-evidence result rather than allowing the model to invent an outcome.

The integration CI workflow `.github/workflows/java-go-python-integration.yml` starts an actual Go process, then runs Java Quarkus tests and Python adapter/HTTP contract tests against it. Each component also retains its independent CI.

## What is *not* moved to Go

- Java JPA entities, ORM transactions, Quarkus resources and synthetic case workflows: migration to Go would duplicate or invalidate the Java domain model for no business benefit.
- Python LangGraph state machine, Gemini calls, Pydantic advisory verification and audit/explanation logic: these belong near Python's AI ecosystem.
- Public browser labs: GitHub Pages cannot execute Go, Java or Python servers, so adding a local Go engine does not automatically make public pages use it.
- Licensed ISO base XSD validation, EPC/Swift conformance, customer PII screening, sanctions decisions, real Swift connectivity, real bank settlement, authentication and production reconciliation: **not implemented or claimed**.

**Safety:** Synthetic-only data. Loopback-only servers with opt-in connections; no CORS, unknown outcomes remain unknown, no model releases or resubmits payments. This is software architecture and educational engineering, not certification or a production installation.
