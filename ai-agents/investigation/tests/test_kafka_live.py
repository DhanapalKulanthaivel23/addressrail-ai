"""True broker + Go + Java + Python synthetic integration when explicit opt-in."""
import os
import json
from pathlib import Path
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from investigation.app import app
from investigation.pipeline_store import PipelineStore
from investigation.kafka_workers import run_role
from investigation.kafka_bus import create_topics

pytestmark=pytest.mark.skipif(os.getenv("ADDRESSRAIL_LIVE_KAFKA_TEST")!="true",
                             reason="requires real localhost Kafka, Go and Java")

XML='''<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-LIVE-KAFKA</MsgId></GrpHdr>
<CdtTrfTxInf><IntrBkSttlmAmt Ccy="EUR">125.00</IntrBkSttlmAmt>
<Dbtr><Nm>SYNTHETIC BANK A</Nm></Dbtr></CdtTrfTxInf></FIToFICstmrCdtTrf>
</Document>'''

def test_real_kafka_three_stages_and_report_download():
    create_topics()
    token=os.environ["COPILOT_API_TOKEN"]
    headers={"Authorization":"Bearer "+token,
             "Idempotency-Key":"LIVE-"+uuid4().hex[:18]}
    payment_id="PAY-KAFKA-"+uuid4().hex[:16]
    with TestClient(app) as client:
        submission=client.post("/api/pipeline/v1/submissions",json={
           "payment_id":payment_id,"simulated_status":"RJCT",
           "question":"Explain CBPR+ synthetic pacs.008 rejection and Swift status evidence",
           "synthetic_xml":XML},headers=headers)
        assert submission.status_code==202,submission.text
        id=submission.json()["job_id"]
        assert run_role("validate",stop_after=1)==1
        assert run_role("investigate",stop_after=1)==1
        assert run_role("report",stop_after=1)==1
        status=client.get(f"/api/pipeline/v1/submissions/{id}",headers=headers)
        assert status.status_code==200 and status.json()["state"]=="COMPLETED"
        file=client.get(f"/api/pipeline/v1/submissions/{id}/report",headers=headers)
        assert file.status_code==200
        report=file.json()
        assert report["job_id"]==id
        assert report["payment_id"]==payment_id
        assert report["investigation"]["payment_id"]==payment_id
        assert report["synthetic"] and not report["settlement_attested"]
        assert not report["safe_to_retry"]
        assert report["case_id"].startswith("CASE-")
        assert report["investigation"]["outcome"]=="EVIDENCE_FOUND"
        assert report["validation"]["validator"]=="addressrail-go-educational-v1"
        assert report["investigation"]["ai_used"] is False  # No real Gemini key
        assert "SYNTHETIC BANK A" not in file.text
        # CI publishes an inspectable fictional report only after the full chain succeeds.
        report_path=Path(os.getenv("ADDRESSRAIL_CI_REPORT","/tmp/addressrail-kafka-e2e-report.json"))
        report_path.write_text(json.dumps(report,indent=2,sort_keys=True)+"\n",encoding="utf8")
