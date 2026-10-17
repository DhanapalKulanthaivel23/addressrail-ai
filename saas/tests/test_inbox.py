from datetime import datetime,timezone
from uuid import uuid4
from unittest.mock import MagicMock
import pytest
from saas import inbox
from saas.event_contract import sign_event

TENANT=str(uuid4())
CASE=str(uuid4())
JOB=str(uuid4())
KEY=b"synthetic-only-test-event-authentication-secret"
PAYLOAD={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":TENANT,
         "job_id":JOB,"case_id":CASE,"synthetic":True,
         "settlement_attested":False,"safe_to_retry":False}

def test_reject_wrong_tenant_before_database(monkeypatch):
    def db_forbidden(*args,**kwargs):raise AssertionError("must not touch database")
    monkeypatch.setattr(inbox.psycopg,"connect",db_forbidden)
    signed=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY)
    with pytest.raises(ValueError,match="Tenant mismatch"):
        inbox.record_event(dsn="test",event=signed,key=KEY,
                           expected_tenant=str(uuid4()),consumer_name="go-validator")

def test_accept_signed_event_then_detect_duplicate(monkeypatch):
    db=MagicMock()
    db.__enter__.return_value=db
    db.transaction.return_value.__enter__.return_value=db
    responses=iter([(CASE,), (str(uuid4()),), (CASE,), None])
    db.execute.return_value.fetchone.side_effect=lambda:next(responses)
    monkeypatch.setattr(inbox.psycopg,"connect",lambda *a,**k:db)
    event=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY)
    result=inbox.record_event(dsn="test",event=event,key=KEY,
                              expected_tenant=TENANT,consumer_name="go-validator")
    assert result["accepted"] and not result["duplicate"]
    result=inbox.record_event(dsn="test",event=event,key=KEY,
                              expected_tenant=TENANT,consumer_name="go-validator")
    assert result["duplicate"] and not result["accepted"]
    assert any("ON CONFLICT DO NOTHING" in c.args[0] for c in db.execute.call_args_list)
