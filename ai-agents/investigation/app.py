"""Local synthetic investigation lab API. No CORS; do not expose publicly."""
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from .agent import investigate
from .models import InvestigationRequest, InvestigationResult
from .tools import PaymentTools, PaymentNotFound, CoreUnavailable

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app=FastAPI(title="AddressRail AI Investigation Lab (Synthetic)", version="0.2.0", lifespan=lifespan)

@app.get("/health")
def health():
    return {"status":"ok","mode":"synthetic-only"}

@app.get("/dashboard", include_in_schema=False)
async def dashboard():
    """Static local UI; no credentials or server-side templates."""
    return FileResponse(Path(__file__).parent / "dashboard.html",
                        media_type="text/html", headers={"Cache-Control":"no-store"})

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
