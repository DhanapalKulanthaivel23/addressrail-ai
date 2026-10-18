# AddressRail AI — delivery status and external deployment blockers

**Review date:** 17 October 2026. **Scope:** independently tested fictional/local payment software, *not* a certified bank SaaS.

## Implemented and validated in GitHub Actions

| Delivery | Evidence |
|---|---|
| Java 21/Quarkus local payment records, fictional payment intake, event history, case creation and audit-like training-case events | `payments-core/`; Maven test suite, Go→Java contract CI |
| Go independent HTTP validation, reconciliation, streaming ISO XML subset | `rail-engine/`; race, vet, format and benchmarks in CI |
| Eleven optional Go educational rail-scoped service processes | `RAIL_ENGINE_RAIL` + `deploy/run-rail-services.sh`, profile restriction tests |
| Python LangGraph evidence controls, versioned-source RAG and optional Gemini explanations | `ai-agents/investigation/`; Python evals; live Gemini needs secret |
| Real localhost Apache Kafka broker, versioned JSON events, three Python consumer roles, bounded retry and DLQ | `deploy/compose.kafka.yml`, `kafka_bus.py`, `kafka_workers.py`; real Kafka integration CI |
| Protected fictional API submission, idempotency, immutable SQLite report and download | `pipeline_api.py`, `pipeline_store.py`, real E2E CI artifact |
| Public educational GitHub Pages labs and browser smoke | `web/`; browser smoke workflow |

**Real Kafka CI** starts an actual KRaft broker, Go and Java Quarkus and runs a Python E2E test. It verifies fictional XML submission via producer, separate Kafka validation, investigation and report messages, Java synthetic payment/case persistence, Go validation, AI disabled safely, download, no real settlement or retry claims. A synthetic JSON report is retained as a short-lived GitHub Actions artifact.

## NOT implemented; do not claim completed SaaS

- No real bank connections or actual payment movement, clearing, settlement, account opening, SWIFT Tracker services, sanctions provider APIs or certified scheme processing.
- No **full** independent service per payment scheme. Eleven Go processes are educational rule profiles; Java is still a shared payment backend. GPI/G4C are limited fictional UETR/message checks.
- No versioned licensed ISO 20022 XSD, network usage guidelines or signed standards-expert conformance results. Local XML is a teaching subset.
- No production cloud Kafka cluster, Kafka TLS/SASL/ACLs, schema registry, consumer lag/SLO dashboards, durable outbox, distributed tenant-isolated DLQ, exactly-once processing or disaster recovery.
- No production customer sign-up, bank SSO/OIDC, complete enterprise multi-tenant system, organisation-scoped API authorisation, billing, commercial contracts or retention controls.
- Real Gemini run 39032297247 recorded three actual provider responses. Job logs show grounding, relevant citations and rule-ID preservation passed **2/3**, while status preservation, unsafe-claim and human-review checks passed **3/3**. This is partial acceptance, not a passing AI quality assessment. The live evaluation now fails on any rejected sample or failed metric; failed-run artifacts are retained.
- No hardened public internet deployment of the Java/Go/Python/Kafka stack. GitHub Pages currently serves only the static site. Local H2 and SQLite are not substitutes for secured tenant-scoped PostgreSQL.
- No independent security/penetration test, DLP certification, payment standards SME approval, procurement or regulatory acceptance.

## What account access / decisions are required to continue

1. **Hosting**: authorise a persistent Linux VM or cloud runtime capable of running Kafka, JVM, Go, Python and a database. GitHub Actions and GitHub Pages do not provide permanent free backend hosting. Some provider free tiers may be insufficient or unavailable; review cost limits first.
2. **AI**: create a Gemini API key via the provider and store it in the service secret manager or GitHub Actions secrets, **never in chat, public source or frontend JavaScript**. Explicitly approve provider usage costs/free-tier limits.
3. **Production identity/DB**: choose customer identity provider (OIDC) and managed PostgreSQL; provide test-tenant configuration via secure connection.
4. **Rules and banking data**: obtain applicable permitted-to-use standards materials and signoff; ensure only approved synthetic data is used for all demos.

Do **not** provide bank account data, OAuth tokens, passwords, private keys or SWIFT credentials in chat. Production release cannot be called complete without a real deployment and those independent checks.
