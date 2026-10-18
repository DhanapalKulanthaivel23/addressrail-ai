"""Encrypted local SQLite training-pipeline backup and non-destructive restore.

Demonstrates disaster recovery for fictional cases only; not a production
PostgreSQL/Kafka/tenant backup solution. Explicit externally held Fernet key.
"""
from __future__ import annotations
from datetime import datetime,timezone
from pathlib import Path
import argparse
import json
import os
import sqlite3
import tempfile
from cryptography.fernet import Fernet,InvalidToken

LIMIT=32*1024*1024
HEADER=b"ADDRESSRAIL-SYNTHETIC-SQLITE-V1\n"

def cipher(key:bytes)->Fernet:
    return Fernet(key)  # Raises on wrong/missing external secret.

def _db_integrity(path:Path):
    with sqlite3.connect(f"file:{path}?mode=ro",uri=True) as db:
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite database failed integrity check")

def backup(source: str,destination: str,key:bytes)->dict:
    original=Path(source).resolve(strict=True)
    if not original.is_file():
        raise ValueError("Source database not found")
    dst=Path(destination)
    if dst.exists():
        raise FileExistsError("Refusing to overwrite backup")
    dst.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="addressrail-backup-") as temp:
        scratch=Path(temp)/"snapshot.db"
        with sqlite3.connect(f"file:{original}?mode=ro",uri=True) as db:
            with sqlite3.connect(scratch) as copy:
                db.backup(copy)
        _db_integrity(scratch)
        if scratch.stat().st_size>LIMIT:
            raise ValueError("Local fictional backup size exceeded")
        enc=cipher(key).encrypt(HEADER+scratch.read_bytes())
        fd=os.open(dst,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        try:
            with os.fdopen(fd,"wb") as sink:
                sink.write(enc)
        except BaseException:
            dst.unlink(missing_ok=True)
            raise
    return {"encrypted":True,"bytes":len(enc),
            "source":"fictional-sqlite", "backup_utc":datetime.now(timezone.utc).isoformat()}

def restore(source:str,destination:str,key:bytes)->dict:
    dst=Path(destination)
    if dst.exists():
        raise FileExistsError("Existing local pipeline store will never be overwritten")
    ciphertext=Path(source).read_bytes()
    if len(ciphertext)>LIMIT+5*1024*1024:
        raise ValueError("Oversized encrypted backup")
    plaintext=cipher(key).decrypt(ciphertext)
    if not plaintext.startswith(HEADER):
        raise ValueError("Unexpected backup format")
    raw=plaintext[len(HEADER):]
    if len(raw)>LIMIT:
        raise ValueError("Oversized local database")
    dst.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(dst,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(fd,"wb") as sink:
            sink.write(raw)
        _db_integrity(dst)
    except BaseException:
        dst.unlink(missing_ok=True)
        raise
    return {"restored":True,"bytes":len(raw),"scope":"fictional-sqlite"}

def main():
    p=argparse.ArgumentParser(description="Synthetic-only encrypted local SQLite backup/restore")
    p.add_argument("action",choices=("backup","restore"))
    p.add_argument("source")
    p.add_argument("destination")
    args=p.parse_args()
    token=os.getenv("ADDRESSRAIL_BACKUP_FERNET_KEY","")
    if not token:
        p.error("ADDRESSRAIL_BACKUP_FERNET_KEY is required via secret manager")
    fn=backup if args.action=="backup" else restore
    print(json.dumps(fn(args.source,args.destination,token.encode()),indent=2))
if __name__=="__main__":
    main()
