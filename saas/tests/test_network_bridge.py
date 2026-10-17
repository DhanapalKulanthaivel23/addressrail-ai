"""Real PostgreSQL tenant isolation plus HTTP-boundary tests for private network API.

This uses a contract-compatible test double, not private implementation code
and NOT a real SWIFT/CBPR+ network end-to-end test.
"""
import json
import os
import threading
import uuid
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlsplit

import psycopg
import pytest
from fastapi.testclient import TestClient

from saas.app import app
from saas import iso_simulation
from xml.etree import ElementTree as ET
from saas.tests.test_tenant_api import prepared,token,TENANT_A,TENANT_B

pytestmark=pytest.mark.skipif(not os.getenv("SAAS_TEST_ADMIN_DSN"),
                             reason="Real ephemeral PostgreSQL required")
KEY="synthetic-staging-private-network-key-test-1234"

class StubHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.server.calls.append(("POST",self.path,self.headers.get("X-Sim-Service-Key")))
        if (self.path not in {"/v1/async/messages","/v1/validate-iso-pacs008-async"}
             or self.headers.get("X-Sim-Service-Key")!=KEY):
            return self.send(403,{"error":"forbidden"})
        if self.server.fail_once:
            self.server.fail_once=False
            return self.send(503,{"error":"temporary outage"})
        size=int(self.headers.get("Content-Length","0"))
        data=json.loads(self.rfile.read(size))
        iso=self.path=="/v1/validate-iso-pacs008-async"
        if data.get("synthetic") is not True or data.get("message_format")!="PACS008":
            return self.send(400,{"error":"invalid fictional payment"})
        if iso:
            try:
                doc=ET.fromstring(data["payload"])
                namespace=doc.tag.split("}")[0].lstrip("{")
                version=next(ver for ver,pinned in iso_simulation.PINNED.items()
                             if pinned[0]==namespace)
                e2e=doc.findtext(".//{"+namespace+"}EndToEndId")
                if e2e!=data["reference"] or len(e2e)>35:
                    raise ValueError("Invalid fictional payment correlation")
            except (KeyError,ValueError,StopIteration,ET.ParseError,TypeError):
                return self.send(400,{"error":"Invalid ISO fixture"})
        elif data.get("payload")!="<Synthetic/>":
            return self.send(400,{"error":"invalid fictional payment"})
        reference=data["reference"]
        previous=self.server.records.get(reference)
        if previous and previous["payload"]!=data:
            return self.send(400,{"error":"conflicting reference"})
        if not previous:
            previous={"id":str(uuid.uuid4()),"payload":data}
            self.server.records[reference]=previous
        reply=self.reply(previous,duplicate=previous["payload"]!=data)
        if iso:
            proof=iso_simulation.PINNED[version]
            reply["iso_base_validation"]={
                "result":"BASE_XSD_VALID",
                "namespace":proof[0],
                "schema_sha256":("0"*64 if self.server.bad_iso else proof[1]),
                "schema_version":proof[2],
                "original_reference":data["reference"],
                "synthetic":True,"settled":False,
                "certified_cbpr":False,"swift_usage_guidelines_checked":False
            }
            reply["scheme_conformance"]="NOT_ASSESSED"
        return self.send(202,reply)
    def do_GET(self):
        self.server.calls.append(("GET",self.path,self.headers.get("X-Sim-Service-Key")))
        if self.headers.get("X-Sim-Service-Key")!=KEY:return self.send(403,{"error":"forbidden"})
        parts=urlsplit(self.path).path.split("/")
        if len(parts)!=5 or parts[:4]!=["","v1","async","messages"]:
            return self.send(404,{"error":"not found"})
        match=next((v for v in self.server.records.values() if v["id"]==parts[-1]),None)
        if match is None:return self.send(404,{"error":"not found"})
        return self.send(200,self.reply(match))
    def reply(self,record,duplicate=False):
        ref=record["payload"]["reference"]
        if self.server.malicious:
            return {"message_id":record["id"],"network_ack":"SIMULATED_ACK",
                    "state":"BANK_RESPONSE_RECEIVED","bank_status":"BANK_ACCEPTED",
                    "synthetic":True,"settled":True}
        status=("BANK_REJECTED" if ref.startswith("SIMRJCT_") else
                "BANK_PENDING" if ref.startswith("SIMWAIT_") else "BANK_ACCEPTED")
        state=("AWAITING_BANK" if not self.server.complete else
               "BANK_RESPONSE_PENDING" if status=="BANK_PENDING" else "BANK_RESPONSE_RECEIVED")
        result={"message_id":record["id"],"network_ack":"SIMULATED_ACK",
                "state":state,"bank_status":status if self.server.complete else None,
                "synthetic":True,"settled":False}
        if duplicate:result["duplicate"]=True
        return result
    def send(self,status,data):
        raw=json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)
    def log_message(self,*args):
        pass

