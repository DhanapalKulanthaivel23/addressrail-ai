"""Training case proxy tests; offline and with no credentials."""
from unittest.mock import patch
from fastapi.testclient import TestClient
from investigation.app import app
from investigation.tools import CoreUnavailable

client=TestClient(app)
CASE={"trainingCase":{"id":"CASE-TEST","paymentId":"PAY-10001","state":"OPEN",
    "ownerAlias":"TRAINING-Analyst1","version":0},
    "history":[{"action":"OPENED","actorAlias":"TRAINING-Analyst1","note":"Synthetic only"}]}
def test_training_workflow_read():
    async def response(self,path,payload=None):
        assert path.endswith("/by-payment/PAY-10001") and payload is None
        return CASE
    with patch("investigation.app.PaymentTools.training_case_request",response):
        r=client.get("/api/dashboard/workflow/PAY-10001")
    assert r.status_code==200 and r.json()["trainingCase"]["state"]=="OPEN"

def test_training_case_open_and_write():
    async def response(self,path,payload=None):
        assert payload["actorAlias"]=="TRAINING-Analyst1"
        return CASE
    with patch("investigation.app.PaymentTools.training_case_request",response):
        r=client.post("/api/dashboard/workflow",json={
          "paymentId":"PAY-10001","actorAlias":"TRAINING-Analyst1"})
    assert r.status_code==200

def test_notes_and_transition():
    async def response(self,path,payload=None):
        assert path.startswith("/api/v1/labs/investigation-cases/CASE-TEST/")
        return CASE
    with patch("investigation.app.PaymentTools.training_case_request",response):
        assert client.post("/api/dashboard/workflow/CASE-TEST/notes",json={
            "actorAlias":"TRAINING-Analyst1","note":"Verified fictional event evidence"}).status_code==200
        assert client.post("/api/dashboard/workflow/CASE-TEST/transition",json={
            "actorAlias":"TRAINING-Analyst1","ownerAlias":"TRAINING-Team2",
            "state":"IN_REVIEW","note":"Escalate mock case","expectedVersion":0}).status_code==200

def test_insecure_actor_or_missing_note_rejected():
    assert client.post("/api/dashboard/workflow",json={
        "paymentId":"PAY-10001","actorAlias":"real.person"}).status_code==422
    assert client.post("/api/dashboard/workflow/CASE-TEST/notes",json={
        "actorAlias":"TRAINING-Analyst1","note":""}).status_code==422

def test_read_only_payment_endpoint_and_ui_has_no_html_injection():
    text=client.get("/dashboard.js").text
    assert "workflowPost" in text and "trainingCase" in text
    assert ".innerHTML" not in text
    assert "fetch(\"/api/dashboard/workflow" in text

def test_unavailable_training_service_safe_response():
    async def unavailable(self,path,payload=None):
        raise CoreUnavailable()
    with patch("investigation.app.PaymentTools.training_case_request",unavailable):
        r=client.get("/api/dashboard/workflow/PAY-10001")
    assert r.status_code==503 and "Local case management" in r.json()["detail"]
