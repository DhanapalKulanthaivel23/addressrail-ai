# AddressRail Go deterministic rail engine

**Actual role:** low-overhead rules evaluation, synthetic format checks, deterministic event reconciliation and parallel batch processing. This is separate from Java payment orchestration and Python AI investigation.

**Scope:** training data **only**, no SWIFT/EPC/CHAPS usage-guideline validation or ISO base XSD validation; not an AML/sanctions screen, gateway, production clearing/settlement or retry authorisation. Every response sets `settlementAttested:false` and `safeToRetry:false`.

## Build and test

Requires **Go 1.23+**. No third-party Go dependencies:

```bash
cd rail-engine
go fmt ./...
go test -race ./...
go vet ./...
go test -run '^$' -bench '^Benchmark' ./internal/rails
go run ./cmd/raild
```

The server binds to **127.0.0.1:8094** (the only permitted interface). You can change only the **port** with `RAIL_ENGINE_PORT` in 1024–65535. HTTP has fixed request/header timeouts, no CORS and strict JSON input. It rejects HTTP requests with browser `Origin` headers, unknown JSON fields and request bodies beyond 64KiB (512KiB for batches).

## Local endpoint examples

```bash
curl -sS http://127.0.0.1:8094/healthz

curl -sS -X POST http://127.0.0.1:8094/v1/validate \
  -H 'Content-Type: application/json' \
  -d '{"synthetic":true,"rail":"SCT","messageType":"pacs.008","currency":"EUR","amount":"125.00","reference":"AR-DEMO-SCT-001","debtorIban":"DE89370400440532013000","creditorIban":"FR1420041010050500013M02606"}'

curl -sS -X POST http://127.0.0.1:8094/v1/reconcile \
  -H 'Content-Type: application/json' \
  -d '{"synthetic":true,"paymentId":"PAY-10001","recordedStatus":"RJCT","events":[{"paymentId":"PAY-10001","occurredAt":"2026-10-13T09:03:00Z","type":"RJCT","source":"synthetic-status-feed","evidenceRef":"DEMO-EVT-004"}]}'
```

**Optional throughput interface:** `POST /v1/validate/batch` with a **JSON array of 1–100** requests. Workers are bounded to **at most 8** goroutines and results are returned in input order. Run `go test -bench` for measurements on your own hardware; no unsupported fixed TPS claims.

The Go service does **not** use an LLM. It deliberately returns `CONSISTENT` or `REVIEW_REQUIRED` on a fictional event trail, not an authoritative bank outcome. The input must use fictional references such as `AR-DEMO-...`, `TEST-...` or `SYNTHETIC-...`.

### Integration responsibilities

| Language | Ownership |
|---|---|
| **Go** | Cross-rail rule IDs, format checks, evidence correlation, bounded concurrency |
| **Java / Quarkus** | Local payment records and state, persisted events, synthetic workflow, controlled call to Go |
| **Python** | Read-only investigation and optional Gemini explanation, independently validated advice and human-review safeguards |
| **JavaScript** | Public static educational frontend, no direct access to Go, no secrets |

See `docs/JAVA-GO-PYTHON-ARCHITECTURE.md` for integration examples and safety limits.
