"""Local synthetic investigation lab API. No CORS; do not expose publicly."""
from contextlib import asynccontextmanager
from pathlib import Path as FilePath
from fastapi import FastAPI, HTTPException, Query, Path
from pydantic import BaseModel, Field
from typing import Literal
from fastapi.responses import FileResponse
from .agent import investigate
from .models import InvestigationRequest, InvestigationResult
from .tools import PaymentTools, PaymentNotFound, CoreUnavailable
from .copilot_api import router as copilot_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app=FastAPI(title="AddressRail AI Investigation Lab (Synthetic)", version="0.2.0", lifespan=lifespan)
app.include_router(copilot_router)

@app.get("/health")
def health():
    return {"status":"ok","mode":"synthetic-only"}

@app.get("/dashboard", include_in_schema=False)
async def dashboard():
    """Static local UI; no credentials or server-side templates."""
    return FileResponse(FilePath(__file__).parent / "dashboard.html",
                        media_type="text/html", headers={"Cache-Control":"no-store"})

@app.get("/dashboard.js", include_in_schema=False)
async def dashboard_script():
    return FileResponse(FilePath(__file__).parent / "dashboard.js",
                        media_type="text/javascript", headers={"Cache-Control":"no-store"})

@app.get("/api/dashboard/cases")
async def cases(status: str | None = Query(default=None, pattern=r"^[A-Z_]{2,40}$"),
                limit: int = Query(default=40, ge=1, le=100)):
    try:
        return await PaymentTools().list_synthetic_cases(status=status, limit=limit)
    except (CoreUnavailable, PaymentNotFound, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Local Payment Core catalogue unavailable") from exc

@app.get("/api/dashboard/cases/{payment_id}")
async def case_detail(payment_id: str):
    if not 1 <= len(payment_id) <= 80 or not all(c.isascii() and
             (c.isalnum() or c in "_-") for c in payment_id):
        raise HTTPException(status_code=422, detail="Invalid synthetic payment ID")
    tools=PaymentTools()
    try:
        payment=await tools.get_payment_status(payment_id)
        if not payment.synthetic or payment.id != payment_id:
            raise HTTPException(status_code=404, detail="Synthetic case not found")
        events=await tools.get_payment_history(payment_id)
        if any(e.paymentId != payment_id for e in events):
            raise HTTPException(status_code=503, detail="Evidence mismatch")
        return {"payment":payment, "events":events,
                "limitation":"Synthetic and read-only. Not verified by any payment scheme."}
    except PaymentNotFound as exc:
        raise HTTPException(status_code=404, detail="Synthetic case not found") from exc
    except (CoreUnavailable, ValueError) as exc:
        raise HTTPException(status_code=503, detail="Payment Core evidence unavailable") from exc

@app.post("/investigate", response_model=InvestigationResult)
async def investigate_payment(request: InvestigationRequest):
    try:
        return await investigate(request.payment_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Investigation temporarily unavailable") from exc

# Local training workflow only: these aliases are labels, NOT authenticated identities.
class OpenTrainingCase(BaseModel):
    paymentId: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    actorAlias: str = Field(pattern=r"^TRAINING-[A-Za-z0-9_-]{2,48}$")

class TrainingNote(BaseModel):
    actorAlias: str = Field(pattern=r"^TRAINING-[A-Za-z0-9_-]{2,48}$")
    note: str = Field(min_length=1, max_length=500)

class TrainingTransition(TrainingNote):
    state: Literal["OPEN", "IN_REVIEW", "ESCALATED", "CLOSED"]
    ownerAlias: str = Field(pattern=r"^TRAINING-[A-Za-z0-9_-]{2,48}$")
    expectedVersion: int = Field(ge=0)

async def _training_call(path: str, payload: dict | None = None):
    try:
        result=await PaymentTools().training_case_request(path,payload)
        if result.get("error") in (400,409):
            raise HTTPException(status_code=result["error"],detail="Training workflow request rejected")
        return result
    except PaymentNotFound as exc:
        raise HTTPException(status_code=404,detail="Training case not found") from exc
    except CoreUnavailable as exc:
        raise HTTPException(status_code=503,detail="Local case management unavailable") from exc

@app.get("/api/dashboard/workflow/{payment_id}")
async def workflow_for_payment(payment_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,80}$")):
    return await _training_call("/api/v1/labs/investigation-cases/by-payment/"+payment_id)

@app.post("/api/dashboard/workflow")
async def open_training_workflow(request: OpenTrainingCase):
    return await _training_call("/api/v1/labs/investigation-cases",request.model_dump())

@app.post("/api/dashboard/workflow/{case_id}/notes")
async def training_note(case_id: str,request: TrainingNote):
    if not (case_id.startswith("CASE-") and len(case_id)<=80 and all(c.isascii() and (c.isalnum() or c in "_-") for c in case_id)):
        raise HTTPException(status_code=422,detail="Invalid training case identifier")
    return await _training_call("/api/v1/labs/investigation-cases/"+case_id+"/notes",request.model_dump())

@app.post("/api/dashboard/workflow/{case_id}/transition")
async def training_transition(case_id: str,request: TrainingTransition):
    if not (case_id.startswith("CASE-") and len(case_id)<=80 and all(c.isascii() and (c.isalnum() or c in "_-") for c in case_id)):
        raise HTTPException(status_code=422,detail="Invalid training case identifier")
    return await _training_call("/api/v1/labs/investigation-cases/"+case_id+"/transition",request.model_dump())
