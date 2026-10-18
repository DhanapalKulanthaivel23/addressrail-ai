"""Encryption, integrity and authenticated operations endpoint acceptance."""
from cryptography.fernet import Fernet, InvalidToken
from fastapi.testclient import TestClient
import pytest
from investigation.app import app
from investigation.pipeline_store import PipelineStore
from investigation.recovery import backup,restore
from investigation.ops import record

def test_encrypted_snapshot_restores_a_completed_immutable_report(tmp_path):
    old=tmp_path/"jobs.db"
    db=PipelineStore(str(old))
    job,_=db.begin("UNIQUE-SYNTHETIC-JOB-100",
        {"payment_id":"PAY-TEST-001","synthetic":True})
    db.complete(job,{"job_id":job,"synthetic":True,"settlement_attested":False,
                     "safe_to_retry":False,"case_id":"CASE-LOCAL-DEMO-001"})
    key=Fernet.generate_key()
    sealed=tmp_path/"snapshot.fnet"
    result=backup(str(old),str(sealed),key)
    assert result["encrypted"] is True
    assert b"CASE-LOCAL-DEMO-001" not in sealed.read_bytes()
    with pytest.raises(FileExistsError):
        backup(str(old),str(sealed),key)
    new=tmp_path/"restored.db"
    assert restore(str(sealed),str(new),key)["restored"] is True
    assert PipelineStore(str(new)).read(job)["report"]["case_id"]=="CASE-LOCAL-DEMO-001"
    with pytest.raises(FileExistsError):
        restore(str(sealed),str(new),key)
    with pytest.raises(InvalidToken):
        restore(str(sealed),str(tmp_path/"wrong.db"),Fernet.generate_key())
    blob=sealed.read_bytes()
    sealed.write_bytes(blob[:-20]+b"X"*20)
    with pytest.raises(InvalidToken):
        restore(str(sealed),str(tmp_path/"tampered.db"),key)
    assert not (tmp_path/"tampered.db").exists()

def test_ops_metrics_private_and_bounded(monkeypatch,tmp_path):
    monkeypatch.setenv("PIPELINE_DB_PATH",str(tmp_path/"local.db"))
    token="OPS-"+"a"*40
    with TestClient(app) as client:
        assert client.get("/ops/metrics").status_code==404
        monkeypatch.setenv("ADDRESSRAIL_METRICS_ENABLED","true")
        assert client.get("/ops/metrics").status_code==503
        monkeypatch.setenv("ADDRESSRAIL_METRICS_TOKEN",token)
        assert client.get("/ops/metrics").status_code==401
        record("validate","ok",0.03)
        record("investigate","error",0)
        headers={"Authorization":"Bearer "+token}
        metrics=client.get("/ops/metrics",headers=headers)
        assert metrics.status_code==200
        assert "addressrail_job_events_total" in metrics.text
        assert "addressrail_job_stage_seconds" in metrics.text
        assert client.get("/ops/readiness",headers=headers).json()["state"]=="ready"
        assert client.get("/ops/metrics",headers={"Authorization":"Bearer "+"b"*40}).status_code==401
    with pytest.raises(ValueError):
        record("PAY-ACCOUNT-NUMBER","ok",1)
