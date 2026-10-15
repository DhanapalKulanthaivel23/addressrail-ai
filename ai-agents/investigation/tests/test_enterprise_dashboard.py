"""Offline enterprise-dashboard boundary checks. No network or Gemini required."""
from fastapi.testclient import TestClient
from investigation.enterprise import create_app, bootstrap_admin
from cryptography.fernet import Fernet
import pytest

@pytest.fixture
def client(tmp_path):
    file=str(tmp_path/"enterprise.sqlite3")
    bootstrap_admin(file,"bank_demo","admin_demo","TrainingAdminPassphrase-2026!")
    return TestClient(create_app(file,Fernet.generate_key(),b"test-local-hmac-signing-key-over-32-bytes"))

def sign_in(client):
    result=client.post("/v1/login",json={
       "tenant":"bank_demo","username":"admin_demo","password":"TrainingAdminPassphrase-2026!"})
    assert result.status_code==200
    return {"Authorization":"Bearer "+result.json()["access_token"]}

def test_local_dashboard_is_standalone_and_has_safe_headers(client):
    page=client.get("/enterprise/dashboard")
    script=client.get("/enterprise/dashboard.js")
    assert page.status_code==200 and script.status_code==200
    assert "Tenant-scoped Case Workspace" in page.text
    assert page.headers["cache-control"]=="no-store"
    assert script.headers["cache-control"]=="no-store"
    assert "default-src 'none'" in page.headers["content-security-policy"]
    assert "script-src 'self'" in page.headers["content-security-policy"]
    assert page.headers["x-frame-options"]=="DENY"
    assert "noindex,nofollow" in page.text
    assert "/enterprise/dashboard.js" in page.text

def test_client_keeps_token_ephemeral_and_renders_as_text(client):
    source=client.get("/enterprise/dashboard.js").text
    assert "let token=null" in source
    assert "Authorization" in source
    assert "sessionStorage" not in source and "localStorage" not in source
    assert "innerHTML" not in source and "eval(" not in source
    assert "textContent" in source and 'credentials:"omit"' in source

def test_entire_case_api_requires_valid_login(client):
    assert client.get("/v1/me").status_code==401
    assert client.get("/v1/cases").status_code==401
    assert client.get("/v1/cases/CASE-SYNTHETIC").status_code==401
    assert client.post("/v1/cases",json={
        "synthetic":True,"payment_id":"PAY-10001","evidence":"SYNTHETIC ONLY"}).status_code==401
    assert client.get("/v1/audit/verify").status_code==401

def test_signed_in_admin_controls_case_and_logout(client):
    auth=sign_in(client)
    me=client.get("/v1/me",headers=auth)
    assert me.status_code==200 and me.json()["role"]=="ADMIN"
    created=client.post("/v1/cases",headers=auth,json={
        "synthetic":True,"payment_id":"CHAPS-DEMO-101","evidence":"SYNTHETIC PENDING EVENT"})
    assert created.status_code==201
    case_id=created.json()["id"]
    detail=client.get("/v1/cases/"+case_id,headers=auth)
    assert detail.status_code==200 and detail.json()["evidence"]=="SYNTHETIC PENDING EVENT"
    assert client.get("/v1/audit/verify",headers=auth).json()["valid"] is True
    assert client.post("/v1/logout",headers=auth).status_code==200
    assert client.get("/v1/cases",headers=auth).status_code==401

def test_fake_role_header_never_grants_access(client):
    assert client.get("/v1/cases",headers={
        "X-Role":"ADMIN","X-Tenant":"bank_demo","Authorization":"Bearer forged"}).status_code==401
