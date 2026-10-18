"""PostgreSQL FORCE RLS and signed-JWT ISO investigation lifecycle.

The upstream private network is simulated by an authenticated local contract
stub here. Separate cross-repository acceptance is required for real services.
"""
import os
import uuid
import psycopg
from fastapi.testclient import TestClient
from saas.app import app
from saas.tests.test_network_bridge import network_stub
from saas.tests.test_tenant_api import prepared,token,TENANT_A,TENANT_B
import pytest

pytestmark=pytest.mark.skipif(not os.getenv("SAAS_TEST_ADMIN_DSN"),
                             reason="Ephemeral real PostgreSQL required")

def submit(client,ref,headers,scenario="REJECT",version="14"):
    return client.post("/v1/tenancy/network/iso-pacs008",
        headers=headers,json={"reference":ref,"scenario":scenario,
                              "iso_version":version,"amount_minor":1245,
                              "synthetic":True})

def test_rejection_generates_immutable_evidence_linked_report(prepared,network_stub):
    ref="INV_"+uuid.uuid4().hex[:12]
    a,b=token(prepared,TENANT_A),token(prepared,TENANT_B)
    path=f"/v1/tenancy/network/iso-pacs008/{ref}/investigation"
    with TestClient(app) as client:
        first=submit(client,ref,a)
        assert first.status_code==202,first.text
        pending=client.post(path,headers=a)
        assert pending.status_code==409,pending.text
        assert client.get(path,headers=a).status_code==404
        network_stub.complete=True
        created=client.post(path,headers=a)
        assert created.status_code==201,created.text
        result=created.json()
        assert result["created"] is True and result["settled"] is False
        assert result["requires_human_review"] is True
        case_id=result["case_id"]
        report=client.get(result["report_url"],headers=a)
        assert report.status_code==200
        assert "attachment" in report.headers["content-disposition"]
        evidence=report.json()
        assert evidence["origin"]=="ADDRESSRAIL_DETERMINISTIC_SYNTHETIC_NETWORK_SNAPSHOT"
        assert evidence["bank_status"]=="BANK_REJECTED"
        assert evidence["simulated_status"]=="RJCT"
        assert evidence["validation_result"]=="BASE_XSD_VALID"
        assert evidence["cbpr_conformance"]=="NOT_ASSESSED"
        assert evidence["requires_human_review"] is True
        assert evidence["source_method"]=="CURATED_REFERENCE_LOOKUP_NOT_LLM_RAG"
        assert evidence["ai_model_used"] is False
        assert evidence["settlement_attested"] is False
        assert evidence["safe_to_retry"] is False
        assert evidence["settled"] is False
        assert set(evidence["source_citation_ids"])=={
            "ISO-BASE-VS-PROFILE","SWIFT-TRACKER-NO-SETTLEMENT"}
        assert evidence["evidence_fingerprint"] and len(evidence["evidence_fingerprint"])==64
        assert "message_id" not in str(evidence)
        assert "SIM_SERVICE_KEY" not in str(evidence)
        assert client.get(result["report_url"],headers=b).status_code==404
        assert client.get(path,headers=b).status_code==404
        again=client.post(path,headers=a)
        assert again.status_code==201 and again.json()["created"] is False
        assert again.json()["case_id"]==case_id
        assert client.get(f"/v1/tenancy/cases/{case_id}",headers=a).json()["simulated_status"]=="RJCT"
        assert client.post(path,headers=token(prepared,TENANT_A,"VIEWER")).status_code==403
        assert client.post(path,headers=token(prepared,TENANT_A,"REVIEWER")).status_code==403
        assert client.get(path,headers=token(prepared,TENANT_A,"VIEWER")).status_code==200
        assert client.get(result["report_url"],headers=token(prepared,TENANT_A,"VIEWER")).status_code==200
        # Re-requests cannot mutate the existing report, even if upstream changes.
        network_stub.malicious=True
        assert client.post(path,headers=a).json()["created"] is False
        assert client.get(result["report_url"],headers=a).json()==evidence
    with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
        assert db.execute("SELECT count(*) FROM saas_iso_investigation_links").fetchone()[0]==0
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_A,))
            assert db.execute("SELECT count(*) FROM saas_iso_investigation_links WHERE client_reference=%s",(ref,)).fetchone()[0]==1
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_B,))
            assert db.execute("SELECT count(*) FROM saas_iso_investigation_links WHERE client_reference=%s",(ref,)).fetchone()[0]==0

def test_acceptance_does_not_infer_settlement_and_two_tenants_isolated(prepared,network_stub):
    ref="INV_"+uuid.uuid4().hex[:13]
    a,b=token(prepared,TENANT_A),token(prepared,TENANT_B)
    path=f"/v1/tenancy/network/iso-pacs008/{ref}/investigation"
    with TestClient(app) as client:
        assert submit(client,ref,a,scenario="ACCEPT",version="13").status_code==202
        assert submit(client,ref,b,scenario="ACCEPT",version="13").status_code==202
        network_stub.complete=True
        aa=client.post(path,headers=a)
        bb=client.post(path,headers=b)
        assert aa.status_code==bb.status_code==201,(aa.text,bb.text)
        assert aa.json()["case_id"]!=bb.json()["case_id"]
        for headers,created in ((a,aa),(b,bb)):
            payload=client.get(created.json()["report_url"],headers=headers).json()
            assert payload["bank_status"]=="BANK_ACCEPTED"
            assert payload["simulated_status"]=="UNKNOWN"
            assert payload["settled"] is False
            assert payload["settlement_attested"] is False
            assert payload["safe_to_retry"] is False
        assert client.get(aa.json()["report_url"],headers=b).status_code==404
        assert client.get(bb.json()["report_url"],headers=a).status_code==404
        assert client.get(path,headers=b).json()["case_id"]==bb.json()["case_id"]

def test_invalid_upstream_and_wrong_tenant_cannot_create_report(prepared,network_stub):
    ref="INV_"+uuid.uuid4().hex[:13]
    a,b=token(prepared,TENANT_A),token(prepared,TENANT_B)
    path=f"/v1/tenancy/network/iso-pacs008/{ref}/investigation"
    with TestClient(app) as client:
        assert client.post(path,headers=a).status_code==404
        assert submit(client,ref,a).status_code==202
        assert client.post(path,headers=b).status_code==404
        network_stub.complete=True
        network_stub.malicious=True
        assert client.post(path,headers=a).status_code==503
        assert client.get(path,headers=a).status_code==404
        network_stub.malicious=False
        good=client.post(path,headers=a)
        assert good.status_code==201,good.text
