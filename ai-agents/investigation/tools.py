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
