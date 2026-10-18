"""Integration checks against *real* PostgreSQL RLS, using test-only RSA signing."""
from datetime import datetime,timezone,timedelta
import os
from pathlib import Path
import uuid
import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi.testclient import TestClient
from saas.app import app

pytestmark=pytest.mark.skipif(not os.getenv("SAAS_TEST_ADMIN_DSN"),
                             reason="Real ephemeral PostgreSQL admin DSN required")
TENANT_A="d241a2af-1b90-4a00-a69c-f0d854936065"
TENANT_B="1e5b58d1-a239-4830-a74a-8f20d237219b"
ISSUER="https://issuer.example.invalid/"
AUDIENCE="addressrail-saas-staging"

@pytest.fixture(scope="module")
def prepared():
    admin=os.environ["SAAS_TEST_ADMIN_DSN"]
    with psycopg.connect(admin, autocommit=True) as db:
        role=db.execute("SELECT 1 FROM pg_roles WHERE rolname='addressrail_api'").fetchone()
        if role is None:
            db.execute("""CREATE ROLE addressrail_api LOGIN PASSWORD 'test-only-password-for-ci'
                NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS""")
        db.execute(Path(__file__).resolve().parents[1].joinpath("schema.sql").read_text())
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    pub=private.public_key().public_bytes(serialization.Encoding.PEM,
                                       serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    os.environ["SAAS_ENABLE_API"]="true"
    os.environ["SAAS_DATABASE_URL"]="postgresql://addressrail_api:test-only-password-for-ci@127.0.0.1:5432/addressrail_test"
    os.environ["SAAS_OIDC_PUBLIC_KEY_PEM"]=pub
    os.environ["SAAS_OIDC_ISSUER"]=ISSUER
    os.environ["SAAS_OIDC_AUDIENCE"]=AUDIENCE
    yield private

def token(private,tenant,role="INVESTIGATOR",sub="alice",exp=None,issuer=ISSUER,audience=AUDIENCE):
    now=datetime.now(timezone.utc)
    claims={"iss":issuer,"aud":audience,"sub":sub,"tenant_id":tenant,
            "role":role,"iat":now,"nbf":now-timedelta(seconds=5),
            "exp":exp or (now+timedelta(minutes=10))}
    return {"Authorization":"Bearer "+jwt.encode(claims,private,algorithm="RS256")}

def new_payment(prefix):
    return {"payment_ref":"PAY-"+prefix+"-"+uuid.uuid4().hex[:12],
            "simulated_status":"RJCT","synthetic":True}

def test_same_payment_refs_isolated_and_rls_blocks_unscoped_sql(prepared):
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as c:
        ref=new_payment("SAME-ID")
        ra=c.post("/v1/tenancy/cases",json=ref,headers=a)
        rb=c.post("/v1/tenancy/cases",json=ref,headers=b)
        assert ra.status_code==201 and rb.status_code==201,(ra.text,rb.text)
        aid=ra.json()["id"]
        bid=rb.json()["id"]
        assert aid!=bid
        assert c.get("/v1/tenancy/cases/"+aid,headers=b).status_code==404
        assert c.get("/v1/tenancy/cases/"+bid,headers=a).status_code==404
        assert any(x["id"]==aid for x in c.get("/v1/tenancy/cases",headers=a).json())
        assert not any(x["id"]==bid for x in c.get("/v1/tenancy/cases",headers=a).json())
        # Deliberately omit tenant_id from the SQL query. RLS, not a WHERE, isolates.
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"],autocommit=False) as db:
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id', %s, true)",(TENANT_A,))
                rows=db.execute("SELECT id FROM saas_cases WHERE id IN (%s,%s)",
                                (aid,bid)).fetchall()
                assert [str(x[0]) for x in rows]==[aid]
        # No tenant setting must return no rows, not leak records.
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            assert db.execute("SELECT count(*) FROM saas_cases").fetchone()[0]==0

def test_signed_jwt_tenant_is_not_header_controlled(prepared):
    a=token(prepared,TENANT_A)
    with TestClient(app) as c:
        assert c.get("/v1/tenancy/me").status_code==401
        response=c.get("/v1/tenancy/me",headers={**a,"X-Tenant-ID":TENANT_B})
        assert response.status_code==200
        assert response.json()["tenant_id"]==TENANT_A
        assert c.get("/v1/tenancy/me",headers=token(prepared,TENANT_A,audience="wrong")).status_code==401
        assert c.get("/v1/tenancy/me",headers=token(prepared,TENANT_A,issuer="https://fake.invalid")).status_code==401
        assert c.get("/v1/tenancy/me",headers=token(prepared,TENANT_A,exp=datetime.now(timezone.utc)-timedelta(hours=1))).status_code==401
        other_private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
        assert c.get("/v1/tenancy/me",headers=token(other_private,TENANT_A)).status_code==401
        assert c.post("/v1/tenancy/cases",json=new_payment("VIEWER"),
                      headers=token(prepared,TENANT_A,role="VIEWER")).status_code==403
        assert c.post("/v1/tenancy/cases",json=new_payment("REVIEWER"),
                      headers=token(prepared,TENANT_A,role="REVIEWER")).status_code==403
        assert c.post("/v1/tenancy/cases",json=new_payment("UNSAFE")|
                      {"synthetic":False},headers=a).status_code==422

def test_immutable_synthetic_report_and_tenant_scoped_download(prepared):
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as c:
        body=new_payment("REPORT")
        created=c.post("/v1/tenancy/cases",json=body,headers=a)
        assert created.status_code==201
        cid=created.json()["id"]
        report={"validation_rule_ids":["XML-ADDR-001"],
                "evidence_refs":["EDU-001"],"source_citation_ids":["EPC-SCT-2025"],
                "explanation":"Source-grounded fictional rejection requires operator review.",
                "synthetic":True,"requires_human_review":True,
                "settlement_attested":False,"safe_to_retry":False}
        assert c.post(f"/v1/tenancy/cases/{cid}/report",headers=b,json=report).status_code==404
        bad={**report,"safe_to_retry":True}
        assert c.post(f"/v1/tenancy/cases/{cid}/report",headers=a,json=bad).status_code==422
        ok=c.post(f"/v1/tenancy/cases/{cid}/report",headers=a,json=report)
        assert ok.status_code==201,ok.text
        assert c.post(f"/v1/tenancy/cases/{cid}/report",headers=a,json=report).status_code==409
        result=c.get(f"/v1/tenancy/cases/{cid}/report",headers=a)
        assert result.status_code==200
        assert result.json()["origin"]=="TENANT_USER_SUBMITTED_SYNTHETIC_UNVERIFIED"
        assert "attachment" in result.headers["content-disposition"]
        assert c.get(f"/v1/tenancy/cases/{cid}/report",headers=b).status_code==404
        audit=c.get("/v1/tenancy/audit",headers=token(prepared,TENANT_A,"ADMIN"))
        assert audit.status_code==200
        assert any(x["case_id"]==cid and x["action"]=="REPORT_ATTACHED" for x in audit.json())
        assert c.get("/v1/tenancy/audit",headers=a).status_code==403
    # Application login must never be allowed to bypass RLS or mutate audit/report.
    with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
        with pytest.raises(psycopg.errors.InsufficientPrivilege):
            db.execute("DELETE FROM saas_audit WHERE case_id=%s",(cid,))

def test_service_is_disabled_without_opt_in(prepared,monkeypatch):
    monkeypatch.delenv("SAAS_ENABLE_API",raising=False)
    with TestClient(app) as c:
        assert c.get("/readyz").status_code==503
        assert c.get("/v1/tenancy/cases",headers=token(prepared,TENANT_A)).status_code==404


def test_tenant_scoped_pending_jobs_never_dispatch_and_cannot_cross_read(prepared):
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as c:
        created=c.post("/v1/tenancy/cases",json=new_payment("JOB"),headers=a)
        assert created.status_code==201,created.text
        case_id=created.json()["id"]
        url=f"/v1/tenancy/cases/{case_id}/jobs"
        assert c.post(url,headers=b).status_code==404
        assert c.post(url,headers=token(prepared,TENANT_A,"VIEWER")).status_code==403
        job=c.post(url,headers=a)
        assert job.status_code==201,job.text
        data=job.json()
        assert data["state"]=="PENDING_DISPATCH" and data["dispatched"] is False
        assert c.post(url,headers=a).status_code==409
        path="/v1/tenancy/jobs/"+data["job_id"]
        assert c.get(path,headers=a).status_code==200
        assert c.get(path,headers=b).status_code==404
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            assert db.execute("SELECT count(*) FROM saas_jobs").fetchone()[0]==0
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                db.execute("DELETE FROM saas_jobs WHERE id=%s",(data["job_id"],))


def test_atomic_outbox_is_tenant_scoped_and_write_once(prepared):
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as c:
        created=c.post("/v1/tenancy/cases",json=new_payment("OUTBOX"),headers=a)
        assert created.status_code==201,created.text
        cid=created.json()["id"]
        job=c.post(f"/v1/tenancy/cases/{cid}/jobs",headers=a)
        assert job.status_code==201,job.text
        jid=job.json()["job_id"]
        assert c.get("/v1/tenancy/jobs/"+jid,headers=b).status_code==404
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id', %s, true)",(TENANT_A,))
                rows=db.execute("""SELECT event_type,payload FROM saas_outbox
                                    WHERE job_id=%s""",(jid,)).fetchall()
                assert len(rows)==1
                assert rows[0][0]=="SYNTHETIC_JOB_PENDING"
                payload=rows[0][1]
                assert payload["tenant_id"]==TENANT_A and payload["job_id"]==jid
                assert payload["case_id"]==cid and payload["synthetic"] is True
                assert payload["safe_to_retry"] is False
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id', %s, true)",(TENANT_B,))
                assert db.execute("SELECT count(*) FROM saas_outbox WHERE job_id=%s",(jid,)).fetchone()[0]==0
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            assert db.execute("SELECT count(*) FROM saas_outbox").fetchone()[0]==0
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                db.execute("DELETE FROM saas_outbox WHERE job_id=%s",(jid,))


def test_pending_event_inspection_is_tenant_scoped_and_not_dispatched(prepared):
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as c:
        case=c.post("/v1/tenancy/cases",json=new_payment("EXPORT"),headers=a)
        assert case.status_code==201,case.text
        cid=case.json()["id"]
        job=c.post(f"/v1/tenancy/cases/{cid}/jobs",headers=a)
        assert job.status_code==201,job.text
        path="/v1/tenancy/jobs/"+job.json()["job_id"]+"/pending-event"
        assert c.get(path,headers=b).status_code==404
        assert c.get(path,headers=token(prepared,TENANT_A,"VIEWER")).status_code==403
        event=c.get(path,headers=a)
        assert event.status_code==200,event.text
        payload=event.json()
        assert payload["payload"]["tenant_id"]==TENANT_A
        assert payload["payload"]["case_id"]==cid
        assert payload["delivery_status"]=="NOT_DISPATCHED"
        assert payload["signed"] is False


def test_real_postgres_inbox_dedup_and_tenant_isolation(prepared):
    from saas.event_contract import sign_event
    from saas.inbox import record_event
    tenant=TENANT_A
    with TestClient(app) as c:
        created=c.post("/v1/tenancy/cases",json=new_payment("INBOX"),headers=token(prepared,tenant))
        assert created.status_code==201,created.text
        case_id=created.json()["id"]
        job=c.post(f"/v1/tenancy/cases/{case_id}/jobs",headers=token(prepared,tenant))
        assert job.status_code==201,job.text
        job_id=job.json()["job_id"]
    payload={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":tenant,
             "job_id":job_id,"case_id":case_id,"synthetic":True,
             "settlement_attested":False,"safe_to_retry":False}
    key=b"test-only-event-key-longer-than-32-bytes"
    event=sign_event(event_id=str(uuid.uuid4()),payload=payload,key=key)
    # CI app login has no write access to inbox; simulate a distinct authorized
    # test consumer by granting the group role, then revoke on cleanup.
    with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
        admin.execute("GRANT addressrail_consumer TO addressrail_api")
    try:
        first=record_event(dsn=os.environ["SAAS_DATABASE_URL"],event=event,
                           key=key,expected_tenant=tenant,consumer_name="go-validator")
        second=record_event(dsn=os.environ["SAAS_DATABASE_URL"],event=event,
                            key=key,expected_tenant=tenant,consumer_name="go-validator")
        assert first["accepted"] and second["duplicate"]
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            assert db.execute("SELECT count(*) FROM saas_inbox").fetchone()[0]==0
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_B,))
                assert db.execute("SELECT count(*) FROM saas_inbox").fetchone()[0]==0
    finally:
        with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
            admin.execute("REVOKE addressrail_consumer FROM addressrail_api")


