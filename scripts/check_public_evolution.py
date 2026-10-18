"""Public-only AddressRail feature/design PR change-log guard.

Does not retrieve or publish private network-source details.
"""
from pathlib import Path
from datetime import date
import argparse
import json
import re
import subprocess

ROOT=Path(__file__).resolve().parents[1]
LEDGER="docs/product_evolution.json"
STATE="docs/PUBLIC_PRODUCT_STATUS.md"
MATERIAL=("index.html","app/","src/","web/","public/","workers/","functions/",
          "data/","assets/","css/","js/","site/","schemas/","packages/","services/",
          "saas/","network-simulator/","cloudflare/","rail-engine/","payments-core/",
          "ai-agents/","deploy/")
STATES={"SYNTHETIC_DEMO","PRODUCT_DESIGN","PARTIAL_FEATURES","FEATURE_BRANCH_ONLY",
        "DOCUMENTED","TESTED_SYNTHETIC","DEPLOYED_VERIFIED","CANCELLED"}

def validate(d):
    if d.get("schema_version")!=1 or d.get("scope")!="PUBLIC_INFORMATION_ONLY":
        raise ValueError("Public-safe event ledger required")
    events=d.get("events",[])
    if not events:raise ValueError("No public evolution events")
    ids=set()
    dates=[]
    for e in events:
        if not re.fullmatch(r"PUB-[0-9]{3,7}",e.get("id","")) or e["id"] in ids:
            raise ValueError("Duplicate or invalid event ID")
        ids.add(e["id"])
        if e.get("status") not in STATES:raise ValueError("Invalid event status")
        dates.append(date.fromisoformat(e["date"]))
        if not isinstance(e.get("description"),str) or len(e["description"])<20:
            raise ValueError("Event description required")
        if not isinstance(e.get("evidence"),list) or not e["evidence"]:
            raise ValueError("Event evidence required")
    if dates!=sorted(dates):raise ValueError("Chronological events required")
    return len(events)

def assess(old,new,modified):
    validate(new)
    prior=old.get("events",[]) if old else []
    if old and prior!=new["events"][:len(prior)]:
        raise ValueError("Public history append-only; record corrections as new events")
    new_events=new["events"][len(prior):]
    relevant=[p for p in modified if p.startswith(MATERIAL)]
    if relevant and (LEDGER not in modified or STATE not in modified or not new_events):
        raise ValueError("Public product change requires a new evolution event and PUBLIC_PRODUCT_STATUS.md update")
    return {"new_events":len(new_events),"material_changes":relevant}

def git(*args):
    return subprocess.run(["git",*args],cwd=ROOT,text=True,capture_output=True,check=True).stdout

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--base")
    a=p.parse_args()
    data=json.loads((ROOT/LEDGER).read_text(encoding="utf-8"))
    if not a.base:
        print("Public evolution events:",validate(data))
        return
    if not re.fullmatch(r"[a-f0-9]{40}",a.base):
        raise ValueError("Invalid base revision")
    changed=git("diff","--name-only",a.base,"HEAD").splitlines()
    try:old=json.loads(git("show",a.base+":"+LEDGER))
    except subprocess.CalledProcessError:old=None
    print(json.dumps(assess(old,data,changed),indent=2))

if __name__=="__main__":
    main()
