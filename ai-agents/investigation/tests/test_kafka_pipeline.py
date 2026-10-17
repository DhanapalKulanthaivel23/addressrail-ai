"""Offline cross-stage Kafka pipeline contracts, privacy and idempotent report export."""
import asyncio
import json
import os
from pathlib import Path
import httpx
import pytest
from fastapi.testclient import TestClient
from investigation import kafka_workers
from investigation.pipeline_store import PipelineStore, JobConflict
from investigation.kafka_bus import encode, decode, TOPICS
from investigation.kafka_workers import (
    envelope, validate_payment, investigate_payment, finalize_report, run_role)
from investigation.go_rules import GoXMLInspection
from investigation.copilot import CopilotResponse
from investigation.app import app

XML='''<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-KAFKA</MsgId></GrpHdr>
<CdtTrfTxInf><IntrBkSttlmAmt Ccy="EUR">100.00</IntrBkSttlmAmt>
<Dbtr><Nm>SYNTHETIC BANK A</Nm></Dbtr></CdtTrfTxInf>
</FIToFICstmrCdtTrf></Document>'''
REQUEST={"payment_id":"PAY-10001","question":"Explain CBPR+ pacs.008 rejection and Swift evidence",
         "synthetic_xml":XML}
GO={"validator":"addressrail-go-educational-v1","wellFormed":True,"validSubset":False,
    "messageFamily":"pacs.008",
    "namespace":"urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
    "elements":8,"rules":[{"id":"XML-ADDR","path":"/Document/Dbtr/PstlAdr",
                          "severity":"ERROR","message":"Missing fictional address data"}],
    "synthetic":True,"settlementAttested":False,"safeToRetry":False,
    "disclaimer":"Synthetic subset only."}

class Go:
    async def inspect_xml(self,rail,message):
        assert rail=="CBPR"
        assert message==XML
        return GoXMLInspection.model_validate(GO)

class Java:
    async def training_case_request(self,path,payload=None):
        assert path=="/api/v1/labs/investigation-cases"
        assert payload["paymentId"]=="PAY-10001"
        return {"trainingCase":{"id":"CASE-DEMO-1","state":"OPEN"}}

def result():
    return CopilotResponse(payment_id="PAY-10001",rail="CBPR",status="RJCT",
        outcome="EVIDENCE_FOUND",evidence_refs=["DEMO-EVT-004"],go_findings=GO["rules"],
        citations=[{"id":"SWIFT-SR2026-DELAY","version":"2026","url":"https://www.swift.com"}],
        explanation=None,ai_used=False,ai_model=None,ai_reason="disabled",
        guardrails=["synthetic_only"],synthetic=True)

def test_job_idempotency_and_immutable_report(tmp_path):
    db=PipelineStore(str(tmp_path/"jobs.sqlite"))
    id,new=db.begin("UNIQUE-DEMO-100",REQUEST)
    assert new and id.startswith("AR-JOB-")
    same,created=db.begin("UNIQUE-DEMO-100",REQUEST)
    assert same==id and not created
    with pytest.raises(JobConflict):
        db.begin("UNIQUE-DEMO-100",{**REQUEST,"question":"Different synthetic request"})
    report={"job_id":id,"synthetic":True,"settlement_attested":False,
            "safe_to_retry":False,"case_id":"CASE-DEMO"}
    db.complete(id,report)
    assert db.read(id)["state"]=="COMPLETED"
    assert db.read(id)["report"]["case_id"]=="CASE-DEMO"
    db.complete(id,report)
    with pytest.raises(JobConflict):
        db.complete(id,{**report,"case_id":"CASE-CHANGED"})
    with pytest.raises(ValueError):
        db.complete(id,{**report,"safe_to_retry":True})

def test_kafka_envelope_synthetic_only_and_size_bounds():
    data=envelope("AR-JOB-test",payment_id="PAY-10001")
    assert decode(encode(data))==data
    for unsafe in [
        {**data,"synthetic":False},
        {**data,"version":99},
        {**data,"synthetic_xml":"SYNTHETIC"*20000},
    ]:
        with pytest.raises(ValueError): encode(unsafe)
    with pytest.raises(ValueError):decode(b"garbage")

