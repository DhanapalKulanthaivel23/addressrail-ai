"""Strict, versioned authentication envelope for future synthetic Kafka outbox events.

Not a Kafka dispatcher. Receivers must additionally store consumed event IDs
durably and bind expected tenants to their independently authorized workload.
"""
import hashlib
import hmac
import json
import re
from datetime import datetime, timezone
from uuid import UUID

KIND = "SYNTHETIC_JOB_PENDING"
FIELDS = {"event_type", "tenant_id", "job_id", "case_id",
          "synthetic", "settlement_attested", "safe_to_retry"}
WRAPPER = {"version", "event_id", "issued_at", "payload", "mac"}

def canonical(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")

def _uuid(value):
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("Canonical UUID required")

def _payload(payload):
    if not isinstance(payload, dict) or set(payload) != FIELDS:
        raise ValueError("Unexpected event payload")
    for name in ("tenant_id", "job_id", "case_id"):
        _uuid(payload[name])
    if (payload["event_type"] != KIND or payload["synthetic"] is not True
        or payload["settlement_attested"] is not False
        or payload["safe_to_retry"] is not False):
        raise ValueError("Unsafe or unsupported event")

def _key(key):
    if not isinstance(key, bytes) or len(key) < 32:
        raise ValueError("Service MAC key must be at least 32 bytes")
    return key

def sign_event(*, event_id, payload, key, issued_at=None):
    _uuid(event_id)
    _payload(payload)
    _key(key)
    timestamp = issued_at or datetime.now(timezone.utc)
    if timestamp.tzinfo is None:
        raise ValueError("Timezone-aware timestamp required")
    unsigned = {"version": 1, "event_id": event_id,
                "issued_at": timestamp.astimezone(timezone.utc).isoformat(),
                "payload": payload}
    signature = hmac.new(key, canonical(unsigned), hashlib.sha256).hexdigest()
    return {**unsigned, "mac": signature}

def verify_event(event, *, key, expected_tenant, now=None, max_age_seconds=300):
    _key(key)
    _uuid(expected_tenant)
    if not isinstance(event, dict) or set(event) != WRAPPER:
        raise ValueError("Unexpected signed event envelope")
    if event["version"] != 1:
        raise ValueError("Unsupported envelope version")
    _uuid(event["event_id"])
    _payload(event["payload"])
    if event["payload"]["tenant_id"] != expected_tenant:
        raise ValueError("Tenant mismatch")
    if not isinstance(event["mac"], str) or not re.fullmatch(r"[0-9a-f]{64}", event["mac"]):
        raise ValueError("Invalid MAC encoding")
    unsigned = {k: event[k] for k in WRAPPER if k != "mac"}
    expected = hmac.new(key, canonical(unsigned), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, event["mac"]):
        raise ValueError("Event integrity failure")
    try:
        issued = datetime.fromisoformat(event["issued_at"])
    except (TypeError, ValueError):
        raise ValueError("Invalid timestamp") from None
    if issued.tzinfo is None:
        raise ValueError("Timezone-aware timestamp required")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None or not 0 <= (current-issued).total_seconds() <= max_age_seconds:
        raise ValueError("Stale or future event")
    return event["payload"]
