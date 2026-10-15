"""Opt-in, loopback-only enterprise security *training* service.

Separate from payments-core and the public website. This is not a production identity,
audit or banking approval system. All case data MUST be synthetic.
"""
from __future__ import annotations
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field

ROLES = {"ADMIN", "INVESTIGATOR", "REVIEWER", "VIEWER"}
ALIAS = re.compile(r"^[a-z][a-z0-9_-]{2,31}$")
CASE_REF = re.compile(r"^(PAY|SCT|INST|CHAPS)-[A-Za-z0-9_-]{1,76}$")
TTL_SECONDS = 3600

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")

class Login(Strict):
    tenant: str = Field(pattern=r"^[a-z][a-z0-9_-]{2,31}$")
    username: str = Field(pattern=r"^[a-z][a-z0-9_-]{2,31}$")
    password: str = Field(min_length=12, max_length=128)

class NewUser(Strict):
    username: str = Field(pattern=r"^[a-z][a-z0-9_-]{2,31}$")
    password: str = Field(min_length=12, max_length=128)
    role: str

class NewCase(Strict):
    payment_id: str = Field(pattern=r"^(PAY|SCT|INST|CHAPS)-[A-Za-z0-9_-]{1,76}$")
    synthetic: bool
    evidence: str = Field(min_length=1, max_length=4000)

class Review(Strict):
    decision: str
    note: str = Field(min_length=3, max_length=500)

def password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 600_000)
    return salt.hex() + ":" + digest.hex()

def password_ok(password: str, stored: str) -> bool:
    salt, expected = stored.split(":")
    return hmac.compare_digest(password_hash(password, bytes.fromhex(salt)), stored)