@pytest.fixture
def network_stub(monkeypatch):
    server=ThreadingHTTPServer(("127.0.0.1",0),StubHandler)
    server.records={}
    server.calls=[]
    server.complete=False
    server.malicious=False
    server.bad_iso=False
    server.fail_once=False
    monkeypatch.setenv("SAAS_ENABLE_NETWORK_BRIDGE","true")
    monkeypatch.setenv("SAAS_SIM_NETWORK_URL",f"http://127.0.0.1:{server.server_port}")
    monkeypatch.setenv("SAAS_SIM_NETWORK_SERVICE_KEY",KEY)
    thread=threading.Thread(target=server.serve_forever,daemon=True)
    thread.start()
    try:yield server
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)

def test_disabled_and_invalid_gateway_fails_closed(prepared,monkeypatch):
    auth=token(prepared,TENANT_A)
    monkeypatch.delenv("SAAS_ENABLE_NETWORK_BRIDGE",raising=False)
    with TestClient(app) as client:
        response=client.post("/v1/tenancy/network/simulations",
            json={"reference":"TESTDISABLED01","scenario":"ACCEPT"},headers=auth)
        assert response.status_code==503
        assert client.get("/v1/tenancy/network/simulations/TESTDISABLED01",headers=auth).status_code==503
    monkeypatch.setenv("SAAS_ENABLE_NETWORK_BRIDGE","true")
    monkeypatch.setenv("SAAS_SIM_NETWORK_URL","http://evil.example.invalid:8888")
    monkeypatch.setenv("SAAS_SIM_NETWORK_SERVICE_KEY",KEY)
    with TestClient(app) as client:
        assert client.post("/v1/tenancy/network/simulations",
              json={"reference":"TESTFORBIDDEN01","scenario":"ACCEPT"},headers=auth).status_code==503

def test_two_tenants_are_isolated_and_private_token_never_exposed(prepared,network_stub):
    client_ref="SIM_"+uuid.uuid4().hex[:15]
    a=token(prepared,TENANT_A)
    b=token(prepared,TENANT_B)
    with TestClient(app) as client:
        body={"reference":client_ref,"scenario":"REJECT","synthetic":True}
        first=client.post("/v1/tenancy/network/simulations",json=body,headers=a)
        assert first.status_code==202,first.text
        assert first.json()["state"]=="AWAITING_BANK"
        assert first.json()["network_ack"]=="SIMULATED_ACK"
        assert not first.json()["settlement_attested"]
        assert KEY not in first.text
        assert "message_id" not in first.json()
        assert client.get("/v1/tenancy/network/simulations/"+client_ref,headers=b).status_code==404
        second=client.post("/v1/tenancy/network/simulations",json=body,headers=b)
        assert second.status_code==202,second.text
        assert len(network_stub.records)==2
        assert all(x.startswith("SIMRJCT_") for x in network_stub.records)
        assert len(set(network_stub.records))==2
        again=client.post("/v1/tenancy/network/simulations",json=body,headers=a)
        assert again.status_code==202
        assert len(network_stub.records)==2
        network_stub.complete=True
        ra=client.get("/v1/tenancy/network/simulations/"+client_ref,headers=a)
        rb=client.get("/v1/tenancy/network/simulations/"+client_ref,headers=b)
        assert ra.status_code==rb.status_code==200
        assert ra.json()["bank_status"]==rb.json()["bank_status"]=="BANK_REJECTED"
        assert ra.json()["state"]=="BANK_RESPONSE_RECEIVED"
        assert ra.json()["settled"] is False
        conflict=client.post("/v1/tenancy/network/simulations",
            json={"reference":client_ref,"scenario":"ACCEPT"},headers=a)
        assert conflict.status_code==409
        assert client.post("/v1/tenancy/network/simulations",json=body,
                           headers=token(prepared,TENANT_A,"VIEWER")).status_code==403
        assert client.post("/v1/tenancy/network/simulations",json={**body,"synthetic":False},
                           headers=a).status_code==422
    with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
        assert db.execute("SELECT count(*) FROM saas_network_simulations").fetchone()[0]==0
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_A,))
            assert db.execute("SELECT count(*) FROM saas_network_simulations WHERE client_reference=%s",
                              (client_ref,)).fetchone()[0]==1
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_B,))
            assert db.execute("SELECT count(*) FROM saas_network_simulations WHERE client_reference=%s",
                              (client_ref,)).fetchone()[0]==1

def test_downstream_outage_can_recover_without_duplicate_simulated_payment(prepared,network_stub):
    reference="RETRY_"+uuid.uuid4().hex[:14]
    auth=token(prepared,TENANT_A)
    body={"reference":reference,"scenario":"ACCEPT"}
    network_stub.fail_once=True
    with TestClient(app) as client:
        first=client.post("/v1/tenancy/network/simulations",json=body,headers=auth)
        assert first.status_code==503,first.text
        pending=client.get("/v1/tenancy/network/simulations/"+reference,headers=auth)
        assert pending.status_code==200
        assert pending.json()["state"]=="SUBMITTING"
        second=client.post("/v1/tenancy/network/simulations",json=body,headers=auth)
        assert second.status_code==202,second.text
        assert len(network_stub.records)==1
        network_stub.complete=True
        final=client.get("/v1/tenancy/network/simulations/"+reference,headers=auth)
        assert final.status_code==200
        assert final.json()["bank_status"]=="BANK_ACCEPTED"
        network_stub.malicious=True
        unsafe=client.get("/v1/tenancy/network/simulations/"+reference,headers=auth)
        assert unsafe.status_code==503


