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
            lambda req: httpx.Response(200, json={"candidates":[{"finishReason":"STOP","content":{"parts":[{"text": json.dumps(GOOD)}]}}]})
        ), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=make_client):
        assert asyncio.run(gemini_explanation(BASE)) == GOOD["explanation"]

def test_mocked_gemini_invalid_json_falls_back(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    def make_client(*args, **kwargs):
        return original(*args, transport=httpx.MockTransport(
            lambda req: httpx.Response(200, json={"candidates":[{"finishReason":"STOP","content":{"parts":[{"text": "not JSON"}]}}]})
        ), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=make_client):
        assert asyncio.run(gemini_explanation(BASE)) is None

def _mock_gemini_response(monkeypatch, candidate):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    captured = []
    def client(*args, **kwargs):
        def handle(request):
            body = json.loads(request.content)
            config = body["generationConfig"]
            captured.append(config)
            return httpx.Response(200, json={"candidates": [candidate]})
        return original(*args, transport=httpx.MockTransport(handle), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=client):
        output = asyncio.run(gemini_explanation(BASE))
    return output, captured[0]

def test_explicit_json_schema_and_larger_budget(monkeypatch):
    outcome, config = _mock_gemini_response(monkeypatch, {
        "finishReason": "STOP", "content": {"parts": [{"text": json.dumps(GOOD)}]}})
    assert outcome == GOOD["explanation"]
    assert config["responseMimeType"] == "application/json"
    assert config["responseSchema"]["required"] == list(GOOD)
    assert config["maxOutputTokens"] >= 1024

def test_truncated_model_output_is_not_parsed(monkeypatch, caplog):
    output, _ = _mock_gemini_response(monkeypatch, {
        "finishReason": "MAX_TOKENS", "content": {"parts": [{"text": '{"payment_status":"RJCT"'}]}})
    assert output is None
    assert "finish_MAX_TOKENS" in caplog.text

def test_blocked_response_falls_back(monkeypatch):
    outcome, _ = _mock_gemini_response(monkeypatch, {
        "finishReason": "SAFETY", "content": {"parts": []}})
    assert outcome is None

def test_empty_stop_response_falls_back(monkeypatch, caplog):
    outcome, _ = _mock_gemini_response(monkeypatch, {
        "finishReason": "STOP", "content": {"parts": []}})
    assert outcome is None
    assert "empty_output" in caplog.text

def test_multiple_text_parts_are_combined(monkeypatch):
    raw = json.dumps(GOOD)
    midpoint = len(raw) // 2
    outcome, _ = _mock_gemini_response(monkeypatch, {
        "finishReason": "STOP", "content": {"parts": [{"text": raw[:midpoint]}, {"text": raw[midpoint:]}]}})
    assert outcome == GOOD["explanation"]

def test_invalid_evidence_still_fails_even_if_json_valid(monkeypatch):
    outcome, _ = _mock_gemini_response(monkeypatch, {
        "finishReason": "STOP", "content": {"parts": [{"text": json.dumps({**GOOD, "payment_status": "ACSP"})}]}})
    assert outcome is None

def test_pending_and_unknown_advisories_supported_without_change_to_evidence(monkeypatch):
    for status in ("PENDING", "UNKNOWN", "ACTC", "ACSC", "SIMULATED"):
        case = BASE.model_copy(update={
            "payment_status": status,
            "last_event_type": status,
            "finding": Finding(status=status, explanation="Synthetic lab evidence",
                               recommended_action="Human review required",
                               evidence_refs=["DEMO-EVT-004"])
        })
        valid = {**GOOD, "payment_status": status,
                 "explanation": "The synthetic record has status "+status+"; seek authoritative evidence before taking action."}
        assert validate_advisory(valid, case) == valid["explanation"]
        assert validate_advisory({**valid, "payment_status": "RJCT"}, case) is None

def test_http_503_once_then_valid_response(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    calls = []
    def client(*args, **kwargs):
        def handle(request):
            calls.append(request)
            if len(calls) == 1:
                return httpx.Response(503, text="unavailable")
            return httpx.Response(200, json={"candidates":[{"finishReason":"STOP",
                "content":{"parts":[{"text":json.dumps(GOOD)}]}}]})
        return original(*args, transport=httpx.MockTransport(handle), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=client):
        with patch("investigation.llm.asyncio.sleep", return_value=None):
            answer = asyncio.run(gemini_explanation(BASE))
    assert answer == GOOD["explanation"]
    assert len(calls) == 2

def test_two_503s_fall_back_without_excess_requests(monkeypatch, caplog):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    attempts = []
    def client(*args, **kwargs):
        def handle(request):
            attempts.append(request)
            return httpx.Response(503, text="unavailable")
        return original(*args, transport=httpx.MockTransport(handle), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=client):
        with patch("investigation.llm.asyncio.sleep", return_value=None):
            assert asyncio.run(gemini_explanation(BASE)) is None
    assert len(attempts) == 2
    assert "http_status_503" in caplog.text
    assert "unavailable" not in caplog.text

def test_http_429_never_retried(monkeypatch):
    monkeypatch.setenv("INVESTIGATION_ENABLE_GEMINI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy-test-key")
    original = httpx.AsyncClient
    calls = []
    def client(*args, **kwargs):
        def handle(request):
            calls.append(1)
            return httpx.Response(429, text="quota")
        return original(*args, transport=httpx.MockTransport(handle), **kwargs)
    with patch("investigation.llm.httpx.AsyncClient", side_effect=client):
        assert asyncio.run(gemini_explanation(BASE)) is None
    assert len(calls) == 1

def test_unknown_ai_must_not_claim_settlement():
    case = BASE.model_copy(update={"payment_status":"UNKNOWN", "last_event_type":"UNKNOWN",
        "finding":Finding(status="UNKNOWN", evidence_refs=["DEMO-EVT-004"],
            explanation="Missing response", recommended_action="Reconcile")})
    assert validate_advisory({**GOOD,"payment_status":"UNKNOWN",
        "explanation":"The payment was settled and credited to the beneficiary."},case) is None
