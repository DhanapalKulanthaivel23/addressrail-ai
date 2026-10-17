"""Opt-in local Kafka submission and downloadable synthetic case report API."""
from __future__ import annotations
import os
from fastapi import APIRouter,Header,HTTPException,Request,Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel,ConfigDict,Field
from typing import Literal
from .copilot import CopilotRequest,validate_request
from .copilot_api import gateway_auth
from .pipeline_store import PipelineStore,JobConflict
from .kafka_bus import KafkaBus, TOPICS

router=APIRouter(prefix="/api/pipeline/v1",tags=["synthetic-kafka-pipeline"])
class Submit(BaseModel):
    model_config=ConfigDict(extra="forbid")
    payment_id: str=Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    question: str=Field(min_length=5,max_length=360)
    synthetic_xml: str=Field(min_length=40,max_length=48000)
    simulated_status: Literal["RJCT","PENDING","UNKNOWN"]="RJCT"

def enabled():
    if os.getenv("ADDRESSRAIL_ENABLE_KAFKA_PIPELINE","false").lower()!="true":
        raise HTTPException(404,"Local Kafka pipeline disabled")

@router.post("/submissions",status_code=202)
async def submit(request:Request,body:Submit,response:Response,
                 authorization:str|None=Header(default=None),
                 idempotency_key:str|None=Header(default=None)):
    enabled()
    gateway_auth(request,authorization)
    try:
        if not idempotency_key:raise ValueError("Idempotency-Key required")
        req=CopilotRequest.model_validate(body.model_dump())
        validate_request(req)
        if "<Document" not in body.synthetic_xml or "pacs.008" not in body.synthetic_xml:
            raise ValueError("Only fictional ISO 20022 pacs.008 training documents")
        content=body.model_dump()
        store=PipelineStore()
        id,created=store.begin(idempotency_key,content)
    except (ValueError,JobConflict) as exc:
        raise HTTPException(409 if isinstance(exc,JobConflict) else 422,
             "Invalid synthetic input or idempotency conflict") from exc
    if created or store.read(id)["state"]=="PUBLISH_FAILED":
        try:
            bus=KafkaBus()
            try:
                bus.send(TOPICS["submitted"],id,{"version":1,"synthetic":True,
                    "job_id":id,**content})
            finally:
                bus.close()
            store.state(id,"QUEUED")
        except Exception as exc:
            store.state(id,"PUBLISH_FAILED")
            raise HTTPException(503,"Local Kafka broker unavailable; use same Idempotency-Key to retry") from exc
    response.headers["Cache-Control"]="no-store"
    return {"job_id":id,"state":store.read(id)["state"],
            "created":created,"synthetic":True,"broker":"kafka"}

@router.get("/submissions/{job_id}")
async def status(request:Request,job_id:str,
                 authorization:str|None=Header(default=None)):
    enabled();gateway_auth(request,authorization)
    result=PipelineStore().read(job_id)
    if result is None:raise HTTPException(404,"Unknown synthetic job")
    return {"job_id":result["id"],"state":result["state"],
        "report_available":result["report"] is not None,
        "synthetic":True}

@router.get("/submissions/{job_id}/report")
async def report(request:Request,job_id:str,
                 authorization:str|None=Header(default=None)):
    enabled();gateway_auth(request,authorization)
    result=PipelineStore().read(job_id)
    if result is None:raise HTTPException(404,"Unknown synthetic job")
    if result["report"] is None:
        raise HTTPException(409,"Report not yet available")
    response=JSONResponse(result["report"],headers={
       "Content-Disposition":f'attachment; filename="addressrail-{job_id}.json"',
       "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"})
    return response
