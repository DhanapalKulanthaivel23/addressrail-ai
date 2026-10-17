"""SQLite-backed synthetic job and report storage for the local Kafka training pipeline.

No multi-tenancy, payments, regulated customer data or durability SLA.
"""
from __future__ import annotations
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
from uuid import uuid4

ID = re.compile(r"^AR-JOB-[a-f0-9]{24}$")
KEY = re.compile(r"^[A-Za-z0-9_-]{8,100}$")

class JobConflict(Exception):
    pass

class PipelineStore:
    def __init__(self, path: str | None = None):
        path = path or os.getenv("PIPELINE_DB_PATH", "./addressrail-pipeline.sqlite3")
        self.path = path
        if path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._schema()

    def connect(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA busy_timeout=15000")
        return db

    def _schema(self):
        with self.connect() as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("""CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY, idem_key TEXT NOT NULL UNIQUE,
                digest TEXT NOT NULL, state TEXT NOT NULL,
                result TEXT, submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)""")

    def begin(self, idem_key: str, payload: dict) -> tuple[str, bool]:
        if not KEY.fullmatch(idem_key):
            raise ValueError("Idempotency-Key must contain 8-100 safe characters")
        content = json.dumps(payload, sort_keys=True, separators=(",",":"))
        digest = hashlib.sha256(content.encode()).hexdigest()
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            original = db.execute("SELECT id,digest FROM jobs WHERE idem_key=?", (idem_key,)).fetchone()
            if original:
                if original["digest"] != digest:
                    raise JobConflict("Idempotency key already bound to another fictional request")
                return original["id"], False
            job = "AR-JOB-" + uuid4().hex[:24]
            db.execute("INSERT INTO jobs(id,idem_key,digest,state) VALUES(?,?,?,?)",
                       (job,idem_key,digest,"QUEUED"))
            return job, True

    def state(self, job_id: str, state: str) -> None:
        if not ID.fullmatch(job_id) or state not in {
            "QUEUED","VALIDATING","VALIDATED","INVESTIGATING",
            "COMPLETED","REVIEW_REQUIRED","PUBLISH_FAILED","FAILED"
        }:
            raise ValueError("Invalid synthetic job/state")
        with self.connect() as db:
            db.execute("UPDATE jobs SET state=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
                       (state,job_id))

    def complete(self, job_id: str, report: dict) -> None:
        if not ID.fullmatch(job_id):
            raise ValueError("Invalid job identifier")
        if report.get("job_id") != job_id or report.get("synthetic") is not True:
            raise ValueError("Refusing non-synthetic or mismatched report")
        if report.get("settlement_attested") is not False or report.get("safe_to_retry") is not False:
            raise ValueError("No settlement or retry approval permitted")
        serial = json.dumps(report, separators=(",",":"), sort_keys=True)
        if len(serial) > 150_000:
            raise ValueError("Oversize investigation report")
        with self.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            previous = db.execute("SELECT state,result FROM jobs WHERE id=?", (job_id,)).fetchone()
            if previous is None:
                raise ValueError("Unknown job")
            if previous["state"] == "COMPLETED":
                if previous["result"] != serial:
                    raise JobConflict("An already completed report cannot be replaced")
                return
            db.execute("""UPDATE jobs SET state='COMPLETED',
                     result=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                       (serial,job_id))

    def read(self, job_id: str) -> dict | None:
        if not ID.fullmatch(job_id):
            return None
        with self.connect() as db:
            r = db.execute("SELECT id,state,result,submitted_at,updated_at FROM jobs WHERE id=?",
                           (job_id,)).fetchone()
        if not r:
            return None
        return {"id":r["id"],"state":r["state"],"submitted_at":r["submitted_at"],
                "updated_at":r["updated_at"],
                "report":json.loads(r["result"]) if r["result"] else None}
