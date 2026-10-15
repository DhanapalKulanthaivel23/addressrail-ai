"""Offline tests for the local unified investigation dashboard. No network or Gemini key."""
from fastapi.testclient import TestClient
from investigation.app import app
from investigation.tools import CoreUnavailable, PaymentNotFound
from investigation.models import Payment, Event
from unittest.mock import patch

client=TestClient(app)

PAYMENT={"id":"CHAPS-TEST","status":"PENDING","synthetic":True,"scheme":"CHAPS synthetic",
         "messageType":"pacs.008","amount":250000.0,"currency":"GBP",
         "debtorAgent":"SYNTHETIC A","creditorAgent":"SYNTHETIC B"}
EVENT={"id":1,"paymentId":"CHAPS-TEST","occurredAt":"2026-10-15T09:00:00Z",
       "type":"PENDING","source":"synthetic-liquidity","evidenceRef":"CHAPS-TEST-E4",
       "description":"Synthetic liquidity hold"}

def test_dashboard_and_script_load_without_external_network():
    page=client.get("/dashboard")
    assert page.status_code==200
    assert "Unified Payment Investigation" in page.text
    assert "same-origin" not in page.text or "localhost" not in page.text
    script=client.get("/dashboard.js")
    assert script.status_code==200
    assert '"/investigate"' in script.text
    assert ".innerHTML" not in script.text
    assert "GEMINI_API_KEY" not in page.text + script.text

def test_case_catalogue_filters_non_synthetic_rows():
    async def listing(self,status=None,limit=40):
        assert status=="PENDING" and limit==5
        return [{**PAYMENT,"paymentId":"CHAPS-TEST"}]
    with patch("investigation.app.PaymentTools.list_synthetic_cases",listing):
        response=client.get("/api/dashboard/cases?status=PENDING&limit=5")
    assert response.status_code==200
    assert response.json()[0]["paymentId"]=="CHAPS-TEST"

def test_case_catalogue_rejects_invalid_filters_without_backend_call():
    assert client.get("/api/dashboard/cases?status=DROP%20TABLE").status_code==422
    assert client.get("/api/dashboard/cases?limit=101").status_code==422

def test_case_detail_returns_synthetic_evidence():
    async def payment(self,id):
        return Payment.model_validate(PAYMENT)
    async def events(self,id):
        return [Event.model_validate(EVENT)]
    with patch("investigation.app.PaymentTools.get_payment_status",payment), \
         patch("investigation.app.PaymentTools.get_payment_history",events):
        response=client.get("/api/dashboard/cases/CHAPS-TEST")
    assert response.status_code==200
    assert response.json()["events"][0]["evidenceRef"]=="CHAPS-TEST-E4"

def test_case_detail_refuses_non_synthetic_evidence():
    async def payment(self,id):
        return Payment.model_validate({**PAYMENT,"synthetic":False})
    with patch("investigation.app.PaymentTools.get_payment_status",payment):
        assert client.get("/api/dashboard/cases/CHAPS-TEST").status_code==404

def test_case_detail_rejects_mismatched_event_evidence():
    async def payment(self,id):
        return Payment.model_validate(PAYMENT)
    async def events(self,id):
        return [Event.model_validate({**EVENT,"paymentId":"OTHER"})]
    with patch("investigation.app.PaymentTools.get_payment_status",payment), \
         patch("investigation.app.PaymentTools.get_payment_history",events):
        assert client.get("/api/dashboard/cases/CHAPS-TEST").status_code==503

def test_case_detail_bad_id_and_unavailable_upstream():
    assert client.get("/api/dashboard/cases/ABC!").status_code==422
    async def payment(self,id):
        raise CoreUnavailable()
    with patch("investigation.app.PaymentTools.get_payment_status",payment):
        assert client.get("/api/dashboard/cases/CHAPS-TEST").status_code==503

def test_unavailable_catalogue_has_safe_error():
    async def listing(self,status=None,limit=40):
        raise CoreUnavailable()
    with patch("investigation.app.PaymentTools.list_synthetic_cases",listing):
        result=client.get("/api/dashboard/cases")
    assert result.status_code==503
    assert "Local Payment Core" in result.json()["detail"]
