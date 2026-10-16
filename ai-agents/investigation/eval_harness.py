"""Auditable offline + opt-in *real provider* evaluation of synthetic AI advice.

CI never labels mocks 'recorded real model output'. Live records are written only
when a human supplies the private Gemini key and confirms billable/provider calls.
"""
from __future__ import annotations
import argparse
import asyncio
from datetime import datetime,timezone
import hashlib
import json
import os
from pathlib import Path
from .models import InvestigationResult,Finding
from .rag import standard_store
from .copilot_llm import invoke_gemini,validate_copilot_advisory,UNSAFE_ACTIONS

CORPUS_PATH=Path(__file__).parent/"evals"/"corpus.json"

def evaluation_cases()->list[dict]:
    rows=json.loads(CORPUS_PATH.read_text(encoding="utf8"))
    if len(rows)<8 or len(rows)>100:
        raise ValueError("Bounded synthetic evaluation corpus required")
    seen=set()
    for item in rows:
        if item["id"] in seen or not item["id"].startswith("EVAL-"):
            raise ValueError("Duplicate or unexpected case identifier")
        seen.add(item["id"])
        if item["status"] not in ("RJCT","UNKNOWN","PENDING","ACTC","ACSC","SIMULATED"):
            raise ValueError("Unsupported synthetic status")
        if not item["payment_id"].startswith(("PAY-","SCT-","INST-","CHAPS-")):
            raise ValueError("Use fictional payment IDs only")
    return rows

def evaluate_record(row:dict, recorded:dict)->dict:
    """Scores citations, source grounding, immutable status and payment-safety."""
    result=InvestigationResult(payment_id=row["payment_id"],
        payment_status=row["status"],last_event_type=row["status"],
        outcome="EVIDENCE_FOUND",finding=Finding(
            status=row["status"],explanation=row["finding"],
            recommended_action="Human investigation required",
            evidence_refs=[row["evidence_ref"]]))
    refs=standard_store().search(row["question"],rail=row["rail"],limit=5)
    rules=row.get("go_rules",[])
    valid=validate_copilot_advisory(recorded,result,refs,rules)
    expected=set(row["expected_citations"])
    cited=set(recorded.get("citation_ids",[]))
    return {"id":row["id"],"valid_grounded":valid is not None,
        "citations_relevant":bool(expected.intersection(cited)),
        "status_preserved":recorded.get("payment_status")==row["status"],
        "no_unsafe_claims":not bool(UNSAFE_ACTIONS.search(recorded.get("explanation",""))),
        "human_review":recorded.get("human_review_required") is True,
        "go_ids_preserved":recorded.get("rule_ids")==[r["id"] for r in rules]}

def aggregate(records:list[dict])->dict:
    if not records: raise ValueError("No results")
    fields=["valid_grounded","citations_relevant","status_preserved",
            "no_unsafe_claims","human_review","go_ids_preserved"]
    totals={key:sum(bool(r[key]) for r in records) for key in fields}
    return {"samples":len(records),"metrics":{key:{"passed":count,"total":len(records)}
                        for key,count in totals.items()},
            "claim":"Author-curated synthetic evaluation only; not real banking accuracy."}

async def record_live(cases:list[dict], output:Path, limit:int)->dict:
    if (os.getenv("INVESTIGATION_ENABLE_GEMINI","false").lower()!="true"
        or not os.getenv("GEMINI_API_KEY")):
        raise RuntimeError("Real Gemini credentials and explicit enable flag required")
    if not 1<=limit<=8:raise ValueError("Limit live calls to 1–8")
    if output.exists():
        raise FileExistsError("Live evaluation output cannot overwrite an earlier run")
    # Fail closed on missing/no match sources; no fake recorded results.
    store=standard_store()
    results=[]
    for case in cases[:limit]:
        cited=store.search(case["question"],rail=case["rail"],limit=5)
        if not cited:raise ValueError("No versioned reference for "+case["id"])
        result=InvestigationResult(payment_id=case["payment_id"],outcome="EVIDENCE_FOUND",
            payment_status=case["status"],last_event_type=case["status"],
            finding=Finding(status=case["status"],explanation=case["finding"],
                            recommended_action="Human review mandatory.",
                            evidence_refs=[case["evidence_ref"]]))
        outcome=await invoke_gemini(result,case["question"],cited,case.get("go_rules",[]))
        if not outcome.prompt_sha256 or not outcome.response_id:
            # Cannot attest a specific provider response; no fabricated live sample.
            raise RuntimeError("No verifiable Gemini response ID for "+case["id"]+
                               ". No recorded-live file was written.")
        results.append({"case_id":case["id"],"source":"recorded-real-provider-request",
            "model":outcome.model,"provider":outcome.provider,
            "date_utc":datetime.now(timezone.utc).isoformat(),
            "provider_response_id":outcome.response_id,
            "prompt_sha256":outcome.prompt_sha256,
            "accepted":outcome.accepted,"reason":outcome.reason,
            "token_usage":outcome.usage_tokens,
            # Output is synthetic and limited; retain exact model text for independent evaluation.
            "model_output":outcome.response_text})
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text("\n".join(json.dumps(x,sort_keys=True) for x in results)+"\n",encoding="utf8")
    try:os.chmod(output,0o600)
    except OSError:pass
    return {"recorded":len(results),"path":str(output)}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--live",action="store_true",help="Call real Gemini provider")
    parser.add_argument("--confirm-live-provider-cost",action="store_true")
    parser.add_argument("--limit",type=int,default=5)
    parser.add_argument("--output",type=Path)
    args=parser.parse_args()
    cases=evaluation_cases()
    if not args.live:
        report=[]
        for row in cases:
            docs=standard_store().search(row["question"],rail=row["rail"],limit=5)
            report.append({"id":row["id"],"retrieval":bool(
                set(row["expected_citations"])&{d.id for d in docs})})
        print(json.dumps({"mode":"offline-no-model","n":len(cases),
             "retrieval_passed":sum(x["retrieval"] for x in report),
             "cases":report},indent=2))
        return
    if not args.confirm_live_provider_cost or not args.output:
        parser.error("--live requires --confirm-live-provider-cost and --output")
    print(json.dumps(asyncio.run(record_live(cases,args.output,args.limit))))
if __name__=="__main__":
    main()
