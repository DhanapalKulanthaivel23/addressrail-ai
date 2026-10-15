from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class InvestigationRequest(StrictModel):
    payment_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")

class Payment(StrictModel):
    id: str
    status: str
    synthetic: bool
    scheme: str
    messageType: str
    amount: float
    currency: str
    debtorAgent: str
    creditorAgent: str

class Event(StrictModel):
    id: int | None = None
    paymentId: str
    occurredAt: str
    type: str
    source: str
    evidenceRef: str
    description: str

class Finding(StrictModel):
    status: Literal["RJCT", "PENDING", "UNKNOWN", "ACTC", "ACSC", "SIMULATED", "OTHER", "CONFLICT", "UNAVAILABLE"]
    explanation: str
    recommended_action: str
    evidence_refs: list[str] = Field(default_factory=list)
    requires_human_review: bool = True

class InvestigationResult(StrictModel):
    payment_id: str
    outcome: Literal["EVIDENCE_FOUND", "INSUFFICIENT_EVIDENCE", "NOT_FOUND", "SERVICE_UNAVAILABLE"]
    payment_status: str | None = None
    last_event_type: str | None = None
    finding: Finding
    ai_explanation: str | None = None
    ai_used: bool = False
    synthetic: bool = True
    prompt_version: str = "investigation-v2"
