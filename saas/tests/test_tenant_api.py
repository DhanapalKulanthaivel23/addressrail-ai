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