def test_consumer_integration_real_postgres_commit_after_durable_inbox(prepared):
    """Test consumer ordering with real RLS PostgreSQL and a fake Kafka transport."""
    import json
    from unittest.mock import MagicMock
    from saas.event_contract import sign_event
    from saas.kafka_inbox_consumer import process_one, TOPIC
    a=token(prepared,TENANT_A)
    with TestClient(app) as c:
        case=c.post("/v1/tenancy/cases",json=new_payment("CONSUMER"),headers=a)
        assert case.status_code==201,case.text
        cid=case.json()["id"]
        job=c.post(f"/v1/tenancy/cases/{cid}/jobs",headers=a)
        assert job.status_code==201,job.text
        jid=job.json()["job_id"]
    key=b"test-only-synthetic-consumer-key-with-long-entropy"
    event=sign_event(event_id=str(uuid.uuid4()),
        payload={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":TENANT_A,
                 "job_id":jid,"case_id":cid,"synthetic":True,
                 "settlement_attested":False,"safe_to_retry":False},key=key)
    broker=MagicMock()
    msg=MagicMock()
    msg.error.return_value=None
    msg.topic.return_value=TOPIC
    msg.key.return_value=event["event_id"].encode()
    msg.value.return_value=json.dumps(event).encode()
    broker.poll.return_value=msg
    with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
        admin.execute("GRANT addressrail_consumer TO addressrail_api")
    try:
        first=process_one(consumer=broker,dsn=os.environ["SAAS_DATABASE_URL"],
                          tenant_id=TENANT_A,key=key)
        assert first["accepted"] is True
        assert broker.commit.call_count==1
        repeated=process_one(consumer=broker,dsn=os.environ["SAAS_DATABASE_URL"],
                             tenant_id=TENANT_A,key=key)
        assert repeated["duplicate"] is True
        assert broker.commit.call_count==2
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id', %s, true)",(TENANT_A,))
                assert db.execute("SELECT count(*) FROM saas_inbox WHERE event_id=%s",
                                  (event["event_id"],)).fetchone()[0]==1
        broker.commit.reset_mock()
        with pytest.raises(ValueError,match="Tenant mismatch"):
            process_one(consumer=broker,dsn=os.environ["SAAS_DATABASE_URL"],
                        tenant_id=TENANT_B,key=key)
        broker.commit.assert_not_called()
    finally:
        with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
            admin.execute("REVOKE addressrail_consumer FROM addressrail_api")