def test_iso_v13_v14_tenant_isolation_and_pinned_evidence(prepared,network_stub):
    ref="ISO_"+uuid.uuid4().hex[:15]
    a,b=token(prepared,TENANT_A),token(prepared,TENANT_B)
    with TestClient(app) as client:
        for version in ("13","14"):
            network_stub.complete=False
            reference=ref+version
            body={"reference":reference,"scenario":"REJECT",
                  "iso_version":version,"amount_minor":12345,"synthetic":True}
            created=client.post("/v1/tenancy/network/iso-pacs008",
                                headers=a,json=body)
            assert created.status_code==202,(created.text,len(network_stub.records),[call[1] for call in network_stub.calls])
            data=created.json()
            assert data["base_xsd_validated"] is True
            assert data["schema_sha256"]==iso_simulation.PINNED[version][1]
            assert data["state"]=="AWAITING_BANK"
            assert data["network_ack"]=="SIMULATED_ACK"
            assert data["cbpr_conformance"]=="NOT_ASSESSED"
            assert data["verified_scheme"] is False and data["settled"] is False
            assert KEY not in created.text and "message_id" not in data
            assert client.get("/v1/tenancy/network/iso-pacs008/"+reference,
                              headers=b).status_code==404
            other=client.post("/v1/tenancy/network/iso-pacs008",
                              headers=b,json=body)
            assert other.status_code==202,other.text
            # A user's local reference never maps to another tenant's payment.
            if version=="14":
                assert len({key for key in network_stub.records if
                            key.startswith("SIMRJCT_")})==4
            reread=client.post("/v1/tenancy/network/iso-pacs008",
                               headers=a,json=body)
            assert reread.status_code==202
            network_stub.complete=True
            result=client.get("/v1/tenancy/network/iso-pacs008/"+reference,
                              headers=a)
            assert result.status_code==200,result.text
            assert result.json()["bank_status"]=="BANK_REJECTED"
            assert result.json()["base_xsd_validated"] is True
            assert not result.json()["settled"]
            invalid={**body,"amount_minor":999}
            assert client.post("/v1/tenancy/network/iso-pacs008",
                               headers=a,json=invalid).status_code==409
            assert client.post("/v1/tenancy/network/iso-pacs008",
                               headers=token(prepared,TENANT_A,"VIEWER"),
                               json=body).status_code==403
            assert client.post("/v1/tenancy/network/iso-pacs008",
                               headers=a,json={**body,"synthetic":False}).status_code==422
            assert client.post("/v1/tenancy/network/iso-pacs008",
                               headers=a,json={**body,"iso_version":"08"}).status_code==422
            assert client.post("/v1/tenancy/network/iso-pacs008",
                               headers=a,json={**body,"amount_minor":0}).status_code==422
    with psycopg.connect(os.environ["SAAS_DATABASE_URL"]) as db:
        assert db.execute("SELECT count(*) FROM saas_iso_simulations").fetchone()[0]==0
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_A,))
            assert db.execute("SELECT count(*) FROM saas_iso_simulations WHERE client_reference LIKE %s",(ref+"%",)).fetchone()[0]==2
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id',%s,true)",(TENANT_B,))
            assert db.execute("SELECT count(*) FROM saas_iso_simulations WHERE client_reference LIKE %s",(ref+"%",)).fetchone()[0]==2

def test_iso_outage_and_bad_attestation_rejected(prepared,network_stub):
    a=token(prepared,TENANT_A)
    reference="ISOERROR_"+uuid.uuid4().hex[:14]
    body={"reference":reference,"scenario":"ACCEPT","iso_version":"14",
          "amount_minor":1000,"synthetic":True}
    network_stub.fail_once=True
    with TestClient(app) as client:
        first=client.post("/v1/tenancy/network/iso-pacs008",headers=a,json=body)
        assert first.status_code==503
        reserved=client.get("/v1/tenancy/network/iso-pacs008/"+reference,headers=a)
        assert reserved.status_code==200
        assert reserved.json()["state"]=="SUBMITTING"
        assert reserved.json()["base_xsd_validated"] is False
        network_stub.bad_iso=True
        refused=client.post("/v1/tenancy/network/iso-pacs008",headers=a,json=body)
        assert refused.status_code==503
        assert client.get("/v1/tenancy/network/iso-pacs008/"+reference,
                          headers=a).json()["state"]=="SUBMITTING"
        network_stub.bad_iso=False
        accepted=client.post("/v1/tenancy/network/iso-pacs008",headers=a,json=body)
        assert accepted.status_code==202,(accepted.text,len(network_stub.records),[call[1] for call in network_stub.calls])
        assert accepted.json()["schema_sha256"]==iso_simulation.PINNED["14"][1]
        assert len(network_stub.records)==1
        network_stub.malicious=True
        unsafe=client.get("/v1/tenancy/network/iso-pacs008/"+reference,headers=a)
        assert unsafe.status_code==503
