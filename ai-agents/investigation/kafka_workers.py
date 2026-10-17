"""Three independent Kafka worker roles using real broker acknowledgements.

Run as separate processes. Validation delegates to Go over HTTP; investigation
delegates to Python LangGraph (Java evidence + Go rules + Gemini if enabled),
then creates/reuses the *local* Java training case. Writer persists immutable JSON
report. This is NOT a production-grade outbox/exactly-once transaction.
"""
from __future__ import annotations
import argparse
import asyncio
from datetime import datetime,timezone
from json import JSONDecodeError
import json
import os
import time
import httpx
from .copilot import CopilotRequest, run_copilot, validate_request
from .go_rules import GoRulesClient
from .tools import PaymentTools
from .pipeline_store import PipelineStore
from .kafka_bus import KafkaBus, TOPICS, create_topics

ROLE_IN = {"validate":TOPICS["submitted"],
           "investigate":TOPICS["validated"],
           "report":TOPICS["investigated"]}
ROLE_OUT = {"validate":TOPICS["validated"],
            "investigate":TOPICS["investigated"]}

def envelope(job_id: str, **data) -> dict:
    return {"version":1,"synthetic":True,"job_id":job_id,**data}

def review_status(data: dict) -> str:
    if data.get("wellFormed") is not True or data.get("validSubset") is not True:
        return "REVIEW_REQUIRED"
    return "VALIDATION_SUBSET_PASSED"

async def validate_payment(event: dict, go=None) -> dict:
    """Go owns XML parsing; no LLM or Java endpoint can declare valid settlement."""
    request=CopilotRequest(payment_id=event["payment_id"],
                          question=event["question"],synthetic_xml=event["synthetic_xml"])
    validate_request(request)
    client=go or GoRulesClient()
    checked=await client.inspect_xml("CBPR",request.synthetic_xml)
    if checked.synthetic is not True or checked.safeToRetry or checked.settlementAttested:
        raise ValueError("Go validation contract breached")
    status=event.get("simulated_status","RJCT")
    if status not in {"RJCT","PENDING","UNKNOWN"}:
        raise ValueError("Unsupported fictional status")
    return envelope(event["job_id"],payment_id=request.payment_id,question=request.question,
        simulated_status=status,synthetic_xml=request.synthetic_xml,
        validation={"status":review_status(checked.model_dump()),
                    "wellFormed":checked.wellFormed,
                    "validSubset":checked.validSubset,
                    "rule_ids":[x.id for x in checked.rules],
                    "rules":[x.model_dump() for x in checked.rules[:30]],
                    "validator":checked.validator})

async def investigate_payment(event: dict, tools=None, go=None, copilot=None) -> dict:
    request=CopilotRequest(payment_id=event["payment_id"],
                          question=event["question"],synthetic_xml=event["synthetic_xml"])
    java=tools or PaymentTools()
    await java.ensure_synthetic_payment(event["payment_id"],
                                        event.get("simulated_status","RJCT"))
    result=await (copilot(request) if copilot else run_copilot(request,tools=java,go=go))
    if result.synthetic is not True or result.settlement_attested or result.safe_to_retry:
        raise ValueError("AI returned an unsafe payment outcome")
    # Only fictional Java case management; it must be enabled explicitly in local dev.
    payload={"paymentId":event["payment_id"],"actorAlias":"TRAINING-Pipeline"}
    opened=await java.training_case_request("/api/v1/labs/investigation-cases",payload)
    if opened.get("error")==409:
        opened=await java.training_case_request(
           "/api/v1/labs/investigation-cases/by-payment/"+event["payment_id"])
    if opened.get("error") or not opened.get("trainingCase",{}).get("id"):
        raise RuntimeError("Java training case unavailable")
    case_id=opened["trainingCase"]["id"]
    # The report is generated after the Java case exists; no auto-approval action.
    report={"schema":"addressrail.synthetic-investigation.v1",
       "job_id":event["job_id"],"payment_id":event["payment_id"],
       "created_utc":datetime.now(timezone.utc).isoformat(),
       "scheme":"CBPR+ educational pacs.008",
       "validation":event["validation"],
       "investigation":result.model_dump(),
       "case_id":case_id,"case_state":opened["trainingCase"]["state"],
       "synthetic":True,"requires_human_review":True,
       "settlement_attested":False,"safe_to_retry":False,
       "notice":"Synthetic teaching report. Not ISO XSD/CBPR+ conformance or settlement proof."}
    return envelope(event["job_id"],report=report)

def finalize_report(data: dict, store: PipelineStore):
    report=data.get("report")
    if not isinstance(report,dict):
        raise ValueError("Missing investigation report")
    store.complete(data["job_id"],report)

def process_one(role: str,event:dict,store:PipelineStore):
    if role=="validate":
        store.state(event["job_id"],"VALIDATING")
        next_data=asyncio.run(validate_payment(event))
        store.state(event["job_id"],"VALIDATED")
        return next_data
    if role=="investigate":
        store.state(event["job_id"],"INVESTIGATING")
        return asyncio.run(investigate_payment(event))
    if role=="report":
        finalize_report(event,store)
        return None
    raise ValueError("Unknown worker")

def handle_error(role:str,event:dict,exc:Exception,bus):
    # Only safe error class metadata leaves this process; never raw XML/payment.
    n=int(event.get("attempt",0))
    message=envelope(event.get("job_id","AR-JOB-invalid"),
       source_role=role,error_code=type(exc).__name__[:64],
       original_topic=ROLE_IN[role],attempt=n+1)
    if n<2 and event.get("synthetic") is True:
        # Acknowledged retry to the same input topic. At-least-once duplicates
        # are handled by an idempotency key and immutable report persistence.
        retry={**event,"attempt":n+1}
        time.sleep(min(2**n,2))
        bus.send(ROLE_IN[role],event["job_id"],retry)
    else:
        bus.send(TOPICS["deadletter"],event.get("job_id","AR-JOB-invalid"),message)

def run_role(role: str, *, bus=None, store=None, stop_after:int | None=None):
    if role not in ROLE_IN:
        raise ValueError("Unknown Kafka worker role")
    broker=bus or KafkaBus(group=role)
    db=store or PipelineStore()
    seen=0
    idle_polls=0
    try:
        while stop_after is None or seen<stop_after:
            msg=broker.receive(1)
            if not msg:
                idle_polls+=1
                if stop_after is not None and idle_polls>=35:break
                continue
            idle_polls=0
            if msg.topic!=ROLE_IN[role]:
                # A retry topic is not replayed automatically until a durable
                # attempt log and retry schedule exist; preserve at-least-once safety.
                continue
            try:
                # Durable report is immutable; Kafka can replay after a crash.
                # Once completed, never downgrade or regenerate this job.
                completed=db.read(msg.data["job_id"])
                if completed is not None and completed["state"]=="COMPLETED":
                    broker.ack()
                    seen+=1
                    continue
                out=process_one(role,msg.data,db)
                if out is not None:
                    broker.send(ROLE_OUT[role],msg.key,out)
                broker.ack()
                seen+=1
            except Exception as exc:
                handle_error(role,msg.data,exc,broker)
                db.state(msg.data["job_id"],"REVIEW_REQUIRED")
                broker.ack()
                seen+=1
    finally:
        if bus is None:broker.close()
    return seen

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("role",choices=["topics","validate","investigate","report"])
    args=parser.parse_args()
    if args.role=="topics":
        print("\n".join(create_topics()))
    else:
        run_role(args.role)

if __name__=="__main__":
    main()
