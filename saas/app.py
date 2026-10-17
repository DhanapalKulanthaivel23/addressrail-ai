"""Isolated B2B SaaS *staging* case API with PostgreSQL RLS and signed OIDC tokens.

This service deliberately does not connect to production banking, Kafka or actual
SWIFT infrastructure. Missing configuration fails closed. Customer context comes
only from verified RS256 claims; no user-controlled tenant IDs are accepted.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime,timezone
from typing import Literal
from saas import network_bridge
import hmac
import os
import re
import uuid

import jwt
import psycopg
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

REF = re.compile(r"^PAY-[A-Za-z0-9_-]{5,72}$")
ROLES = {"ADMIN", "INVESTIGATOR", "REVIEWER", "VIEWER"}
STATES = {"RJCT", "PENDING", "UNKNOWN"}
app = FastAPI(title="AddressRail Synthetic Tenant Staging API", version="0.1.0",
              docs_url=None, redoc_url=None, openapi_url=None)

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

class CaseIn(Strict):
    payment_ref: str = Field(min_length=9, max_length=76)
    simulated_status: str
    synthetic: bool = True

class NetworkSimulationIn(Strict):
    reference: str = Field(min_length=4,max_length=60,pattern=r"^[A-Za-z0-9_-]{4,60}$")
    scenario: Literal["ACCEPT","REJECT","PENDING"]
    synthetic: Literal[True] = True

class ReportIn(Strict):
    validation_rule_ids: list[str] = Field(max_length=30)
    evidence_refs: list[str] = Field(max_length=30)
    source_citation_ids: list[str] = Field(max_length=15)
    explanation: str | None = Field(default=None, max_length=650)
    synthetic: bool = True
    requires_human_review: bool = True
    settlement_attested: bool = False
    safe_to_retry: bool = False

def config(name: str) -> str:
    value = os.getenv(name, "")
    if not value:
        raise RuntimeError("Required SaaS configuration not available: " + name)
    return value

def verify_token(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Signed bearer token required")
    token = authorization[7:]
    if len(token) > 4096:
        raise HTTPException(401, "Invalid bearer token")
    try:
        claims = jwt.decode(token, config("SAAS_OIDC_PUBLIC_KEY_PEM"),
            algorithms=["RS256"], issuer=config("SAAS_OIDC_ISSUER"),
            audience=config("SAAS_OIDC_AUDIENCE"),
            options={"require":["exp","iat","nbf","iss","aud","sub","tenant_id","role"],
                     "verify_exp":True,"verify_signature":True},
            leeway=15)
        tenant = uuid.UUID(str(claims["tenant_id"]))
        role = claims["role"]
        sub = claims["sub"]
        if role not in ROLES or not isinstance(sub,str) or not 1<=len(sub)<=128:
            raise ValueError("Invalid claims")
        return {"tenant":str(tenant), "actor":sub, "role":role}
    except (jwt.PyJWTError, ValueError, TypeError, KeyError, RuntimeError):
        raise HTTPException(401, "Invalid or expired signed token")

def permits(identity: dict, *roles: str) -> None:
    if identity["role"] not in roles:
        raise HTTPException(403, "Insufficient permission")

@contextmanager
def session(identity: dict):
    with psycopg.connect(config("SAAS_DATABASE_URL"), connect_timeout=5,
                         autocommit=False) as db:
        # Transaction-scoped GUC must be set on *every* database transaction.
        # PostgreSQL FORCE RLS prevents access even if an API query omits tenant.
        with db.transaction():
            db.execute("SELECT set_config('app.tenant_id', %s, true)", (identity["tenant"],))
            yield db

def case_dict(row: tuple) -> dict:
    return {"id":str(row[0]),"payment_ref":row[1],"simulated_status":row[2],
            "created_at":row[3].isoformat(),"synthetic":True,
            "requires_human_review":True}

@app.middleware("http")
async def harden(request, call_next):
    response = await call_next(request)
    for k,v in {
        "Cache-Control":"no-store",
        "X-Content-Type-Options":"nosniff",
        "X-Frame-Options":"DENY",
        "Referrer-Policy":"no-referrer",
        "Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'",
    }.items():
        response.headers[k]=v
    return response

@app.get("/healthz")
def healthz():
    return {"status":"alive", "synthetic":True}

@app.get("/readyz")
def readyz():
    if os.getenv("SAAS_ENABLE_API")!="true":
        raise HTTPException(503, "Tenant staging API disabled")
    # Readiness is deliberately not a public list of connected assets.
    try:
        with psycopg.connect(config("SAAS_DATABASE_URL"), connect_timeout=3) as db:
            db.execute("SELECT 1")
    except (psycopg.Error, RuntimeError):
        raise HTTPException(503, "Tenant database unavailable")
    return {"ready":True}

def enabled():
    if os.getenv("SAAS_ENABLE_API")!="true":
        raise HTTPException(404, "Tenant staging API disabled")

@app.get("/v1/tenancy/me")
def me(identity=Depends(verify_token)):
    enabled()
    return {"tenant_id":identity["tenant"],"role":identity["role"],
            "synthetic_only":True}

@app.post("/v1/tenancy/cases",status_code=201)
def create_case(body: CaseIn, identity=Depends(verify_token)):
    enabled(); permits(identity,"ADMIN","INVESTIGATOR")
    if not body.synthetic or not REF.fullmatch(body.payment_ref) or body.simulated_status not in STATES:
        raise HTTPException(422,"Only fictional PAY-* cases with review status are accepted")
    case_id=uuid.uuid4()
    try:
        with session(identity) as db:
            row=db.execute("""INSERT INTO saas_cases
                (id,tenant_id,payment_ref,simulated_status,creator)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT (tenant_id,payment_ref) DO NOTHING
                RETURNING id,payment_ref,simulated_status,created_at""",
                (case_id,identity["tenant"],body.payment_ref,body.simulated_status,
                 identity["actor"])).fetchone()
            if not row:
                raise HTTPException(409,"Fictional case already exists in this organisation")
            db.execute("""INSERT INTO saas_audit(tenant_id,case_id,actor,action)
                VALUES (%s,%s,%s,%s)""",
                (identity["tenant"],case_id,identity["actor"],"CASE_CREATED"))
        return case_dict(row)
    except psycopg.Error:
        raise HTTPException(503,"Tenant case storage unavailable")

@app.get("/v1/tenancy/cases")
def list_cases(identity=Depends(verify_token)):
    enabled()
    with session(identity) as db:
        rows=db.execute("""SELECT id,payment_ref,simulated_status,created_at
                           FROM saas_cases ORDER BY created_at DESC LIMIT 100""").fetchall()
    return [case_dict(row) for row in rows]

@app.get("/v1/tenancy/cases/{case_id}")
def get_case(case_id:uuid.UUID, identity=Depends(verify_token)):
    enabled()
    with session(identity) as db:
        row=db.execute("""SELECT id,payment_ref,simulated_status,created_at
                          FROM saas_cases WHERE id=%s""",(case_id,)).fetchone()
    if not row:raise HTTPException(404,"Fictional case not found")
    return case_dict(row)

@app.post("/v1/tenancy/cases/{case_id}/report",status_code=201)
def attach_report(case_id:uuid.UUID,body:ReportIn,identity=Depends(verify_token)):
    enabled();permits(identity,"ADMIN","INVESTIGATOR")
    if (not body.synthetic or not body.requires_human_review
        or body.settlement_attested or body.safe_to_retry
        or not all(re.fullmatch(r"[A-Za-z0-9_.:/-]{1,120}",x) for x in
                   body.validation_rule_ids + body.evidence_refs + body.source_citation_ids)):
        raise HTTPException(422,"Unsafe or non-fictional advisory")
    # A user-supplied report is never an authoritative Java/Go/Swift attestation.
    report=body.model_dump()
    report["origin"]="TENANT_USER_SUBMITTED_SYNTHETIC_UNVERIFIED"
    try:
        with session(identity) as db:
            found=db.execute("SELECT 1 FROM saas_cases WHERE id=%s",(case_id,)).fetchone()
            if not found:raise HTTPException(404,"Fictional case not found")
            from psycopg.types.json import Jsonb
            row=db.execute("""INSERT INTO saas_reports(tenant_id,case_id,payload,actor)
                  VALUES (%s,%s,%s,%s) ON CONFLICT(tenant_id,case_id)
                  DO NOTHING RETURNING case_id""",
                  (identity["tenant"],case_id,Jsonb(report),identity["actor"])).fetchone()
            if not row:raise HTTPException(409,"Report already recorded; immutable")
            db.execute("""INSERT INTO saas_audit(tenant_id,case_id,actor,action)
                 VALUES (%s,%s,%s,%s)""",
                 (identity["tenant"],case_id,identity["actor"],"REPORT_ATTACHED"))
        return {"case_id":str(case_id),"synthetic":True,"verified":False}
    except psycopg.Error:
        raise HTTPException(503,"Tenant report storage unavailable")

@app.get("/v1/tenancy/cases/{case_id}/report")
def download_report(case_id:uuid.UUID,identity=Depends(verify_token)):
    enabled()
    with session(identity) as db:
        row=db.execute("""SELECT payload FROM saas_reports WHERE case_id=%s""",
                       (case_id,)).fetchone()
    if not row:raise HTTPException(404,"Fictional report not found")
    result=JSONResponse(content=row[0])
    result.headers["Content-Disposition"] = f'attachment; filename="addressrail-{case_id}.json"'
    return result

@app.get("/v1/tenancy/audit")
def audit(identity=Depends(verify_token)):
    enabled();permits(identity,"ADMIN")
    with session(identity) as db:
        rows=db.execute("""SELECT action,actor,case_id,occurred_at FROM saas_audit
                           ORDER BY occurred_at DESC LIMIT 100""").fetchall()
    return [{"action":r[0],"actor":r[1],"case_id":str(r[2]),
             "occurred_at":r[3].isoformat()} for r in rows]

@app.post("/v1/tenancy/cases/{case_id}/jobs",status_code=201)
def create_job(case_id:uuid.UUID,identity=Depends(verify_token)):
    """Create a tenant-bound pending record; never publish to unsafe Kafka."""
    enabled();permits(identity,"ADMIN","INVESTIGATOR")
    job_id=uuid.uuid4()
    try:
        with session(identity) as db:
            exists=db.execute("SELECT 1 FROM saas_cases WHERE id=%s",(case_id,)).fetchone()
            if not exists:
                raise HTTPException(404,"Fictional case not found")
            row=db.execute("""INSERT INTO saas_jobs(id,tenant_id,case_id,creator)
                 VALUES(%s,%s,%s,%s) ON CONFLICT(tenant_id,case_id) DO NOTHING
                 RETURNING id,state""",
                 (job_id,identity["tenant"],case_id,identity["actor"])).fetchone()
            if not row:
                raise HTTPException(409,"A synthetic job already exists for this case")
            from psycopg.types.json import Jsonb
            event_id=uuid.uuid4()
            db.execute("""INSERT INTO saas_outbox
                (event_id,tenant_id,job_id,event_type,payload)
                VALUES(%s,%s,%s,%s,%s)""",
                (event_id,identity["tenant"],row[0],"SYNTHETIC_JOB_PENDING",
                 Jsonb({"event_type":"SYNTHETIC_JOB_PENDING",
                        "tenant_id":identity["tenant"],"job_id":str(row[0]),
                        "case_id":str(case_id),"synthetic":True,
                        "settlement_attested":False,"safe_to_retry":False})))
        return {"job_id":str(row[0]),"case_id":str(case_id),
                "state":row[1],"synthetic":True,"dispatched":False}
    except psycopg.Error:
        raise HTTPException(503,"Tenant job storage unavailable")

@app.get("/v1/tenancy/jobs/{job_id}")
def get_job(job_id:uuid.UUID,identity=Depends(verify_token)):
    enabled()
    with session(identity) as db:
        row=db.execute("SELECT id,case_id,state FROM saas_jobs WHERE id=%s",
                       (job_id,)).fetchone()
    if not row:
        raise HTTPException(404,"Synthetic job not found")
    return {"job_id":str(row[0]),"case_id":str(row[1]),"state":row[2],
            "synthetic":True,"dispatched":False}

@app.get("/v1/tenancy/jobs/{job_id}/pending-event")
def pending_event(job_id:uuid.UUID,identity=Depends(verify_token)):
    """Read-only tenant-scoped inspection. Not a Kafka publisher or signed envelope."""
    enabled();permits(identity,"ADMIN","INVESTIGATOR")
    with session(identity) as db:
        row=db.execute("""SELECT event_id,event_type,payload,created_at
                           FROM saas_outbox WHERE job_id=%s""",(job_id,)).fetchone()
    if not row:
        raise HTTPException(404,"Pending synthetic event not found")
    return {"event_id":str(row[0]),"event_type":row[1],"payload":row[2],
            "created_at":row[3].isoformat(),"delivery_status":"NOT_DISPATCHED",
            "synthetic":True,"signed":False}

@app.post("/v1/tenancy/network/simulations",status_code=202)
def start_network_simulation(body:NetworkSimulationIn,identity=Depends(verify_token)):
    """Tenant-scoped synthetic gateway. No private source or browser service key."""
    enabled();permits(identity,"ADMIN","INVESTIGATOR")
    try:
        network_bridge.network_config()
        remote_ref=network_bridge.scoped_reference(identity["tenant"],body.reference,body.scenario)
    except ValueError:
        raise HTTPException(503,"Private synthetic gateway is disabled or unavailable")
    try:
        with session(identity) as db:
            db.execute("""INSERT INTO saas_network_simulations
                   (tenant_id,client_reference,scenario,network_reference)
                   VALUES(%s,%s,%s,%s)
                   ON CONFLICT (tenant_id,client_reference) DO NOTHING""",
                       (identity["tenant"],body.reference,body.scenario,remote_ref))
            row=db.execute("""SELECT scenario,remote_message_id
                   FROM saas_network_simulations WHERE client_reference=%s""",
                   (body.reference,)).fetchone()
            if not row:
                raise HTTPException(503,"Network simulation reservation unavailable")
            if row[0]!=body.scenario:
                raise HTTPException(409,"Reference is already reserved for another scenario")
            existing=row[1]
    except psycopg.Error:
        raise HTTPException(503,"Tenant simulation storage unavailable")
    try:
        if existing is None:
            remote_id,status=network_bridge.submit(identity["tenant"],body.reference,body.scenario)
            with session(identity) as db:
                row=db.execute("""UPDATE saas_network_simulations
                     SET remote_message_id=%s,bridge_state='ACKNOWLEDGED'
                     WHERE client_reference=%s AND
                     (remote_message_id IS NULL OR remote_message_id=%s)
                     RETURNING remote_message_id""",
                     (remote_id,body.reference,remote_id)).fetchone()
                if not row:
                    raise HTTPException(409,"Conflicting private simulation correlation")
        else:
            status=network_bridge.status(str(existing))
    except (ValueError,KeyError,psycopg.Error):
        # The durable tenant reservation remains. Retrying the same reference
        # uses the same upstream idempotency key; no false network ACK is issued.
        raise HTTPException(503,"Private synthetic network unavailable; retry same reference")
    return {"reference":body.reference,"scenario":body.scenario,
            **status,"verified_scheme":False,"settlement_attested":False}

@app.get("/v1/tenancy/network/simulations/{reference}")
def get_network_simulation(reference:str,identity=Depends(verify_token)):
    enabled()
    try:
        network_bridge.network_config()
    except ValueError:
        raise HTTPException(503,"Private synthetic gateway is disabled or unavailable")
    if not network_bridge.REF.fullmatch(reference):
        raise HTTPException(404,"Synthetic simulation not found")
    try:
        with session(identity) as db:
            row=db.execute("""SELECT scenario,remote_message_id,bridge_state
                 FROM saas_network_simulations WHERE client_reference=%s""",
                 (reference,)).fetchone()
    except psycopg.Error:
        raise HTTPException(503,"Tenant simulation storage unavailable")
    if not row:
        raise HTTPException(404,"Synthetic simulation not found")
    if row[1] is None:
        return {"reference":reference,"scenario":row[0],"state":"SUBMITTING",
                "synthetic":True,"settled":False,"verified_scheme":False,
                "settlement_attested":False}
    try:
        status=network_bridge.status(str(row[1]))
    except (ValueError,KeyError):
        raise HTTPException(503,"Private synthetic status temporarily unavailable")
    return {"reference":reference,"scenario":row[0],**status,
            "verified_scheme":False,"settlement_attested":False}
