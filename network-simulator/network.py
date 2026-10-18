"""Independent synthetic payment-rail network simulator (no real payment connectivity).

Implements a bank-to-bank message router with a durable SQLite event log.
Rail profiles are SIMULATED behaviours, not official network specifications.
"""
import json
import re
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

RAILS={"SWIFT_CBPR","SEPA_SCT","SEPA_SCT_INST","SEPA_SDD","RTGS","CHAPS","T2","BACS"}
ROUTES={"SWIFT_CBPR":{"MT103","PACS008"},
        "SEPA_SCT":{"PACS008"},"SEPA_SCT_INST":{"PACS008"},
        "SEPA_SDD":{"PACS003"},"RTGS":{"PACS008","PACS009"},
        "CHAPS":{"PACS008","PACS009"},"T2":{"PACS008","PACS009"},
        "BACS":{"BACS_STANDARD18","PACS008"}}
BANK=re.compile(r"[A-Z0-9]{6,12}\Z")
VALID_STATES={"ACCEPTED","REJECTED"}
MONEY=re.compile(r"[A-Z]{3}\Z")

class Network:
    def __init__(self,path):
        self.path=str(path)
        self.lock=threading.RLock()
        with self._db() as c:
            c.executescript("""CREATE TABLE IF NOT EXISTS messages(
                id TEXT PRIMARY KEY, rail TEXT NOT NULL, sender TEXT NOT NULL,
                receiver TEXT NOT NULL, format TEXT NOT NULL, payload TEXT NOT NULL,
                state TEXT NOT NULL, reason TEXT NOT NULL, created TEXT NOT NULL,
                correlation_id TEXT NOT NULL, UNIQUE(sender,correlation_id));
                CREATE TABLE IF NOT EXISTS events(
                id INTEGER PRIMARY KEY AUTOINCREMENT, message_id TEXT NOT NULL,
                kind TEXT NOT NULL, state TEXT NOT NULL, occurred TEXT NOT NULL);""")
    def _db(self):
        db=sqlite3.connect(self.path,timeout=10)
        db.row_factory=sqlite3.Row
        return db
    def submit(self,data):
        if not isinstance(data,dict) or set(data)!={"rail","sender","receiver","format","payload","correlation_id"}:
            raise ValueError("Exact request fields required")
        rail=data["rail"]
        if rail not in RAILS or data["format"] not in ROUTES[rail]:
            raise ValueError("Unsupported synthetic rail/message format")
        if any(not isinstance(data[x],str) or not BANK.fullmatch(data[x]) for x in ("sender","receiver")):
            raise ValueError("Invalid fictional bank identifier")
        if data["sender"]==data["receiver"]:
            raise ValueError("Sender and receiver must differ")
        if not isinstance(data["correlation_id"],str) or not re.fullmatch(r"[a-zA-Z0-9_-]{4,80}",data["correlation_id"]):
            raise ValueError("Invalid correlation identifier")
        payload=data["payload"]
        if not isinstance(payload,str) or not 1<=len(payload.encode("utf-8"))<=90000:
            raise ValueError("Synthetic payload must contain 1-90000 bytes")
        # Simulation must not silently validate real SWIFT/ISO conformance.
        if "<!DOCTYPE" in payload.upper() or "<!ENTITY" in payload.upper():
            raise ValueError("DTD/ENTITY payloads refused")
        now=datetime.now(timezone.utc).isoformat()
        with self.lock,self._db() as db:
            existing=db.execute("SELECT * FROM messages WHERE sender=? AND correlation_id=?",
                                (data["sender"],data["correlation_id"])).fetchone()
            if existing:
                if any(existing[k]!=data[v] for k,v in [("rail","rail"),("sender","sender"),("receiver","receiver"),("format","format"),("payload","payload")]):
                    raise ValueError("Idempotency key already used for different request")
                return self._view(existing,duplicate=True)
            ident=str(uuid4())
            db.execute("""INSERT INTO messages VALUES(?,?,?,?,?,?,?,?,?,?)""",
                       (ident,rail,data["sender"],data["receiver"],data["format"],payload,
                        "NETWORK_ACCEPTED","SIMULATED_NETWORK_ACK",now,data["correlation_id"]))
            db.execute("INSERT INTO events(message_id,kind,state,occurred) VALUES(?,?,?,?)",
                       (ident,"NETWORK_ACK","NETWORK_ACCEPTED",now))
            return self.get(ident,db=db)
    def _view(self,row,duplicate=False):
        return {"message_id":row["id"],"rail":row["rail"],"sender":row["sender"],
                "receiver":row["receiver"],"format":row["format"],"state":row["state"],
                "reason":row["reason"],"correlation_id":row["correlation_id"],
                "duplicate":duplicate,"synthetic":True,"settlement_attested":False}
    def get(self,ident,db=None):
        if db is None:
            with self._db() as c:
                return self.get(ident,db=c)
        row=db.execute("SELECT * FROM messages WHERE id=?",(ident,)).fetchone()
        if row is None: raise KeyError("Unknown synthetic message")
        return self._view(row)
    def respond(self,ident,bank,state,reason):
        if state not in VALID_STATES or not isinstance(reason,str) or not re.fullmatch(r"[A-Z0-9_]{3,45}",reason):
            raise ValueError("Invalid simulated outcome")
        with self.lock,self._db() as db:
            row=db.execute("SELECT * FROM messages WHERE id=?",(ident,)).fetchone()
            if not row: raise KeyError("Unknown synthetic message")
            if bank!=row["receiver"]: raise PermissionError("Only receiving bank may respond")
            if row["state"] in VALID_STATES:
                if row["state"]!=state or row["reason"]!=reason: raise ValueError("Conflicting final status")
                return self._view(row,duplicate=True)
            now=datetime.now(timezone.utc).isoformat()
            db.execute("UPDATE messages SET state=?,reason=? WHERE id=?",(state,reason,ident))
            db.execute("INSERT INTO events(message_id,kind,state,occurred) VALUES(?,?,?,?)",
                       (ident,"BANK_RESPONSE",state,now))
            return self.get(ident,db=db)
    def inbox(self,bank):
        if not isinstance(bank,str) or not BANK.fullmatch(bank): raise ValueError("Invalid bank")
        with self._db() as db:
            return [self._view(x) for x in db.execute(
                "SELECT * FROM messages WHERE receiver=? ORDER BY created",(bank,)).fetchall()]
    def sender_status(self,bank,ident):
        row=self.get(ident)
        if row["sender"]!=bank: raise PermissionError("Not sending bank")
        return row
