"""Offline tests for the isolated enterprise training foundation. No production services."""
import sqlite3
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from investigation.enterprise import create_app, bootstrap_admin, service_from_environment

@pytest.fixture
def ctx(tmp_path):
    db=str(tmp_path/"training.db")
    bootstrap_admin(db,"tenant_a","admin_a","A-very-long-training-password-2026!")
    bootstrap_admin(db,"tenant_b","admin_b","B-very-long-training-password-2026!")
    app=create_app(db,Fernet.generate_key(),b"test-only-audit-hmac-key-long-enough-2026")
    return TestClient(app),db

def login(client,tenant,username,password):
    response=client.post("/v1/login",json={"tenant":tenant,"username":username,"password":password})
    assert response.status_code==200,response.text
    return {"Authorization":"Bearer "+response.json()["access_token"]}

def seeded(ctx):
    client,db=ctx
    a=login(client,"tenant_a","admin_a","A-very-long-training-password-2026!")
    b=login(client,"tenant_b","admin_b","B-very-long-training-password-2026!")
    for h in [a,b]:
        for username,role in [("analyst_01","INVESTIGATOR"),("reviewer_01","REVIEWER"),("viewer_01","VIEWER")]:
            r=client.post("/v1/users",headers=h,json={"username":username,"role":role,
                "password":"TrainingPasswordFor-"+username+"-2026!"})
            assert r.status_code==201,r.text
    return client,db,a,b

def test_no_default_access_or_forged_role(ctx):
    client,_=ctx
    assert client.get("/v1/me").status_code==401
    assert client.get("/v1/me",headers={"Authorization":"Bearer forged"}).status_code==401
    assert client.post("/v1/login",json={"tenant":"tenant_a","username":"admin_a",
        "password":"wrong-password-2026"}).status_code==401

def test_roles_and_tenant_scope(ctx):
    client,db,a,b=seeded(ctx)
    ia=login(client,"tenant_a","analyst_01","TrainingPasswordFor-analyst_01-2026!")
    ra=login(client,"tenant_a","reviewer_01","TrainingPasswordFor-reviewer_01-2026!")
    va=login(client,"tenant_a","viewer_01","TrainingPasswordFor-viewer_01-2026!")
    assert client.post("/v1/users",headers=ia,json={"username":"injected_admin","role":"ADMIN",
        "password":"NoPrivilegeGranted2026!"}).status_code==403
    payload={"payment_id":"CHAPS-TESTRUN001","synthetic":True,
             "evidence":"SYNTHETIC PENDING - demo event ref E-1001"}
    response=client.post("/v1/cases",headers=ia,json=payload)
    assert response.status_code==201,response.text
    cid=response.json()["id"]
    assert client.get("/v1/cases/"+cid,headers=b).status_code==404
    assert client.get("/v1/cases",headers=b).json()==[]
    assert client.get("/v1/cases/"+cid,headers=va).json().get("evidence") is None
    assert client.get("/v1/cases/"+cid,headers=ra).json()["evidence"]==payload["evidence"]
    assert client.post("/v1/cases",headers=va,json=payload).status_code==403
    assert client.post("/v1/cases/"+cid+"/review",headers=ia,
        json={"decision":"APPROVED_FOR_TRAINING","note":"This is only a mock approval"}).status_code==403
    assert client.post("/v1/cases/"+cid+"/review",headers=ra,
        json={"decision":"APPROVED_FOR_TRAINING","note":"Checked fictional pending evidence"}).status_code==200
    assert client.post("/v1/cases/"+cid+"/review",headers=ra,
        json={"decision":"REJECTED_FOR_TRAINING","note":"Second attempted decision"}).status_code==409
    assert client.get("/v1/audit/verify",headers=a).json()["valid"] is True
    assert client.get("/v1/audit/verify",headers=ra).status_code==403
    with sqlite3.connect(db) as conn:
        row=conn.execute("SELECT evidence FROM cases WHERE id=?",(cid,)).fetchone()
        assert b"SYNTHETIC PENDING" not in row[0]

def test_same_payment_id_allowed_for_two_tenants_but_cross_tenant_review_denied(ctx):
    client,_,a,b=seeded(ctx)
    payload={"payment_id":"PAY-10001","synthetic":True,"evidence":"Synthetic evidence"}
    cid_a=client.post("/v1/cases",headers=a,json=payload).json()["id"]
    cid_b=client.post("/v1/cases",headers=b,json=payload).json()["id"]
    assert cid_a!=cid_b
    rb=login(client,"tenant_b","reviewer_01","TrainingPasswordFor-reviewer_01-2026!")
    assert client.post("/v1/cases/"+cid_a+"/review",headers=rb,json={
        "decision":"APPROVED_FOR_TRAINING","note":"Should not access another tenant"}).status_code==404
    assert client.get("/v1/cases/"+cid_b,headers=b).status_code==200

def test_denies_non_synthetic_and_bad_cases(ctx):
    client,_,a,_=seeded(ctx)
    assert client.post("/v1/cases",headers=a,json={
        "payment_id":"CHAPS-001","synthetic":False,"evidence":"Not synthetic"}).status_code==422
    assert client.post("/v1/cases",headers=a,json={
        "payment_id":"../../unsafe","synthetic":True,"evidence":"synthetic"}).status_code==422
    assert client.post("/v1/users",headers=a,json={
        "username":"user_123","role":"SUPER_ADMIN","password":"ReallyLongPassword2026!"}).status_code==422

def test_audit_detects_changed_existing_entries(ctx):
    client,db,a,_=seeded(ctx)
    client.post("/v1/cases",headers=a,json={
        "payment_id":"INST-001","synthetic":True,"evidence":"Fictional outcome"})
    assert client.get("/v1/audit/verify",headers=a).json()["valid"] is True
    with sqlite3.connect(db) as conn:
        conn.execute("UPDATE audit SET subject='modified' WHERE action='CASE_OPENED'")
    assert client.get("/v1/audit/verify",headers=a).json()["valid"] is False

def test_logout_revokes_token(ctx):
    client,_,a,_=seeded(ctx)
    assert client.post("/v1/logout",headers=a).status_code==200
    assert client.get("/v1/me",headers=a).status_code==401

def test_fail_closed_when_not_enabled(monkeypatch):
    monkeypatch.delenv("ADDRESSRAIL_ENTERPRISE_LAB_ENABLED",raising=False)
    with pytest.raises(RuntimeError):
        service_from_environment()
    monkeypatch.setenv("ADDRESSRAIL_ENTERPRISE_LAB_ENABLED","true")
    monkeypatch.setenv("ADDRESSRAIL_ENVIRONMENT","production")
    with pytest.raises(RuntimeError):
        service_from_environment()
