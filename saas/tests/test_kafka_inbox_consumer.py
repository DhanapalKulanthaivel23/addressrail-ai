import json
from types import SimpleNamespace
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from saas import kafka_inbox_consumer as module
from saas.event_contract import sign_event

TENANT=str(uuid4())
KEY=b"test-secret-for-synthetic-kafka-inbox-validation"
PAYLOAD={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":TENANT,
         "job_id":str(uuid4()),"case_id":str(uuid4()),
         "synthetic":True,"settlement_attested":False,"safe_to_retry":False}
EVENT=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY)

def message(payload=EVENT,key=EVENT["event_id"]):
    return SimpleNamespace(error=lambda:None,topic=lambda:module.TOPIC,
      key=lambda:key.encode(),value=lambda:json.dumps(payload).encode())

def test_valid_event_is_durable_before_offset_commit(monkeypatch):
    broker=MagicMock()
    broker.poll.return_value=message()
    seen=[]
    def record(**kwargs):
        seen.append("postgres-commit")
        return {"accepted":True}
    monkeypatch.setattr(module,"record_event",record)
    broker.commit.side_effect=lambda **kwargs:seen.append("kafka-commit")
    assert module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)=={"accepted":True}
    assert seen==["postgres-commit","kafka-commit"]

def test_db_failure_never_commits_offset(monkeypatch):
    broker=MagicMock()
    broker.poll.return_value=message()
    def fail(**kwargs): raise RuntimeError("db unavailable")
    monkeypatch.setattr(module,"record_event",fail)
    with pytest.raises(RuntimeError):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    broker.commit.assert_not_called()

def test_mismatched_event_id_never_reaches_database(monkeypatch):
    broker=MagicMock()
    broker.poll.return_value=message(key=str(uuid4()))
    monkeypatch.setattr(module,"record_event",
                        lambda **kwargs:pytest.fail("must not write untrusted event"))
    with pytest.raises(ValueError,match="identity"):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    broker.commit.assert_not_called()

def test_bad_signature_and_tenant_refuse_offset_commit(monkeypatch):
    from saas.inbox import record_event
    broker=MagicMock()
    broker.poll.return_value=message({**EVENT,"mac":"0"*64})
    # Full cryptographic check occurs in the inbox, before DB writes.
    monkeypatch.setattr(module,"record_event",lambda **kw:record_event(**kw))
    with pytest.raises(ValueError):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    broker.commit.assert_not_called()


@pytest.mark.parametrize("raw_key,raw_body",[
    (b"\\xff",b"{}"),
    (b"synthetic",b"null"),
    (b"synthetic",b"not-json"),
])
def test_poison_kafka_input_does_not_touch_inbox_or_commit(monkeypatch,raw_key,raw_body):
    broker=MagicMock()
    msg=MagicMock()
    msg.error.return_value=None
    msg.topic.return_value=module.TOPIC
    msg.key.return_value=raw_key
    msg.value.return_value=raw_body
    broker.poll.return_value=msg
    monkeypatch.setattr(module,"record_event",
                        lambda **kwargs:pytest.fail("poison event must not reach database"))
    with pytest.raises(ValueError):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    broker.commit.assert_not_called()


def test_signed_rejection_writes_quarantine_but_does_not_ack(monkeypatch):
    broker=MagicMock()
    broker.poll.return_value=message()
    quarantine=[]
    def invalid(**kwargs):
        raise ValueError("Event integrity failure")
    monkeypatch.setattr(module,"record_event",invalid)
    monkeypatch.setattr(module,"record_quarantine",
                        lambda **kwargs:quarantine.append(kwargs))
    with pytest.raises(ValueError,match="integrity failure"):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    assert len(quarantine)==1
    assert quarantine[0]["reason"]=="INVALID_SIGNATURE"
    assert quarantine[0]["tenant_id"]==TENANT
    broker.commit.assert_not_called()

def test_transient_inbox_failure_never_quarantined_or_acknowledged(monkeypatch):
    broker=MagicMock()
    broker.poll.return_value=message()
    monkeypatch.setattr(module,"record_event",
                        lambda **kwargs:(_ for _ in ()).throw(RuntimeError("database offline")))
    monkeypatch.setattr(module,"record_quarantine",
                        lambda **kwargs:pytest.fail("transient errors must not be quarantined"))
    with pytest.raises(RuntimeError,match="database offline"):
        module.process_one(consumer=broker,dsn="test",tenant_id=TENANT,key=KEY)
    broker.commit.assert_not_called()
