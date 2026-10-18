"""Contract tests for the explicitly opt-in synthetic dispatcher.

A real broker/dispatcher credential and durable consumer dedup are not part of
these mocked unit tests.
"""
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from saas import outbox_dispatcher
from saas.event_contract import verify_event
import json

KEY=b"unit-test-dispatcher-key-with-32-byte-minimum!"
TENANT=str(uuid4())
JOB=str(uuid4())
CASE=str(uuid4())
EVENT=uuid4()
PAYLOAD={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":TENANT,
         "job_id":JOB,"case_id":CASE,"synthetic":True,
         "settlement_attested":False,"safe_to_retry":False}

def fake_db(row):
    connection=MagicMock()
    connection.__enter__.return_value=connection
    connection.transaction.return_value.__enter__.return_value=connection
    connection.execute.return_value.fetchone.return_value=row
    return connection

def test_dispatcher_signs_persisted_event_and_waits_for_producer(monkeypatch):
    db=fake_db((EVENT,PAYLOAD))
    monkeypatch.setattr(outbox_dispatcher.psycopg,"connect",lambda *a,**kw:db)
    calls=[]
    def producer(topic,event_id,body):
        calls.append((topic,event_id,body))
        event=json.loads(body)
        assert verify_event(event,key=KEY,expected_tenant=TENANT)==PAYLOAD
    assert outbox_dispatcher.dispatch_one(dsn="test",tenant_id=TENANT,
             key=KEY,producer=producer)==str(EVENT)
    assert len(calls)==1
    assert calls[0][0]==outbox_dispatcher.TOPIC
    statements=[c.args[0] for c in db.execute.call_args_list]
    assert any("FOR UPDATE SKIP LOCKED" in x for x in statements)
    assert any("UPDATE saas_outbox SET dispatched_at" in x for x in statements)

def test_dispatcher_does_not_mark_delivered_on_publish_failure(monkeypatch):
    db=fake_db((EVENT,PAYLOAD))
    monkeypatch.setattr(outbox_dispatcher.psycopg,"connect",lambda *a,**kw:db)
    def failed(*a):
        raise RuntimeError("broker failed")
    with pytest.raises(RuntimeError,match="broker failed"):
        outbox_dispatcher.dispatch_one(dsn="test",tenant_id=TENANT,key=KEY,
                                      producer=failed)
    assert not any("UPDATE saas_outbox SET dispatched_at" in c.args[0]
                   for c in db.execute.call_args_list)

def test_dispatcher_denies_tenant_mismatch_and_requires_secret(monkeypatch):
    db=fake_db((EVENT,{**PAYLOAD,"tenant_id":str(uuid4())}))
    monkeypatch.setattr(outbox_dispatcher.psycopg,"connect",lambda *a,**kw:db)
    with pytest.raises(ValueError,match="tenant mismatch"):
        outbox_dispatcher.dispatch_one(dsn="test",tenant_id=TENANT,key=KEY,
                                      producer=lambda *args:None)
    with pytest.raises(ValueError):
        outbox_dispatcher.dispatch_one(dsn="test",tenant_id=TENANT,
                                      key=b"short",producer=lambda *args:None)
