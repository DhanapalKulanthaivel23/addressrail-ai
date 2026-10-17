# AddressRail synthetic multi-rail network (first working slice)

**Independent simulator, not Swift, EPC, Bank of England, TARGET Services or Bacs infrastructure.** Never supply real payment instructions, PII or live bank credentials. The eight *illustrative routing profiles* are SWIFT_CBPR, SEPA_SCT, SEPA_SCT_INST, SEPA_SDD, RTGS, CHAPS, T2 and BACS. Scheme rules and message formats are **not** fully implemented.

This first slice provides persistent Bank A → mock network → Bank B → Bank A response via loopback REST and local JSON files. Network acceptance is a **synthetic transport acknowledgement**, not an authorization, settlement or bank-credit confirmation. No actual banks are connected, and the bank identity field is **not authenticated**. Do not expose the API outside localhost.

## REST mode

Run `python network-simulator/api.py` (stdlib only; listens on 127.0.0.1:8099). Sample sender:

```bash
curl -s -X POST http://127.0.0.1:8099/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{"rail":"SWIFT_CBPR","sender":"BANKAA22","receiver":"BANKBB33","format":"MT103","payload":"{1:SIMULATED}","correlation_id":"TEST001"}'
```

This returns a `message_id`. Receiver polls `GET /v1/banks/BANKBB33/inbox`. Receiver responds via `POST /v1/messages/{message_id}/respond` with `{"bank":"BANKBB33","state":"REJECTED","reason":"BANK_REJECTED"}`. Sender polls `GET /v1/banks/BANKAA22/messages/{message_id}`. Bank outcome remains distinct from simulated network ACK.

## File mode

Use one input JSON file per operation and a distinct output directory. The tool publishes one response JSON atomically without overwriting a previous result:

```bash
python network-simulator/file_adapter.py --db local-network.sqlite3 --in requests/req001.json --out replies
```

For submit, the file is `{"action":"submit","data":{...same six request fields...}}`. For a response, the file is `{"action":"respond","message_id":"...","data":{"bank":"BANKBB33","state":"ACCEPTED","reason":"BANK_ACCEPTED"}}`.

## Testing

Run `python -m unittest discover -s network-simulator/tests -v`. GitHub Actions runs this on PRs.

## Explicitly not complete

- IBM MQ / JMS adapter and durable message queues (planned; Kafka in the repo is separate).
- SAA-like and SAG-like services as independent secured microservices.
- TLS / mTLS, per-bank service identities, secrets management, quotas and tenant segregation.
- MT103 → pacs.008 production translation and CBPR+ rule conformity.
- Real pacs.002, pacs.004, technical NAK and async processing semantics for each rail.
- Scheduled settlement, cut-offs, liquidity, sanctions screening and bank-core posting.
- Full automatic REST/MQ/file round trip with independent bank processes, retries, deduplication across network transport, fault injection and operational dashboards.

This implementation is intentionally one small executable foundation, **not a complete multi-rail network**.

## MQ-style request/reply contract

`mq_adapter.py` provides a transport-neutral `process_once()` for queues exposing `get()` / `put()`. The envelope has the same `action=submit|respond` format as the file adapter. Unit tests exercise both Bank A → Bank B and Bank B → Bank A using a Python in-memory queue. **This is not an IBM MQ or Kafka broker implementation:** no real broker connectivity, transactions, backout/DLQ, TLS, authentication, or queue-manager integration is included yet. Connect those in a separate adapter before using an actual MQ system.