def test_all_stages_export_report_from_Java_case_and_Go_finding(tmp_path):
    store=PipelineStore(str(tmp_path/"jobs.db"))
    id,_=store.begin("ONE-DEMO-REPORT",REQUEST)
    submitted=envelope(id,**REQUEST)
    validated=asyncio.run(validate_payment(submitted,go=Go()))
    assert validated["validation"]["status"]=="REVIEW_REQUIRED"
    assert validated["validation"]["rule_ids"]==["XML-ADDR"]
    assert validated["validation"]["wellFormed"] is True
    async def investigate(req):
        assert req.payment_id=="PAY-10001"
        return result()
    investigated=asyncio.run(investigate_payment(validated,tools=Java(),copilot=investigate))
    assert investigated["report"]["case_id"]=="CASE-DEMO-1"
    assert investigated["report"]["investigation"]["ai_used"] is False
    assert investigated["report"]["safe_to_retry"] is False
    assert investigated["report"]["settlement_attested"] is False
    finalize_report(investigated,store)
    exported=store.read(id)["report"]
    assert exported["validation"]["rule_ids"]==["XML-ADDR"]
    assert exported["investigation"]["status"]=="RJCT"
    assert exported["requires_human_review"]
    assert "SYNTHETIC BANK" not in json.dumps(exported)  # source XML not retained

class FakeBus:
    def __init__(self,role,events):
        self.role=role
        self.events=list(events)
        self.emitted=[]
        self.acks=0
    def receive(self,wait=1):
        return self.events.pop(0) if self.events else None
    def send(self,topic,key,data):
        assert topic in TOPICS.values()
        self.emitted.append((topic,key,data))
    def ack(self):
        self.acks+=1

def test_retry_and_dlq_after_three_attempts(tmp_path,monkeypatch):
    from investigation.kafka_bus import Event
    store=PipelineStore(str(tmp_path/"retry.db"))
    id,_=store.begin("RETRY-DEMO-10",REQUEST)
    payload=envelope(id,**REQUEST)
    fake=FakeBus("validate",[
        Event(TOPICS["submitted"],id,{**payload,"attempt":2})
    ])
    monkeypatch.setattr(kafka_workers,"process_one",lambda *args: (_ for _ in ()).throw(RuntimeError("synthetic failure")))
    monkeypatch.setattr(kafka_workers.time,"sleep",lambda n:None)
    assert run_role("validate",bus=fake,store=store,stop_after=1)==1
    assert fake.acks==1 and fake.emitted[0][0]==TOPICS["deadletter"]
    assert fake.emitted[0][2]["error_code"]=="RuntimeError"
    assert "synthetic_xml" not in fake.emitted[0][2]
    assert store.read(id)["state"]=="REVIEW_REQUIRED"
    fake=FakeBus("validate",[Event(TOPICS["submitted"],id,{**payload,"attempt":0})])
    assert run_role("validate",bus=fake,store=store,stop_after=1)==1
    assert fake.emitted[0][0]==TOPICS["submitted"]
    assert fake.emitted[0][2]["attempt"]==1

