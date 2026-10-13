"""Local synthetic investigation lab API. No CORS; do not expose publicly."""
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from .agent import investigate
from .models import InvestigationRequest, InvestigationResult

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app=FastAPI(title="AddressRail AI Investigation Lab (Synthetic)", version="0.1.0", lifespan=lifespan)

@app.get("/health")
def health():
    return {"status":"ok","mode":"synthetic-only"}

@app.post("/investigate", response_model=InvestigationResult)
async def investigate_payment(request: InvestigationRequest):
    try:
        return await investigate(request.payment_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Investigation temporarily unavailable") from exc
