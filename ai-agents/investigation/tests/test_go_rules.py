"""Cross-language contract: Go rules are a veto, never banking evidence."""
import asyncio
import json
import httpx
import pytest
from investigation.agent import investigate
from investigation.go_rules import GoRulesClient, GoRulesUnavailable, GoReconciliation
from investigation.models import Payment, Event
from investigation.tools import PaymentTools

PAYMENT={
 "id":"PAY-10001","status":"RJCT","synthetic":True,"scheme":"CBPR+ synthetic",
 "messageType":"pacs.008","amount":25000,"currency":"EUR",
 "debtorAgent":"SYNTHETIC BANK A","creditorAgent":"SYNTHETIC BANK B",
}
EVENT={
 "id":4,"paymentId":"PAY-10001","occurredAt":"2026-10-13T09:03:00Z",
 "type":"RJCT","source":"synthetic-feed","evidenceRef":"DEMO-EVT-004",
 "description":"Synthetic rejection"
}
GO_RESPONSE={
 "validator":"addressrail-go-educational-v1","verdict":"CONSISTENT",
 "recordedStatus":"RJCT","latestEventType":"RJCT","rules":[],
 "evidenceRefs":["DEMO-EVT-004"],"synthetic":True,
 "settlementAttested":False,"safeToRetry":False,
 "disclaimer":"Fictional only: no settlement."
}

def core():
    def reply(request):
        if request.url.path.endswith("/events"):
            return httpx.Response(200,json=[EVENT])
        return httpx.Response(200,json=PAYMENT)
    return PaymentTools(transport=httpx.MockTransport(reply))

def fake_go(response=GO_RESPONSE, captures=None):
    def reply(request):
        assert request.url.host=="127.0.0.1"
        assert request.url.path=="/v1/reconcile"
        data=json.loads(request.content)
        assert data["synthetic"] is True
        assert data["paymentId"]=="PAY-10001"
        assert "debtorAgent" not in json.dumps(data)
        assert "description" not in json.dumps(data)
        if captures is not None:
            captures.append(data)
        return httpx.Response(200,json=response)
    return GoRulesClient(transport=httpx.MockTransport(reply))

def test_go_reconciliation_contract_accepts_only_bounded_local_synthetic_events():
    captures=[]
    result=asyncio.run(fake_go(captures=captures).reconcile(
        Payment.model_validate(PAYMENT),[Event.model_validate(EVENT)]))
    assert result.verdict=="CONSISTENT" and not result.settlementAttested
    assert not result.safeToRetry and captures[0]["recordedStatus"]=="RJCT"
    for invalid in [
        "https://127.0.0.1:8094",
        "http://example.com:8094",
        "http://localhost:8094",
        "http://127.0.0.1:8094/wrong",
        "http://127.0.0.1:8094/?token=secret",
    ]:
        with pytest.raises(ValueError):
            GoRulesClient(base_url=invalid)

def test_bad_go_response_fails_closed():
    for body in [
        {**GO_RESPONSE,"safeToRetry":True},
        {**GO_RESPONSE,"settlementAttested":True},
        {**GO_RESPONSE,"validator":"unknown-service"},
        {**GO_RESPONSE,"recordedStatus":"ACSC"},
        {**GO_RESPONSE,"latestEventType":"PENDING"},
        {**GO_RESPONSE,"synthetic":False},
    ]:
        with pytest.raises(GoRulesUnavailable):
            asyncio.run(fake_go(body).reconcile(
                Payment.model_validate(PAYMENT),[Event.model_validate(EVENT)]))

def test_go_unavailable_fails_closed(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GO_RULES","true")
    monkeypatch.delenv("INVESTIGATION_ENABLE_GEMINI",raising=False)
    async def unavailable(self,payment,events):
        raise GoRulesUnavailable("no local engine")
    monkeypatch.setattr(GoRulesClient,"reconcile",unavailable)
    result=asyncio.run(investigate("PAY-10001",core()))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"
    assert result.finding.status=="UNAVAILABLE"
    assert result.go_engine["settlementAttested"] is False
    assert not result.ai_used

def test_go_consistent_preserves_python_recorded_status(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GO_RULES","true")
    async def consistent(self,payment,events):
        return GoReconciliation.model_validate(GO_RESPONSE)
    monkeypatch.setattr(GoRulesClient,"reconcile",consistent)
    result=asyncio.run(investigate("PAY-10001",core()))
    assert result.outcome=="EVIDENCE_FOUND"
    assert result.finding.status=="RJCT"
    assert result.go_engine["verdict"]=="CONSISTENT"
    assert not result.go_engine["safeToRetry"]

def test_go_conflicting_finding_vetoes_optional_llm(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GO_RULES","true")
    mismatch={**GO_RESPONSE,"verdict":"REVIEW_REQUIRED","rules":[{
       "id":"EVT-CONFLICT","path":"/recordedStatus","severity":"REVIEW",
       "message":"conflicting synthetic event"
    }]}
    async def conflicting(self,payment,events):
        return GoReconciliation.model_validate(mismatch)
    monkeypatch.setattr(GoRulesClient,"reconcile",conflicting)
    result=asyncio.run(investigate("PAY-10001",core()))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"
    assert result.finding.status=="CONFLICT"
    assert not result.ai_used

def test_go_opt_out_is_backwards_compatible(monkeypatch):
    monkeypatch.delenv("INVESTIGATION_ENABLE_GO_RULES",raising=False)
    result=asyncio.run(investigate("PAY-10001",core()))
    assert result.outcome=="EVIDENCE_FOUND" and result.go_engine is None
