"""Offline Gemini output evaluation: no key or network needed."""
import asyncio
import json
from unittest.mock import patch
import httpx
from investigation.llm import validate_advisory, gemini_explanation
from investigation.models import InvestigationResult, Finding

BASE = InvestigationResult(
    payment_id="PAY-10001", outcome="EVIDENCE_FOUND", payment_status="RJCT",
    last_event_type="RJCT",
    finding=Finding(status="RJCT", explanation="Synthetic rejection AC01",
                    recommended_action="Human verification required",
                    evidence_refs=["DEMO-EVT-004"]))
GOOD = {
    "payment_status": "RJCT",
    "evidence_refs": ["DEMO-EVT-004"],
    "explanation": "The synthetic payment has a recorded rejection. An authorised operator should review it.",
    "human_review_required": True,
}

def test_valid_advisory():
    assert validate_advisory(GOOD, BASE) == GOOD["explanation"]

def test_fabricated_status_is_rejected():
    assert validate_advisory({**GOOD, "payment_status": "ACSP"}, BASE) is None

def test_fabricated_reference_is_rejected():
    assert validate_advisory({**GOOD, "evidence_refs": ["MADE-UP"]}, BASE) is None

def test_no_human_review_is_rejected():
    assert validate_advisory({**GOOD, "human_review_required": False}, BASE) is None

def test_unsubstantiated_settlement_claim_is_rejected():
    assert validate_advisory({**GOOD, "explanation": "The payment was settled and credited to the beneficiary."}, BASE) is None

def test_extra_unexpected_output_field_is_rejected():
    assert validate_advisory({**GOOD, "bank_approved": True}, BASE) is None

def test_not_evidence_found_is_not_sent():
    conflicting = BASE.model_copy(update={"outcome": "INSUFFICIENT_EVIDENCE"})
    assert validate_advisory(GOOD, conflicting) is None

def test_api_disabled_without_feature_switch(monkeypatch):
    monkeypatch.delenv("INVESTIGATION_ENABLE_GEMINI", raising=False)
    assert asyncio.run(gemini_explanation(BASE)) is None

def test_missing_key_falls_back(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    assert asyncio.run(gemini_explanation(BASE)) is None

def test_mocked_gemini_valid_json(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    def make_client(*args, **kwargs):
        return original(*args, transport=httpx.MockTransport(
            lambda req: httpx.Response(200, json={"candidates":[{"content":{"parts":[{"text": json.dumps(GOOD)}]}}]})
        ), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=make_client):
        assert asyncio.run(gemini_explanation(BASE)) == GOOD["explanation"]

def test_mocked_gemini_invalid_json_falls_back(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    def make_client(*args, **kwargs):
        return original(*args, transport=httpx.MockTransport(
            lambda req: httpx.Response(200, json={"candidates":[{"content":{"parts":[{"text": "not JSON"}]}}]})
        ), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=make_client):
        assert asyncio.run(gemini_explanation(BASE)) is None
