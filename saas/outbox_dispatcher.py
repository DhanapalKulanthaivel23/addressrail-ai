"""Opt-in single-tenant *synthetic* outbox publisher prototype.

This is deliberately NOT production-safe multi-tenant delivery: a crash after
broker acknowledgement but before recording success can redeliver an event.
Consumers MUST durably deduplicate event_id and enforce tenant access.
"""
from __future__ import annotations
import os
from uuid import UUID
import psycopg
from .event_contract import sign_event, canonical

TOPIC = "addressrail.saas.synthetic.jobs.v1"

def dispatch_one(*, dsn: str, tenant_id: str, key: bytes, producer):
    """Send one pending event for the caller's provisioned tenant.

    Connection credentials must be a separate dispatcher principal, never the
    public API credential. No tenant identifier is accepted over HTTP.
    Broker publish and marking dispatched are not an atomic transaction.
    """
    UUID(tenant_id)
    if len(key) < 32:
        raise ValueError("Dispatcher HMAC key must be at least 32 bytes")
    with psycopg.connect(dsn, connect_timeout=5, autocommit=False) as db:
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id', %s, true)", (tenant_id,))
            row=db.execute("""SELECT event_id,payload FROM saas_outbox
                WHERE dispatched_at IS NULL ORDER BY created_at,event_id
                LIMIT 1 FOR UPDATE SKIP LOCKED""").fetchone()
            if row is None:
                return None
            event_id,payload=row
            if payload.get("tenant_id") != tenant_id:
                raise ValueError("Outbox tenant mismatch")
            event=sign_event(event_id=str(event_id),payload=payload,key=key)
            # Producer must block until a trusted broker acknowledges the record.
            # A failure rolls back this database transaction. The same event_id
            # intentionally remains stable across retries for consumer dedup.
            producer(TOPIC, str(event_id), canonical(event))
            db.execute("""UPDATE saas_outbox SET dispatched_at=now()
                           WHERE event_id=%s AND dispatched_at IS NULL""",
                       (event_id,))
            return str(event_id)

def confluent_producer():
    """Require TLS broker config before dispatching any real synthetic events."""
    from confluent_kafka import Producer
    host=os.environ["SAAS_KAFKA_BOOTSTRAP"]
    ca=os.environ["SAAS_KAFKA_CA_FILE"]
    if not os.path.isfile(ca) or not host or "," in host:
        raise ValueError("Verified single-broker TLS and CA required")
    cfg={"bootstrap.servers":host,"security.protocol":"SSL",
         "ssl.ca.location":ca,"enable.ssl.certificate.verification":True,
         "enable.idempotence":True,"acks":"all","message.timeout.ms":10000}
    username=os.getenv("SAAS_KAFKA_USERNAME")
    password=os.getenv("SAAS_KAFKA_PASSWORD")
    if bool(username)!=bool(password):
        raise ValueError("Both Kafka SASL credentials required")
    if username:
        cfg.update({"security.protocol":"SASL_SSL","sasl.mechanism":"SCRAM-SHA-512",
                    "sasl.username":username,"sasl.password":password})
    client=Producer(cfg)
    def send(topic, event_id, body):
        delivered=[]
        client.produce(topic,key=event_id.encode(),value=body,
                       on_delivery=lambda err,msg:delivered.append(err))
        if client.flush(12) or delivered != [None]:
            raise RuntimeError("Broker acknowledgement not received")
    return send

def main():
    if os.getenv("SAAS_SYNTHETIC_DISPATCH_ENABLED")!="true":
        raise RuntimeError("Synthetic dispatch disabled by default")
    if os.getenv("SAAS_ENABLE_API")=="true":
        raise RuntimeError("Run dispatcher separately from the HTTP API")
    tenant_id=os.environ["SAAS_DISPATCH_TENANT_ID"]
    UUID(tenant_id)
    dsn=os.environ["SAAS_DISPATCH_DATABASE_URL"]
    key=bytes.fromhex(os.environ["SAAS_EVENT_HMAC_KEY_HEX"])
    result=dispatch_one(dsn=dsn,tenant_id=tenant_id,key=key,
                        producer=confluent_producer())
    print("dispatched one synthetic event" if result else "no pending event")

if __name__=="__main__":
    main()
