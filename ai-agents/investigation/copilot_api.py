"""Opt-in local API gateway for synthetic payment copilot; NOT bank production auth."""
from __future__ import annotations
import os
import secrets
import time
from collections import deque
from fastapi import APIRouter, Header, HTTPException, Request, Response
from .copilot import CopilotRequest, CopilotResponse, run_copilot, validate_request
from .event_queue import DemoEventQueue

router=APIRouter(prefix="/api/copilot/v1",tags=["synthetic-copilot"])
_job_queue: DemoEventQueue | None = None

async def start_demo_queue():
    """Explicit startup only. Not durable or distributed."""
    global _job_queue
    if _job_queue is not None:
        return
    _job_queue = DemoEventQueue(run_copilot,capacity=16)
    await _job_queue.start()

async def stop_demo_queue():
    global _job_queue
    if _job_queue is not None:
        await _job_queue.stop()
        _job_queue = None

_recent: deque[float]=deque()
# Instance-local throttle only; a production gateway needs tenant-scoped durable limits.

def gateway_auth(request: Request, authorization: str | None) -> None:
    if os.getenv("COPILOT_ENABLE_API","false").lower() != "true":
        raise HTTPException(status_code=404,detail="Synthetic copilot disabled")
    key=os.getenv("COPILOT_API_TOKEN","")
    if len(key)<32:
        raise HTTPException(status_code=503,detail="Local gateway token missing")
    if request.headers.get("Origin"):
        raise HTTPException(status_code=403,detail="Browser-origin calls are not allowed")
    if (not authorization or not authorization.startswith("Bearer ") or
        not secrets.compare_digest(authorization[7:],key)):
        raise HTTPException(status_code=401,detail="Invalid local gateway credentials")
    if int(request.headers.get("content-length","0") or "0")>53000:
        raise HTTPException(status_code=413,detail="Synthetic body too large")
    now=time.monotonic()
    while _recent and _recent[0]<now-60:
        _recent.popleft()
    if len(_recent)>=20:
        raise HTTPException(status_code=429,detail="Local demo capacity reached")
    _recent.append(now)

@router.post("/investigate",response_model=CopilotResponse)
async def copilot_investigate(request: Request, payload: CopilotRequest,
                            response: Response,
                            authorization: str | None = Header(default=None)):
    gateway_auth(request,authorization)
    response.headers["Cache-Control"]="no-store"
    response.headers["X-Content-Type-Options"]="nosniff"
    try:
        return await run_copilot(payload)
    except ValueError as exc:
        # Don't reflect user-provided payloads or raw payment content.
        raise HTTPException(status_code=422,detail="Rejected unsafe or invalid synthetic request") from exc
    except Exception as exc:
        raise HTTPException(status_code=503,detail="Local copilot unavailable") from exc

@router.post("/jobs",status_code=202)
async def submit_synthetic_job(request:Request,payload:CopilotRequest,
                              authorization:str | None = Header(default=None)):
    gateway_auth(request,authorization)
    if os.getenv("COPILOT_ENABLE_QUEUE","false").lower()!="true" or _job_queue is None:
        raise HTTPException(404,"In-process training job queue disabled")
    try:
        validate_request(payload)
        id=_job_queue.publish(payload)
        return {"id":id,"state":"QUEUED","synthetic":True,
                "durable":False,"human_review_required":True}
    except ValueError as exc:
        raise HTTPException(422,"Unsafe or non-synthetic request") from exc
    except (OverflowError,RuntimeError) as exc:
        raise HTTPException(503,"Local event worker unavailable") from exc

@router.get("/jobs/{job_id}")
async def synthetic_job_status(job_id:str,request:Request,
                               authorization:str | None = Header(default=None)):
    gateway_auth(request,authorization)
    if not job_id.startswith("AR-JOB-") or len(job_id)>45:
        raise HTTPException(422,"Invalid synthetic job reference")
    if os.getenv("COPILOT_ENABLE_QUEUE","false").lower()!="true" or _job_queue is None:
        raise HTTPException(404,"In-process training queue disabled")
    job=_job_queue.lookup(job_id)
    if job is None:
        raise HTTPException(404,"Job expired or not found")
    return {"id":job.id,"state":job.state,"synthetic":True,
            "durable":False,"human_review_required":True,
            "result":job.result if job.state=="DONE" else None,
            "error_code":job.error_code}
