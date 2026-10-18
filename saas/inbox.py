"""Fail-closed synthetic inbox deduplication for provisioned tenant consumers.

Caller must provide a verified, independently provisioned expected tenant.
The database role must be non-owner and unable to BYPASSRLS.
"""
import json
from uuid import UUID
import psycopg
from .event_contract import verify_event

def record_event(*, dsn, event, key, expected_tenant, consumer_name):
    UUID(expected_tenant)
    if not isinstance(consumer_name,str) or not 3<=len(consumer_name)<=48 or not all(c.islower() or c.isdigit() or c in "_-" for c in consumer_name):
        raise ValueError("Invalid consumer name")
    payload=verify_event(event,key=key,expected_tenant=expected_tenant)
    with psycopg.connect(dsn,connect_timeout=5,autocommit=False) as db:
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id', %s, true)",(expected_tenant,))
            # Require an existing job with matching tenant identity. Signed
            # payload alone cannot authorize arbitrary unknown jobs.
            job=db.execute("SELECT case_id FROM saas_jobs WHERE id=%s",(payload["job_id"],)).fetchone()
            if not job or str(job[0])!=payload["case_id"]:
                raise ValueError("Event job/case mismatch or unauthorized tenant")
            row=db.execute("""INSERT INTO saas_inbox(tenant_id,event_id,job_id,consumer_name)
                 VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING event_id""",
                 (expected_tenant,event["event_id"],payload["job_id"],consumer_name)).fetchone()
            return {"accepted":bool(row),"duplicate":not bool(row),
                    "event_id":event["event_id"],"tenant_id":expected_tenant}
