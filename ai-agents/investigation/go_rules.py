"""Read-only, optional localhost Go rules adapter for Python investigation.
Go owns independent deterministic event checks, Python owns case reasoning/LLM.
"""
from __future__ import annotations
import os
from urllib.parse import urlsplit
import httpx
from pydantic import BaseModel, ConfigDict, Field

class GoRulesUnavailable(Exception):
    """Opt-in Go rules service is unavailable or gave an untrusted response."""

class GoFinding(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=80)
    path: str = Field(min_length=1, max_length=160)
    severity: str
    message: str

class GoReconciliation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    validator: str
    verdict: str
    recordedStatus: str
    latestEventType: str | None = None
    rules: list[GoFinding]
    evidenceRefs: list[str]
    synthetic: bool
    settlementAttested: bool
    safeToRetry: bool
    disclaimer: str

class GoRulesClient:
    """Bounded synthetic JSON payloads to loopback only; never a payment-action tool."""
    def __init__(self, base_url: str | None = None, transport=None):
        base = (base_url or os.getenv("GO_RULES_URL", "http://127.0.0.1:8094")).rstrip("/")
        address = urlsplit(base)
        if (address.scheme != "http" or address.hostname != "127.0.0.1"
                or address.username is not None or address.password is not None
                or address.path or address.query or address.fragment
                or address.port is None or not 1024 <= address.port <= 65535):
            raise ValueError("Go rules URL must use explicit 127.0.0.1 and a local port")
        self.base_url = base
        self.transport = transport

    async def reconcile(self, payment, events) -> GoReconciliation:
        if not payment.synthetic or not payment.id or len(events) > 256:
            raise GoRulesUnavailable("Only bounded synthetic evidence can be checked")
        payload = {
            "synthetic": True, "paymentId": payment.id,
            "recordedStatus": payment.status,
            "events": [
                {
                    "paymentId": event.paymentId,
                    "occurredAt": event.occurredAt,
                    "type": event.type,
                    "source": event.source,
                    "evidenceRef": event.evidenceRef,
                } for event in events
            ],
        }
        try:
            async with httpx.AsyncClient(
                base_url=self.base_url, transport=self.transport,
                timeout=3, follow_redirects=False, trust_env=False,
            ) as client:
                response = await client.post("/v1/reconcile", json=payload)
            response.raise_for_status()
            if len(response.content) > 65536:
                raise GoRulesUnavailable("Go rules reply exceeded limit")
            result = GoReconciliation.model_validate(response.json())
            if (result.validator != "addressrail-go-educational-v1"
                    or result.synthetic is not True
                    or result.settlementAttested is not False
                    or result.safeToRetry is not False
                    or result.recordedStatus != payment.status
                    or result.latestEventType != events[-1].type):
                raise GoRulesUnavailable("Go rules response did not match evidence contract")
            return result
        except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
            raise GoRulesUnavailable("Go rules check unavailable") from exc
