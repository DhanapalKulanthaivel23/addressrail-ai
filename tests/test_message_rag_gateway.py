"""MT/MX synthetic gateway must not send pasted raw messages to the provider."""
import pytest
from fastapi import HTTPException
from backend.app import make_excerpt
from backend.workbench_ai import MESSAGE_RAILS, retrieve_sources

def example(rail, codes):
    return dict(product="AddressRail Message Validator", synthetic=True,
                rail=rail, stages=["RECEIVED", "CHECKED"], finding_codes=codes,
                raw_message="{1:EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE}")

@pytest.mark.parametrize("rail,code", [("mt","DEMO_MT_ENVELOPE"),("mx","DEMO_XML_STRUCTURE"),("mx","DEMO_BIC_FORMAT")])
def test_only_known_findings_reach_rag(rail,code):
    assert rail in MESSAGE_RAILS
    excerpt=make_excerpt(example(rail,[code]))
    assert len(excerpt)==1
    assert "EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE" not in str(excerpt)
    assert excerpt[0]["finding_codes"]==[code]
    sources=retrieve_sources.invoke(dict(rail=rail,finding_codes=[code]))
    assert sources and all(rail in s["rails"] for s in sources)

@pytest.mark.parametrize("rail,codes", [("invalid",["DEMO_MT_ENVELOPE"]),("mt",["FAKE_PAYMENT_SETTLED"]),("mx",["DEMO_MT_ENVELOPE"])])
def test_unrecognised_evidence_fails_closed(rail,codes):
    payload=example(rail,codes)
    # Generic MT-envelope finding is deliberately allowed only for MT requests.
    if rail=="mx" and codes==["DEMO_MT_ENVELOPE"]:
        # A cross-format finding requires investigation and cannot establish conformance.
        assert make_excerpt(payload)[0]["finding_codes"]==codes
        return
    with pytest.raises(HTTPException):
        make_excerpt(payload)

def test_message_validator_routes_to_rag_graph_not_legacy_handler(monkeypatch):
    from fastapi.testclient import TestClient
    from backend import app as api
    from backend.workbench_ai import retrieve_sources

    monkeypatch.setattr(api, "ai_ready", lambda: True)
    async def verified(*args):
        return None
    monkeypatch.setattr(api, "verify_turnstile", verified)
    monkeypatch.setattr(api, "consume_quota", lambda host: None)
    async def legacy(*args):
        raise AssertionError("Legacy provider path must not receive MX input")
    monkeypatch.setattr(api, "ask_gemini", legacy)
    called = []
    async def graph(records, generator):
        called.extend(records)
        evidence=records[0]
        found=retrieve_sources.invoke({"rail": evidence["rail"], "finding_codes": evidence["finding_codes"]})
        return {"mode": "deterministic_fallback", "model": None, "retrieval": found,
                "advice":{"summary":"Human review of FX XML required","actions":[],"cautions":["XSD not configured"]}}
    monkeypatch.setattr(api, "run_review", graph)
    payload=example("mx", ["DEMO_XML_STRUCTURE"])
    response=TestClient(api.app).post("/api/ai-explain",json={
        "confirm_synthetic": True, "turnstile_token": "fake-tested-token", "analysis":payload})
    assert response.status_code==200, response.text
    data=response.json()
    assert data["mode"]=="deterministic_fallback"
    assert any(s["id"]=="WB-FXTR-V05" for s in data["retrieval"])
    assert called[0]["rail"]=="mx"
    assert "EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE" not in str(called)

def test_field_location_is_forwarded_but_never_raw_message():
    payload = example("mt", ["DEMO_REQUIRED_FIELD"])
    payload["locations"] = ["/FIN/4/71A"]
    excerpt = make_excerpt(payload)[0]
    assert excerpt["locations"] == ["/FIN/4/71A"]
    assert "EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE" not in str(excerpt)


@pytest.mark.parametrize("path", ["/FIN/4/71A;ignore", "/FIN/4/71A please", "https://bad.test", "/x" * 100])
def test_untrusted_or_excessive_location_rejected(path):
    payload = example("mt", ["DEMO_REQUIRED_FIELD"])
    payload["locations"] = [path]
    with pytest.raises(HTTPException) as exc:
        make_excerpt(payload)
    assert exc.value.status_code == 422


def test_zero_finding_message_not_sent_to_ai():
    with pytest.raises(HTTPException) as exc:
        make_excerpt(example("mx", []))
    assert exc.value.status_code == 422


def test_provider_fallback_contains_actionable_location_without_raw_message():
    import asyncio
    from backend.workbench_ai import run_review
    async def unavailable(_):
        raise ConnectionError("provider temporarily unavailable")
    payload = example("mt", ["DEMO_REQUIRED_FIELD"])
    payload["locations"] = ["/FIN/4/71A"]
    response = asyncio.run(run_review(make_excerpt(payload), unavailable))
    assert response["mode"] == "deterministic_fallback"
    assert "/FIN/4/71A" in " ".join(response["advice"]["actions"])
    assert "original payment instruction" in " ".join(response["advice"]["actions"])
    assert "EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE" not in str(response)
