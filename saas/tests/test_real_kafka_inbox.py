"""Real local Kafka broker + PostgreSQL signed tenant inbox exercise.

Run only in ephemeral CI with SAAS_TEST_ADMIN_DSN and Kafka at localhost:9092.
The production consumer requires TLS/SASL; this test uses a strictly local
PLAINTEXT broker and the same consumer processing function.
"""
import json
import os
import time
import uuid
from pathlib import Path

import psycopg
import pytest
from confluent_kafka import Consumer, Producer
from saas.event_contract import sign_event
from saas.kafka_inbox_consumer import process_one, TOPIC

pytestmark=pytest.mark.skipif(
    not (os.getenv("SAAS_TEST_ADMIN_DSN") and os.getenv("SAAS_TEST_KAFKA_BOOTSTRAP")),
    reason="Ephemeral real PostgreSQL/Kafka CI required")

def test_real_kafka_signed_tenant_inbox_roundtrip():
    tenant=str(uuid.uuid4())
    case_id=uuid.uuid4()
    job_id=uuid.uuid4()
    event_id=str(uuid.uuid4())
    key=b"only-in-ephemeral-ci-synthetic-kafka-test-secret"
    dsn=os.environ["SAAS_TEST_ADMIN_DSN"]
    bootstrap=os.environ["SAAS_TEST_KAFKA_BOOTSTRAP"]
    # Seed isolated synthetic records as test administrator; the actual
    # consumer below runs with the configured app-privilege connection.
    with psycopg.connect(dsn,autocommit=True) as admin:
        admin.execute(Path(__file__).resolve().parents[1].joinpath("schema.sql").read_text())
        admin.execute("GRANT addressrail_consumer TO addressrail_api")
        admin.execute("INSERT INTO saas_cases(id,tenant_id,payment_ref,simulated_status,creator) VALUES(%s,%s,%s,'RJCT','ci')",
                      (case_id,tenant,"PAY-TEST-"+str(case_id)[:12]))
        admin.execute("INSERT INTO saas_jobs(id,tenant_id,case_id,creator) VALUES(%s,%s,%s,'ci')",
                      (job_id,tenant,case_id))
    payload={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":tenant,
             "job_id":str(job_id),"case_id":str(case_id),"synthetic":True,
             "settlement_attested":False,"safe_to_retry":False}
    envelope=sign_event(event_id=event_id,payload=payload,key=key)
    producer=Producer({"bootstrap.servers":bootstrap,"enable.idempotence":True,
                       "acks":"all"})
    results=[]
    producer.produce(TOPIC,key=event_id,value=json.dumps(envelope).encode(),
                     on_delivery=lambda err,msg:results.append(err))
    assert producer.flush(20)==0 and results==[None]
    consumer=Consumer({"bootstrap.servers":bootstrap,
                       "group.id":"tenant-ci-"+str(uuid.uuid4()),
                       "auto.offset.reset":"earliest",
                       "enable.auto.commit":False})
    consumer.subscribe([TOPIC])
    try:
        found=None
        for _ in range(20):
            outcome=process_one(consumer=consumer,
                dsn=os.environ["SAAS_DATABASE_URL"],tenant_id=tenant,
                key=key,timeout=1)
            if outcome is not None:
                found=outcome
                break
        assert found is not None and found["accepted"],found
        with psycopg.connect(dsn) as admin:
            row=admin.execute("SELECT count(*) FROM saas_inbox WHERE event_id=%s",(event_id,)).fetchone()
            assert row[0]==1
    finally:
        consumer.close()
