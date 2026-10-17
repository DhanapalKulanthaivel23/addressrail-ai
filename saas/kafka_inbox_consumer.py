"""Opt-in single-tenant synthetic Kafka consumer; no payment side effects.

The signed event is verified and inserted in PostgreSQL before Kafka offset
commit. Invalid events are NOT acknowledged; operators must configure a
quarantine strategy. Requires separately provisioned tenant-bound credentials.
"""
import json
import os
from uuid import UUID
from .inbox import record_event
from .quarantine import record_quarantine
from .outbox_dispatcher import TOPIC

MAX_BYTES=90000

def process_one(*, consumer, dsn, tenant_id, key, name="python-inbox", timeout=1.0):
    UUID(tenant_id)
    message=consumer.poll(timeout)
    if message is None:
        return None
    if message.error():
        raise RuntimeError("Kafka consumer error")
    if message.topic()!=TOPIC or not message.value() or len(message.value())>MAX_BYTES:
        raise ValueError("Unexpected or oversized synthetic Kafka event")
    try:
        event=json.loads(message.value())
    except (ValueError,UnicodeDecodeError,TypeError) as exc:
        raise ValueError("Malformed event JSON") from exc
    try:
        kafka_key=message.key().decode("ascii") if message.key() else ""
    except (UnicodeDecodeError,AttributeError):
        raise ValueError("Malformed Kafka event key") from None
    if not isinstance(event,dict) or str(event.get("event_id",""))!=kafka_key:
        raise ValueError("Event identity does not match Kafka key")
    try:
        outcome=record_event(dsn=dsn,event=event,key=key,
                             expected_tenant=tenant_id,consumer_name=name)
    except ValueError as exc:
        # Only deterministic validation failures are quarantined. Transient
        # database and broker failures propagate without being reclassified.
        reason = ("TENANT_MISMATCH" if "Tenant mismatch" in str(exc) else
                  "INVALID_SIGNATURE" if "integrity failure" in str(exc) else
                  "UNAUTHORIZED_JOB" if "job/case mismatch" in str(exc) else
                  "INVALID_ENVELOPE")
        record_quarantine(dsn=dsn,tenant_id=tenant_id,consumer_name=name,
                          reason=reason,raw_event=message.value())
        raise
    # Never advance offset before durable inbox transaction has committed.
    consumer.commit(message=message,asynchronous=False)
    return outcome

def main():
    if os.getenv("SAAS_SYNTHETIC_CONSUMER_ENABLED")!="true":
        raise RuntimeError("Synthetic inbox consumer disabled by default")
    if os.getenv("SAAS_ENABLE_API")=="true":
        raise RuntimeError("Run Kafka consumer separately from public API")
    from confluent_kafka import Consumer
    from .kafka_consumer_config import kafka_consumer_config
    tenant_id=os.environ["SAAS_CONSUMER_TENANT_ID"]
    UUID(tenant_id)
    key=bytes.fromhex(os.environ["SAAS_EVENT_HMAC_KEY_HEX"])
    dsn=os.environ["SAAS_CONSUMER_DATABASE_URL"]
    consumer=Consumer(kafka_consumer_config(tenant_id))
    consumer.subscribe([TOPIC])
    try:
        while True:
            process_one(consumer=consumer,dsn=dsn,tenant_id=tenant_id,key=key)
    finally:
        consumer.close()

if __name__=="__main__":
    main()
