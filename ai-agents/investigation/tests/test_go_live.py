"""Live synthetic Go API contract; enabled only in the cross-language CI job."""
import asyncio
import os
import pytest
from investigation.go_rules import GoRulesClient
from investigation.models import Payment, Event

@pytest.mark.skipif(os.getenv("GO_ENGINE_INTEGRATION") != "true",
                    reason="requires loopback Go server in cross-language integration job")
def test_live_go_event_reconciliation():
    payment = Payment(id="PAY-10001", status="RJCT", synthetic=True,
                      scheme="CBPR+ (synthetic)", messageType="pacs.008",
                      amount=25_000, currency="EUR",
                      debtorAgent="SYNTHETIC BANK A", creditorAgent="SYNTHETIC BANK B")
    events = [Event(paymentId="PAY-10001", occurredAt="2026-10-13T09:03:00Z",
                    type="RJCT", source="synthetic-status-feed",
                    evidenceRef="DEMO-EVT-004", description="Fictional rejection")]
    result = asyncio.run(GoRulesClient().reconcile(payment, events))
    assert result.validator == "addressrail-go-educational-v1"
    assert result.verdict == "CONSISTENT"
    assert result.rules == [] and result.evidenceRefs == ["DEMO-EVT-004"]
    assert result.safeToRetry is False
    assert result.settlementAttested is False

@pytest.mark.skipif(os.getenv("GO_ENGINE_INTEGRATION") != "true",
                    reason="requires loopback Go server in cross-language integration job")
def test_live_go_unknown_status_preserves_uncertainty():
    payment = Payment(id="INST-TEST-001", status="UNKNOWN", synthetic=True,
                      scheme="SCT Inst synthetic", messageType="pacs.008",
                      amount=1, currency="EUR",
                      debtorAgent="SYNTHETIC A", creditorAgent="SYNTHETIC B")
    events = [Event(paymentId="INST-TEST-001", occurredAt="2026-10-15T09:03:00Z",
                    type="UNKNOWN", source="synthetic-timeout",
                    evidenceRef="AR-DEMO-INST-001", description="No response")]
    result = asyncio.run(GoRulesClient().reconcile(payment, events))
    assert result.verdict == "REVIEW_REQUIRED"
    assert any(rule.id == "EVT-UNKNOWN" for rule in result.rules)
    assert result.safeToRetry is False and result.settlementAttested is False
