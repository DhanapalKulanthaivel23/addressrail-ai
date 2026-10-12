"""AddressRail Gemini backend tests - no external API calls or secrets required."""
import pytest
from fastapi.testclient import TestClient

from backend import app as module

client = TestClient(module.app)
REPORT = {
    "product": "AddressRail AI", "parties": [{
        "party": "Debtor",
        "address": {"town": "", "country": "", "lines": ["10 High Street, London, GB"]},
        "findings": [{"code": "TOWN_MISSING"}, {"code": "COUNTRY_MISSING"}],
    }],
}


@pytest.fixture(autouse=True)
def disabled_default(monkeypatch):
    monkeypatch.delenv("ENABLE_AI", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.delenv("TURNSTILE_SECRET_KEY", raising=False)
    monkeypatch.delenv("TURNSTILE_SITE_KEY", raising=False)
    module._usage.clear()
    module._total_calls[0] = 0


def test_health_and_config_disabled():
    assert client.get("/api/health").json()["status"] == "ok"
    config = client.get("/api/config").json()
    assert config["aiEnabled"] is False
    assert config["turnstileSiteKey"] == ""


def test_requires_synthetic_consent():
    resp = client.post("/api/ai-explain", json={"analysis": REPORT})
    assert resp.status_code == 422


def test_gemini_disabled_even_with_key_without_turnstile(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "fake-key")
    monkeypatch.setenv("ENABLE_AI", "true")
    resp = client.post("/api/ai-explain", json={"analysis": REPORT, "confirm_synthetic": True})
    assert resp.status_code == 503


def test_public_config_does_not_leak_secret(monkeypatch):
    monkeypatch.setenv("GEMINI_API_KEY", "super-private-test-key")
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "turnstile-secret-test")
    monkeypatch.setenv("TURNSTILE_SITE_KEY", "public-site-key")
    monkeypatch.setenv("ENABLE_AI", "true")
    body = client.get("/api/config").text
    assert '"aiEnabled":true' in body
    assert "public-site-key" in body
    assert "super-private-test-key" not in body
    assert "turnstile-secret-test" not in body


def test_excerpt_sends_no_original_xml_or_customer_name():
    report = dict(REPORT, raw="<Document>secret banking data</Document>")
    excerpt = module.make_excerpt(report)
    content = str(excerpt)
    assert "secret banking data" not in content
    assert "London" in content
    assert "TOWN_MISSING" in content


def test_enabled_requires_human_token(monkeypatch):
    monkeypatch.setenv("ENABLE_AI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy")
    monkeypatch.setenv("TURNSTILE_SITE_KEY", "dummy")
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "dummy")
    resp = client.post("/api/ai-explain", json={"analysis": REPORT, "confirm_synthetic": True})
    assert resp.status_code == 403


def test_valid_human_token_mocked_gemini(monkeypatch):
    monkeypatch.setenv("ENABLE_AI", "true")
    monkeypatch.setenv("GEMINI_API_KEY", "dummy")
    monkeypatch.setenv("TURNSTILE_SITE_KEY", "dummy")
    monkeypatch.setenv("TURNSTILE_SECRET_KEY", "dummy")

    async def verified(token, host):
        assert token == "fake-token"

    async def generated(excerpt):
        assert excerpt[0]["address_lines"][0].endswith("GB")
        return {"model": "gemini-3.1-flash-lite", "advice": {"summary": "Review manually"}}

    monkeypatch.setattr(module, "verify_turnstile", verified)
    monkeypatch.setattr(module, "ask_gemini", generated)
    resp = client.post("/api/ai-explain", json={
        "analysis": REPORT, "confirm_synthetic": True, "turnstile_token": "fake-token",
    })
    assert resp.status_code == 200
    assert resp.json()["advice"]["summary"] == "Review manually"
    assert resp.headers["cache-control"] == "no-store"


def test_process_quota(monkeypatch):
    monkeypatch.setenv("MAX_AI_CALLS_PROCESS", "1")
    module.consume_quota("127.0.0.1")
    with pytest.raises(module.HTTPException) as ex:
        module.consume_quota("127.0.0.1")
    assert ex.value.status_code == 429
