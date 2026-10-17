"""File drop adapter for local synthetic rail requests and responses.

Operator places a JSON envelope into inbox/. Each file has:
{"action":"submit","data":{...}} or
{"action":"respond","message_id":"...","data":{"bank":"BANKBB22","state":"ACCEPTED","reason":"BANK_ACCEPTED"}}.
Processed responses are atomically published under outbox/ using their source
file name; duplicate file names are rejected to avoid silent overwrite.
Not a filesystem watcher, HA queue, or real SWIFT/FileAct/Bacs gateway.
"""
import json
import os
import re
import tempfile
from pathlib import Path
from network import Network

FILENAME=re.compile(r"[A-Za-z0-9_-]{1,80}\.json\Z")

def run_file(*, db_path, incoming, outgoing):
    source=Path(incoming)
    target=Path(outgoing)
    if source.is_symlink() or not source.is_file() or not FILENAME.fullmatch(source.name):
        raise ValueError("Input must be a regular named JSON file")
    target.mkdir(parents=True,exist_ok=True)
    if target.is_symlink(): raise ValueError("Output directory cannot be a symlink")
    destination=target/source.name
    if destination.exists(): raise FileExistsError("Refusing to overwrite prior response")
    if source.stat().st_size>100000:raise ValueError("Oversized synthetic envelope")
    envelope=json.loads(source.read_text())
    if not isinstance(envelope,dict): raise ValueError("Object envelope required")
    network=Network(db_path)
    if set(envelope)=={"action","data"} and envelope["action"]=="submit":
        result=network.submit(envelope["data"])
    elif set(envelope)=={"action","message_id","data"} and envelope["action"]=="respond":
        result=network.respond(envelope["message_id"],**envelope["data"])
    else:
        raise ValueError("Unexpected file request envelope")
    # Only publish a complete response, never a partially written JSON file.
    fd,tmp=tempfile.mkstemp(dir=target,prefix=".reply-",suffix=".tmp")
    try:
        with os.fdopen(fd,"w") as stream:
            json.dump(result,stream,sort_keys=True)
            stream.flush()
            os.fsync(stream.fileno())
        os.link(tmp,destination)  # fail rather than overwrite
    finally:
        os.unlink(tmp)
    return result

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("--db",required=True)
    parser.add_argument("--in",dest="incoming",required=True)
    parser.add_argument("--out",dest="outgoing",required=True)
    args=parser.parse_args()
    print(json.dumps(run_file(db_path=args.db,incoming=args.incoming,outgoing=args.outgoing)))