def test_protected_http_submission_and_report(tmp_path,monkeypatch):
    from investigation import pipeline_api
    class FakeProducer:
        messages=[]
        def send(self,topic,key,value):
            self.messages.append((topic,key,value))
        def close(self):pass
    monkeypatch.setattr(pipeline_api,"KafkaBus",FakeProducer)
    monkeypatch.setattr(pipeline_api,"PipelineStore",lambda:PipelineStore(str(tmp_path/"api.db")))
    monkeypatch.setenv("COPILOT_ENABLE_API","true")
    monkeypatch.setenv("ADDRESSRAIL_ENABLE_KAFKA_PIPELINE","true")
    monkeypatch.setenv("COPILOT_API_TOKEN","Z"*48)
    with TestClient(app) as client:
        endpoint="/api/pipeline/v1/submissions"
        assert client.post(endpoint,json=REQUEST).status_code==401
        token={"Authorization":"Bearer "+"Z"*48,"Idempotency-Key":"HTTP-DEDUP-101"}
        response=client.post(endpoint,json=REQUEST,headers=token)
        assert response.status_code==202,response.text
        job=response.json()["job_id"]
        again=client.post(endpoint,json=REQUEST,headers=token)
        assert again.status_code==202 and again.json()["created"] is False
        assert len(FakeProducer.messages)==1
        assert client.get(endpoint+"/"+job,headers=token).json()["state"]=="QUEUED"
        assert client.get(endpoint+"/"+job+"/report",headers=token).status_code==409
        store=PipelineStore(str(tmp_path/"api.db"))
        store.complete(job,{"job_id":job,"synthetic":True,"safe_to_retry":False,
                  "settlement_attested":False,"case_id":"CASE-0001"})
        downloaded=client.get(endpoint+"/"+job+"/report",headers=token)
        assert downloaded.status_code==200
        assert downloaded.headers["content-disposition"].endswith('.json"')
        assert downloaded.json()["case_id"]=="CASE-0001"
        assert client.post(endpoint,json=REQUEST,headers={**token,"Origin":"https://evil.example"}).status_code==403

def test_completed_report_replay_is_noop(tmp_path,monkeypatch):
    from investigation.kafka_bus import Event
    store=PipelineStore(str(tmp_path/"complete.db"))
    id,_=store.begin("COMPLETED-REPLAY-101",REQUEST)
    store.complete(id,{"job_id":id,"synthetic":True,"settlement_attested":False,
                       "safe_to_retry":False,"case_id":"CASE-IMMUTABLE"})
    bus=FakeBus("validate",[Event(TOPICS["submitted"],id,envelope(id,**REQUEST))])
    def unexpected(*args):
        raise AssertionError("Replayed completed job must not be re-executed")
    monkeypatch.setattr(kafka_workers,"process_one",unexpected)
    assert run_role("validate",bus=bus,store=store,stop_after=1)==1
    assert bus.acks==1 and not bus.emitted
    assert store.read(id)["state"]=="COMPLETED"
    assert store.read(id)["report"]["case_id"]=="CASE-IMMUTABLE"

def test_duplicate_training_case_reused_after_retry():
    class DuplicateJava:
        async def training_case_request(self,path,payload=None):
            if payload is not None:
                return {"error":409}
            assert path.endswith("/by-payment/PAY-10001")
            return {"trainingCase":{"id":"CASE-EXISTING","state":"IN_REVIEW"}}
    async def describe(request):
        return result()
    validated=envelope("AR-JOB-existing",**REQUEST,validation={"status":"REVIEW_REQUIRED","rules":[]})
    out=asyncio.run(investigate_payment(validated,tools=DuplicateJava(),copilot=describe))
    assert out["report"]["case_id"]=="CASE-EXISTING"
    assert out["report"]["case_state"]=="IN_REVIEW"

def test_broker_unavailable_does_not_claim_submission(tmp_path,monkeypatch):
    from investigation import pipeline_api
    class OfflineProducer:
        def send(self,*args):
            raise RuntimeError("Kafka broker disconnected")
        def close(self):pass
    monkeypatch.setattr(pipeline_api,"KafkaBus",OfflineProducer)
    monkeypatch.setattr(pipeline_api,"PipelineStore",lambda:PipelineStore(str(tmp_path/"fail.db")))
    monkeypatch.setenv("COPILOT_ENABLE_API","true")
    monkeypatch.setenv("ADDRESSRAIL_ENABLE_KAFKA_PIPELINE","true")
    monkeypatch.setenv("COPILOT_API_TOKEN","P"*50)
    with TestClient(app) as client:
        headers={"Authorization":"Bearer "+"P"*50,
                 "Idempotency-Key":"BROKER-OUTAGE-101"}
        reply=client.post("/api/pipeline/v1/submissions",json=REQUEST,headers=headers)
        assert reply.status_code==503
        assert "unavailable" in reply.json()["detail"].lower()
        db=PipelineStore(str(tmp_path/"fail.db"))
        with db.connect() as conn:
            state=conn.execute("SELECT state FROM jobs WHERE idem_key='BROKER-OUTAGE-101'").fetchone()
        assert state["state"]=="PUBLISH_FAILED"