def test_quarantine_metadata_is_durable_and_tenant_isolated(prepared):
    from saas.quarantine import record_quarantine
    raw=b"synthetic invalid kafka event, no customer information"
    with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
        admin.execute("GRANT addressrail_consumer TO addressrail_api")
    try:
        first=record_quarantine(dsn=os.environ["SAAS_DATABASE_URL"],
            tenant_id=TENANT_A,consumer_name="python-inbox",
            reason="INVALID_ENVELOPE",raw_event=raw)
        second=record_quarantine(dsn=os.environ["SAAS_DATABASE_URL"],
            tenant_id=TENANT_A,consumer_name="python-inbox",
            reason="INVALID_ENVELOPE",raw_event=raw)
        assert first["new"] and not second["new"]
        assert first["offset_committed"] is False
        with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_A,))
                assert db.execute("SELECT count(*) FROM saas_quarantine WHERE event_fingerprint=%s",(first["fingerprint"],)).fetchone()[0]==1
            with db.transaction():
                db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_B,))
                assert db.execute("SELECT count(*) FROM saas_quarantine WHERE event_fingerprint=%s",(first["fingerprint"],)).fetchone()[0]==0
    finally:
        with psycopg.connect(os.environ["SAAS_TEST_ADMIN_DSN"],autocommit=True) as admin:
            admin.execute("REVOKE addressrail_consumer FROM addressrail_api")
