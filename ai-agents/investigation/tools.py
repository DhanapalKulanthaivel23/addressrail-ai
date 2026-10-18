"""Strict read-only HTTP adapters to localhost Payments Core."""
import os
import httpx
from .models import Payment, Event

class CoreUnavailable(Exception):
    pass

class PaymentNotFound(Exception):
    pass

class PaymentTools:
    def __init__(self, base_url: str | None = None, transport=None):
        self.base_url = (base_url or os.getenv("PAYMENTS_CORE_URL", "http://127.0.0.1:8081")).rstrip("/")
        self.transport = transport

    async def _get(self, path: str):
        try:
            async with httpx.AsyncClient(base_url=self.base_url, transport=self.transport, timeout=4,
                                          follow_redirects=False, trust_env=False) as client:
                response = await client.get(path)
            if response.status_code == 404:
                raise PaymentNotFound()
            response.raise_for_status()
            return response.json()
        except PaymentNotFound:
            raise
        except (httpx.HTTPError, ValueError) as error:
            raise CoreUnavailable() from error

    async def get_payment_status(self, payment_id: str) -> Payment:
        return Payment.model_validate(await self._get(f"/api/v1/payments/{payment_id}"))

    async def get_payment_history(self, payment_id: str) -> list[Event]:
        data = await self._get(f"/api/v1/payments/{payment_id}/events")
        return [Event.model_validate(v) for v in data]

    async def list_synthetic_cases(self, status: str | None = None, limit: int = 40) -> list[dict]:
        """Local Quarkus catalogue is synthetic-only, bounded and read-only."""
        if not 1 <= limit <= 100:
            raise ValueError("limit must be between 1 and 100")
        if status and (not status.isupper() or not status.replace("_", "").isalpha()):
            raise ValueError("invalid status filter")
        query = f"?limit={limit}" + (f"&status={status}" if status else "")
        data = await self._get("/api/v1/labs/cases" + query)
        if not isinstance(data, list):
            raise CoreUnavailable()
        # Do not expose a non-synthetic row even if the backend contract changes.
        rows = [r for r in data if isinstance(r, dict) and r.get("synthetic") is True
                and isinstance(r.get("paymentId"), str)]
        return rows[:limit]

    async def training_case_request(self, path: str, payload: dict | None = None) -> dict:
        """Forward only fixed local training-case paths. Never expose arbitrary proxy URLs."""
        if not path.startswith("/api/v1/labs/investigation-cases/") and path != "/api/v1/labs/investigation-cases":
            raise ValueError("Unsupported training-case endpoint")
        method = "GET" if payload is None else "POST"
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=4,
                                         follow_redirects=False, trust_env=False,
                                         transport=self.transport) as client:
                response = await client.request(method, path, json=payload)
            if response.status_code == 404:
                raise PaymentNotFound()
            if response.status_code in (400, 409):
                return {"error": response.status_code}
            response.raise_for_status()
            return response.json()
        except PaymentNotFound:
            raise
        except (httpx.HTTPError, ValueError) as error:
            raise CoreUnavailable() from error

    async def ensure_synthetic_payment(self, payment_id: str, status: str = "RJCT") -> dict:
        """Create/reuse only a local, fictional Java/H2 payment and status event."""
        import re
        if (not re.fullmatch(r"PAY-[A-Za-z0-9_-]{5,72}", payment_id)
            or status not in {"RJCT","PENDING","UNKNOWN"}):
            raise ValueError("Only synthetic PAY-* examples and review statuses permitted")
        try:
            async with httpx.AsyncClient(base_url=self.base_url,timeout=4,
                         follow_redirects=False,trust_env=False,
                         transport=self.transport) as client:
                resp=await client.post("/api/v1/labs/synthetic-intake",json={
                    "paymentId":payment_id,"simulatedStatus":status,"synthetic":True})
            resp.raise_for_status()
            obj=Payment.model_validate(resp.json())
            if not obj.synthetic or obj.id!=payment_id or obj.status!=status:
                raise CoreUnavailable("Unexpected fictional fixture response")
            return obj.model_dump()
        except (httpx.HTTPError, ValueError) as exc:
            raise CoreUnavailable("Local synthetic intake unavailable") from exc
