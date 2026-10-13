import asyncio
import json
import httpx
from investigation.agent import investigate, _evidence
from investigation.models import Payment, Event
from investigation.tools import PaymentTools

PAYMENT={"id":"PAY-10001","status":"RJCT","synthetic":True,"scheme":"CBPR+ (illustrative)",
         "messageType":"pacs.008","amount":25000.0,"currency":"EUR",
         "debtorAgent":"SYNTHETIC BANK A","creditorAgent":"SYNTHETIC BANK B"}
EVENT={"id":1,"paymentId":"PAY-10001","occurredAt":"2026-10-13T09:03:00Z",
       "type":"RJCT","source":"synthetic-status-feed","evidenceRef":"DEMO-EVT-004",
       "description":"Simulated rejection; reason AC01 (incorrect account number)"}

def mock_tools(payment=PAYMENT, events=None, status=200):
    events=[EVENT] if events is None else events
    def responder(request):
        if status != 200:
            return httpx.Response(status)
        if request.url.path.endswith("/events"):
            return httpx.Response(200,json=events)
        return httpx.Response(200,json=payment)
    return PaymentTools(transport=httpx.MockTransport(responder))

def run(tools, payment_id="PAY-10001"):
    return asyncio.run(investigate(payment_id,tools))

def test_rejection_is_evidence_grounded(monkeypatch):
    monkeypatch.delenv("INVESTIGATION_ENABLE_GEMINI",raising=False)
    result=run(mock_tools())
    assert result.outcome=="EVIDENCE_FOUND"
    assert result.finding.status=="RJCT"
    assert result.finding.evidence_refs==["DEMO-EVT-004"]
    assert result.finding.requires_human_review and not result.ai_used

def test_unknown_payment():
    result=run(mock_tools(status=404),payment_id="UNKNOWN")
    assert result.outcome=="NOT_FOUND" and result.payment_status is None

def test_core_unavailable():
    result=run(mock_tools(status=503))
    assert result.outcome=="SERVICE_UNAVAILABLE" and not result.ai_used

def test_status_conflict():
    result=run(mock_tools(payment={**PAYMENT,"status":"ACSP"}))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"
    assert result.finding.status=="CONFLICT"
    assert not result.ai_used

def test_unproven_settlement_is_not_asserted():
    e={**EVENT,"type":"SUBMITTED","description":"Submitted"}
    result=run(mock_tools(payment={**PAYMENT,"status":"SUBMITTED"},events=[e]))
    assert result.finding.status=="OTHER"
    assert "settled" not in result.finding.explanation.lower()

def test_wrong_event_reference_is_refused():
    e={**EVENT,"paymentId":"OTHER"}
    result=run(mock_tools(events=[e]))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"

def test_live_payment_refused():
    result=run(mock_tools(payment={**PAYMENT,"synthetic":False}))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"

def test_empty_history_is_insufficient():
    result=run(mock_tools(events=[]))
    assert result.outcome=="INSUFFICIENT_EVIDENCE"

def test_no_mutation_tool_is_exposed():
    assert not hasattr(PaymentTools,"post")
    assert not hasattr(PaymentTools,"release_payment")
