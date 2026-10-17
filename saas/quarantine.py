"""Tenant-bound quarantine metadata for invalid synthetic Kafka events.

This does not acknowledge Kafka offsets or execute recovery. Only a provisioned
consumer may record evidence. Raw payloads and secrets are never retained.
"""
import hashlib
import re
from uuid import UUID
import psycopg

REASONS=frozenset({"INVALID_ENVELOPE","INVALID_SIGNATURE","TENANT_MISMATCH",
                   "UNAUTHORIZED_JOB","UNEXPECTED_EVENT"})
NAME=re.compile(r"[a-z0-9_-]{3,48}\Z")

def record_quarantine(*,dsn,tenant_id,consumer_name,reason,raw_event):
    UUID(tenant_id)
    if not NAME.fullmatch(consumer_name) or reason not in REASONS:
        raise ValueError("Invalid quarantine metadata")
    if not isinstance(raw_event,bytes) or len(raw_event)>90000:
        raise ValueError("Raw event must be bounded bytes")
    fingerprint=hashlib.sha256(raw_event).hexdigest()
    with psycopg.connect(dsn,connect_timeout=5,autocommit=False) as db:
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id', %s, true)",(tenant_id,))
            # Repeated events are idempotent; no UPDATE privilege required.
            row=db.execute("""INSERT INTO saas_quarantine
                (tenant_id,event_fingerprint,consumer_name,reason)
                VALUES(%s,%s,%s,%s)
                ON CONFLICT DO NOTHING RETURNING event_fingerprint""",
                (tenant_id,fingerprint,consumer_name,reason)).fetchone()
    return {"fingerprint":fingerprint,"new":bool(row),"quarantined":True,
            "offset_committed":False}
