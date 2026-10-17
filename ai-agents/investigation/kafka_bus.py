"""Real Kafka transport adapter for synthetic payment events (off by default).

Confluent Kafka client is loaded only when invoked; unit tests inject a fake bus.
No payment schemes, SWIFT network operations, customer PII or banking credentials.
"""
from __future__ import annotations
from dataclasses import dataclass
import json
import os
import re
from uuid import uuid4

TOPICS = {
 "submitted":"addressrail.payments.submitted.v1",
 "validated":"addressrail.payments.validated.v1",
 "investigated":"addressrail.payments.investigated.v1",
 "retry":"addressrail.payments.retry.v1",
 "deadletter":"addressrail.payments.deadletter.v1",
}
GROUPS = {"validate":"addressrail-go-validation-v1",
          "investigate":"addressrail-ai-investigation-v1",
          "report":"addressrail-report-writer-v1"}
MAX_VALUE = 90_000
LOCAL_BROKER = re.compile(r"^(?:127\.0\.0\.1|localhost):\d{4,5}$")

def kafka_config() -> dict:
    """Local PLAINTEXT by default; remote brokers require explicit TLS opt-in.

    Credentials are read at runtime from secret-backed environment variables,
    never copied into event envelopes or exception messages.
    """
    host = os.getenv("ADDRESSRAIL_KAFKA_BOOTSTRAP", "127.0.0.1:9092")
    if LOCAL_BROKER.fullmatch(host):
        if os.getenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "false").lower() == "true":
            raise ValueError("Remote Kafka mode cannot target a local broker")
        return {"bootstrap.servers": host, "socket.timeout.ms": 3000}
    if os.getenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "false").lower() != "true":
        raise ValueError("Non-local Kafka requires explicit remote TLS opt-in")
    # Reject comma-separated clusters and ambiguous forms until a vetted
    # multi-broker parser is provided. Ports are required.
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,251}:\d{2,5}", host):
        raise ValueError("Invalid remote Kafka host")
    hostname, port = host.rsplit(":", 1)
    if (hostname.lower() in ("localhost", "localhost.localdomain") or
        hostname.startswith(("127.", "0.", "169.254.", "10.", "192.168.")) or
        hostname.endswith(".local") or not 1 <= int(port) <= 65535):
        raise ValueError("Unapproved remote Kafka destination")
    ca = os.getenv("ADDRESSRAIL_KAFKA_CA_FILE", "")
    if not ca or not os.path.isfile(ca):
        raise ValueError("Remote Kafka requires an installed CA certificate")
    cfg = {"bootstrap.servers": host, "socket.timeout.ms": 3000,
           "security.protocol": "SSL", "ssl.ca.location": ca,
           "enable.ssl.certificate.verification": True}
    username = os.getenv("ADDRESSRAIL_KAFKA_SASL_USERNAME", "")
    password = os.getenv("ADDRESSRAIL_KAFKA_SASL_PASSWORD", "")
    if bool(username) != bool(password):
        raise ValueError("Kafka SASL username and password must both be configured")
    if username:
        mechanism = os.getenv("ADDRESSRAIL_KAFKA_SASL_MECHANISM", "SCRAM-SHA-512")
        if mechanism not in ("SCRAM-SHA-256", "SCRAM-SHA-512"):
            raise ValueError("Unsupported Kafka SASL mechanism")
        cfg.update({"security.protocol": "SASL_SSL",
                    "sasl.mechanism": mechanism,
                    "sasl.username": username, "sasl.password": password})
    return cfg

def broker_address() -> str:
    return kafka_config()["bootstrap.servers"]

@dataclass(frozen=True)
class Event:
    topic: str
    key: str
    data: dict
    offset: int = -1

def encode(data: dict) -> bytes:
    if not isinstance(data,dict) or data.get("synthetic") is not True or data.get("version")!=1:
        raise ValueError("Only versioned fictional event envelopes may be published")
    raw = json.dumps(data,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()
    if len(raw)>MAX_VALUE:
        raise ValueError("Kafka event exceeds 90 KB")
    return raw

def decode(raw: bytes) -> dict:
    if not raw or len(raw)>MAX_VALUE:
        raise ValueError("Oversized/empty event")
    data=json.loads(raw)
    encode(data)
    return data

class KafkaBus:
    def __init__(self, group: str | None = None):
        from confluent_kafka import Producer, Consumer
        conf=kafka_config()
        self.producer=Producer({**conf,"enable.idempotence":True,
             "acks":"all","message.timeout.ms":5000,"retries":3})
        self.consumer=None
        if group:
            if group not in GROUPS:
                raise ValueError("Unrecognised synthetic pipeline group")
            self.consumer=Consumer({**conf,"group.id":GROUPS[group],
                "enable.auto.commit":False,"auto.offset.reset":"earliest",
                "max.poll.interval.ms":300000})
            input_topic={"validate":"submitted","investigate":"validated","report":"investigated"}[group]
            self.consumer.subscribe([TOPICS[input_topic]])

    def send(self, topic: str, key: str, data: dict):
        if topic not in TOPICS.values() or not re.fullmatch(r"[A-Za-z0-9_-]{3,80}",key):
            raise ValueError("Invalid topic or fictional event key")
        delivered=[]
        def receipt(err,message):
            delivered.append(err)
        self.producer.produce(topic,key=key, value=encode(data),on_delivery=receipt)
        pending=self.producer.flush(8)
        if pending or delivered != [None]:
            raise RuntimeError("Kafka event was not acknowledged")

    def receive(self, wait: float=1.0) -> Event | None:
        if self.consumer is None:
            raise RuntimeError("Consumer role is required")
        msg=self.consumer.poll(wait)
        if msg is None:
            return None
        if msg.error():
            raise RuntimeError("Kafka consumer failed")
        return Event(msg.topic(),msg.key().decode() if msg.key() else "",
                     decode(msg.value()),msg.offset())

    def ack(self):
        if self.consumer:
            self.consumer.commit(asynchronous=False)

    def close(self):
        if self.consumer:
            self.consumer.close()
        self.producer.flush(3)

def create_topics():
    from confluent_kafka.admin import AdminClient, NewTopic
    from concurrent.futures import TimeoutError
    conf=kafka_config()
    admin=AdminClient({**conf,"socket.timeout.ms":5000})
    topic_defs=[NewTopic(name,num_partitions=1,replication_factor=1)
                for name in TOPICS.values()]
    jobs=admin.create_topics(topic_defs)
    for name,result in jobs.items():
        try:
            result.result(timeout=10)
        except Exception as exc:
            if "TOPIC_ALREADY_EXISTS" not in str(exc):
                raise
    return sorted(jobs)