def _schema(db):
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY, tenant TEXT NOT NULL, username TEXT NOT NULL,
      role TEXT NOT NULL, password_hash TEXT NOT NULL,
      UNIQUE(tenant,username));
    CREATE TABLE IF NOT EXISTS sessions(
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS cases(
      id TEXT PRIMARY KEY,tenant TEXT NOT NULL,payment_id TEXT NOT NULL,
      creator TEXT NOT NULL,status TEXT NOT NULL,evidence BLOB NOT NULL,
      reviewer TEXT, decision_note BLOB,
      UNIQUE(tenant,payment_id));
    CREATE TABLE IF NOT EXISTS audit(
      seq INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL,
      actor TEXT NOT NULL, action TEXT NOT NULL, subject TEXT NOT NULL,
      prev_hash TEXT NOT NULL, digest TEXT NOT NULL);
    """)

def setup(path: str):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as db:
        _schema(db)

def bootstrap_admin(path: str, tenant: str, username: str, password: str):
    """Explicit manual bootstrap. Never installs sample or default credentials."""
    if not ALIAS.fullmatch(tenant) or not ALIAS.fullmatch(username) or len(password) < 16:
        raise ValueError("Tenant and username must be aliases; password needs 16+ chars")
    setup(path)
    with sqlite3.connect(path) as db:
        db.execute("INSERT INTO users VALUES(?,?,?,?,?)",
                   (uuid.uuid4().hex, tenant, username, "ADMIN", password_hash(password)))

def create_app(path: str, evidence_key: bytes, audit_key: bytes) -> FastAPI:
    if not evidence_key or len(audit_key) < 32 or not path:
        raise ValueError("Explicit database, Fernet evidence key and audit key required")
    cipher = Fernet(evidence_key)
    setup(path)
    app = FastAPI(title="AddressRail isolated tenant-security training lab",
                  docs_url=None, redoc_url=None, openapi_url=None)

    # Strict same-origin script loading; no public auth service or static token storage.
    ui_headers = {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy": (
            "default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; "
            "connect-src 'self'; img-src 'self'; form-action 'self'; "
            "frame-ancestors 'none'; base-uri 'none'"
        ),
    }

    @app.get("/enterprise/dashboard", include_in_schema=False)
    def enterprise_dashboard():
        return FileResponse(Path(__file__).parent / "enterprise_dashboard.html",
                            media_type="text/html", headers=ui_headers)

    @app.get("/enterprise/dashboard.js", include_in_schema=False)
    def enterprise_dashboard_script():
        return FileResponse(Path(__file__).parent / "enterprise_dashboard.js",
                            media_type="text/javascript", headers=ui_headers)

    @contextmanager
    def database():
        db = sqlite3.connect(path, timeout=5)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()

    def audit(db, tenant: str, actor: str, action: str, subject: str):
        last = db.execute("SELECT digest FROM audit ORDER BY seq DESC LIMIT 1").fetchone()
        prev = last["digest"] if last else "GENESIS"
        payload = json.dumps([tenant, actor, action, subject, prev], separators=(",",":"))
        digest = hmac.new(audit_key, payload.encode(), hashlib.sha256).hexdigest()
        db.execute("INSERT INTO audit(tenant,actor,action,subject,prev_hash,digest) VALUES(?,?,?,?,?,?)",
                   (tenant, actor, action, subject, prev, digest))

    def user(authorization: str | None = Header(default=None)):
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(401,"Bearer session required")
        token = authorization[7:]
        if not re.fullmatch(r"[A-Za-z0-9_-]{43}", token):
            raise HTTPException(401,"Invalid session")
        digest = hashlib.sha256(token.encode()).hexdigest()
        with database() as db:
            row = db.execute("""SELECT u.id,u.tenant,u.username,u.role FROM sessions s
              JOIN users u ON s.user_id=u.id WHERE s.hash=? AND s.expires>?""",
              (digest,int(time.time()))).fetchone()
        if row is None:
            raise HTTPException(401,"Session expired or invalid")
        return dict(row)

    def permit(identity, *roles):
        if identity["role"] not in roles:
            raise HTTPException(403,"Role not permitted")

    @app.post("/v1/login")
    def login(body: Login):
        with database() as db:
            row = db.execute("SELECT * FROM users WHERE tenant=? AND username=?",
                             (body.tenant,body.username)).fetchone()
            # Same expensive check for missing users; no role/tenant leaks.
            candidate = row["password_hash"] if row else password_hash("nonexistent-password-placeholder")
            if not password_ok(body.password, candidate) or row is None:
                raise HTTPException(401,"Invalid credentials")
            token = secrets.token_urlsafe(32)
            db.execute("INSERT INTO sessions VALUES(?,?,?)",
                       (hashlib.sha256(token.encode()).hexdigest(),
                        row["id"],int(time.time())+TTL_SECONDS))
            db.commit()
        return {"access_token":token,"token_type":"bearer","expires_in":TTL_SECONDS}

    @app.post("/v1/logout")
    def logout(identity=Depends(user),authorization: str = Header()):
        with database() as db:
            db.execute("DELETE FROM sessions WHERE hash=?",
                       (hashlib.sha256(authorization[7:].encode()).hexdigest(),))
            db.commit()
        return {"logged_out":True}

    @app.get("/v1/me")
    def me(identity=Depends(user)):
        return {"tenant":identity["tenant"],"username":identity["username"],"role":identity["role"]}

    @app.post("/v1/users",status_code=201)
    def add_user(body: NewUser, identity=Depends(user)):
        permit(identity,"ADMIN")
        if body.role not in ROLES: raise HTTPException(422,"Unsupported role")
        with database() as db:
            try:
                db.execute("BEGIN IMMEDIATE")
                db.execute("INSERT INTO users VALUES(?,?,?,?,?)",(
                    uuid.uuid4().hex,identity["tenant"],body.username,body.role,password_hash(body.password)))
                audit(db,identity["tenant"],identity["username"],"USER_CREATED",body.username)
                db.commit()
            except sqlite3.IntegrityError:
                db.rollback()
                raise HTTPException(409,"User already exists in this tenant")
        return {"username":body.username,"role":body.role,"tenant":identity["tenant"]}

    @app.post("/v1/cases",status_code=201)
    def new_case(body: NewCase, identity=Depends(user)):
        permit(identity,"ADMIN","INVESTIGATOR")
        if body.synthetic is not True: raise HTTPException(422,"Only explicitly synthetic evidence")
        case_id="CASE-"+uuid.uuid4().hex
        with database() as db:
            try:
                db.execute("BEGIN IMMEDIATE")
                db.execute("INSERT INTO cases(id,tenant,payment_id,creator,status,evidence) VALUES(?,?,?,?,?,?)",
                           (case_id,identity["tenant"],body.payment_id,identity["username"],
                            "OPEN",cipher.encrypt(body.evidence.encode())))
                audit(db,identity["tenant"],identity["username"],"CASE_OPENED",case_id)
                db.commit()
            except sqlite3.IntegrityError:
                db.rollback()
                raise HTTPException(409,"Case already exists in this tenant")
        return {"id":case_id,"status":"OPEN","tenant":identity["tenant"],"synthetic":True}

    @app.get("/v1/cases")
    def list_cases(identity=Depends(user)):
        with database() as db:
            rows=db.execute("""SELECT id,payment_id,status,creator,reviewer FROM cases
                WHERE tenant=? ORDER BY id DESC LIMIT 100""",(identity["tenant"],)).fetchall()
        return [dict(row) for row in rows]

    @app.get("/v1/cases/{case_id}")
    def get_case(case_id: str, identity=Depends(user)):
        with database() as db:
            row=db.execute("SELECT * FROM cases WHERE id=? AND tenant=?",
                           (case_id,identity["tenant"])).fetchone()
        if row is None: raise HTTPException(404,"Case not found")
        result={"id":row["id"],"payment_id":row["payment_id"],"status":row["status"],
                "creator":row["creator"],"reviewer":row["reviewer"],"synthetic":True}
        if identity["role"] in {"ADMIN","INVESTIGATOR","REVIEWER"}:
            try:
                result["evidence"]=cipher.decrypt(row["evidence"]).decode()
                if row["decision_note"]:
                    result["decision_note"]=cipher.decrypt(row["decision_note"]).decode()
            except InvalidToken as exc:
                raise HTTPException(503,"Encrypted synthetic evidence failed integrity check") from exc
        return result

    @app.post("/v1/cases/{case_id}/review")
    def review(case_id: str, body: Review, identity=Depends(user)):
        permit(identity,"REVIEWER")
        if body.decision not in {"APPROVED_FOR_TRAINING","REJECTED_FOR_TRAINING"}:
            raise HTTPException(422,"Invalid training decision")
        with database() as db:
            db.execute("BEGIN IMMEDIATE")
            row=db.execute("SELECT * FROM cases WHERE id=? AND tenant=?",
                           (case_id,identity["tenant"])).fetchone()
            if not row: raise HTTPException(404,"Case not found")
            if row["creator"]==identity["username"]:
                raise HTTPException(403,"Opening investigator cannot review own case")
            if row["status"]!="OPEN":
                raise HTTPException(409,"Case already reviewed")
            db.execute("UPDATE cases SET status=?,reviewer=?,decision_note=? WHERE id=? AND tenant=?",
                       (body.decision,identity["username"],cipher.encrypt(body.note.encode()),
                        case_id,identity["tenant"]))
            audit(db,identity["tenant"],identity["username"],"TRAINING_REVIEW",case_id)
            db.commit()
        return {"id":case_id,"status":body.decision,"reviewer":identity["username"],
                "synthetic":True,"payment_unchanged":True}

    @app.get("/v1/audit/verify")
    def verify(identity=Depends(user)):
        permit(identity,"ADMIN")
        with database() as db:
            rows=db.execute("SELECT * FROM audit ORDER BY seq").fetchall()
        previous="GENESIS"
        for row in rows:
            payload=json.dumps([row["tenant"],row["actor"],row["action"],row["subject"],
                                previous],separators=(",",":"))
            expected=hmac.new(audit_key,payload.encode(),hashlib.sha256).hexdigest()
            if row["prev_hash"]!=previous or not hmac.compare_digest(row["digest"],expected):
                return {"valid":False,"checked":row["seq"],"limitation":"Local keyed HMAC; not immutable audit"}
            previous=row["digest"]
        return {"valid":True,"checked":len(rows),"limitation":"Local keyed HMAC; not immutable audit"}

    return app

def service_from_environment() -> FastAPI:
    """Fail closed; do not mount on production or start without explicit keys."""
    if os.getenv("ADDRESSRAIL_ENTERPRISE_LAB_ENABLED")!="true":
        raise RuntimeError("Security lab disabled: explicit local opt-in required")
    if os.getenv("ADDRESSRAIL_ENVIRONMENT","development")=="production":
        raise RuntimeError("Security training lab refuses production environment")
    path=os.environ["ADDRESSRAIL_ENTERPRISE_DB"]
    evidence_key=os.environ["ADDRESSRAIL_EVIDENCE_KEY"].encode()
    audit_key=bytes.fromhex(os.environ["ADDRESSRAIL_AUDIT_KEY_HEX"])
    return create_app(path,evidence_key,audit_key)

# uvicorn --factory investigation.enterprise:service_from_environment --host 127.0.0.1
