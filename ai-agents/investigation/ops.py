"""Private, bounded observability of synthetic job processing.

Never labels metrics with payment IDs, tenant IDs, XML or model responses.
Metrics endpoint is disabled unless explicitly opted in with separate token.
"""
from __future__ import annotations
import hmac
import os
from fastapi import APIRouter,Header,HTTPException,Response
from prometheus_client import Counter,Histogram,generate_latest,CONTENT_TYPE_LATEST
from .pipeline_store import PipelineStore

router=APIRouter(prefix="/ops",tags=["internal-operations"])
JOB_EVENTS=Counter("addressrail_job_events_total",
                    "Fictional pipeline stage outcomes",
                    ["stage","outcome"])
JOB_DURATION=Histogram("addressrail_job_stage_seconds",
                      "Fictional pipeline processing duration",
                      ["stage"],buckets=(0.01,0.05,0.2,1,5,15,45,120))

def record(stage:str,outcome:str,elapsed:float):
    if stage not in ("validate","investigate","report") or outcome not in ("ok","error","replay"):
        raise ValueError("Unbounded metric label rejected")
    JOB_EVENTS.labels(stage=stage,outcome=outcome).inc()
    if outcome=="ok":
        JOB_DURATION.labels(stage=stage).observe(max(0,min(elapsed,120)))

def guard(authorization:str|None):
    if os.getenv("ADDRESSRAIL_METRICS_ENABLED")!="true":
        raise HTTPException(404,"Monitoring disabled")
    token=os.getenv("ADDRESSRAIL_METRICS_TOKEN","")
    if len(token)<32:
        raise HTTPException(503,"Monitoring token unavailable")
    if not authorization or not authorization.startswith("Bearer ") or not hmac.compare_digest(
        authorization[7:],token):
        raise HTTPException(401,"Monitoring credentials required")

@router.get("/metrics")
def metrics(authorization:str|None=Header(default=None)):
    guard(authorization)
    return Response(content=generate_latest(),media_type=CONTENT_TYPE_LATEST,
                    headers={"Cache-Control":"no-store"})

@router.get("/readiness")
def readiness(authorization:str|None=Header(default=None)):
    guard(authorization)
    try:
        database=PipelineStore()
        with database.connect() as db:
            check=db.execute("PRAGMA integrity_check").fetchone()[0]
        if check!="ok":
            raise RuntimeError("Local store failed integrity check")
    except Exception as exc:
        raise HTTPException(503,"Local synthetic store unavailable") from exc
    return {"state":"ready","store":"local-synthetic","not_a_bank_service":True}
