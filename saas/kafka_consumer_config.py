"""Fail-closed Kafka security configuration for dedicated synthetic inbox consumer."""
import os
import re

def kafka_consumer_config(tenant_id):
    from uuid import UUID
    UUID(tenant_id)
    host=os.environ["SAAS_KAFKA_BOOTSTRAP"]
    ca=os.environ["SAAS_KAFKA_CA_FILE"]
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,251}:\d{2,5}",host):
        raise ValueError("Single TLS Kafka host:port required")
    if not os.path.isfile(ca):
        raise ValueError("Verified Kafka CA file required")
    username=os.getenv("SAAS_KAFKA_USERNAME")
    password=os.getenv("SAAS_KAFKA_PASSWORD")
    if not username or not password:
        raise ValueError("Consumer requires distinct SASL credentials")
    return {"bootstrap.servers":host,"security.protocol":"SASL_SSL",
            "ssl.ca.location":ca,"enable.ssl.certificate.verification":True,
            "sasl.mechanism":"SCRAM-SHA-512","sasl.username":username,
            "sasl.password":password,
            "group.id":"addressrail-saas-inbox-"+tenant_id,
            "enable.auto.commit":False,"enable.auto.offset.store":False,
            "auto.offset.reset":"earliest"}
