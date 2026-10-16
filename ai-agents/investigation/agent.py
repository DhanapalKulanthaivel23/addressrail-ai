"""Controlled LangGraph workflow: tools -> evidence checks -> optional AI advice."""
import logging
import os
import time
import httpx
from langgraph.graph import StateGraph, START, END
from typing import TypedDict
from .models import InvestigationResult, Finding
from .llm import gemini_explanation
from .tools import PaymentTools, PaymentNotFound, CoreUnavailable
from .go_rules import GoRulesClient, GoRulesUnavailable

log = logging.getLogger("addressrail.investigation")

class State(TypedDict, total=False):
    payment_id: str
    payment: object
    events: list
    error: str | None
    result: InvestigationResult

def _evidence(payment, events, payment_id):
    """Never infer a verified payment status from an LLM output."""
    if not payment.synthetic or payment.id != payment_id:
        return InvestigationResult(payment_id=payment_id, outcome="INSUFFICIENT_EVIDENCE",
            finding=Finding(status="UNKNOWN", explanation="Non-synthetic or mismatched payment evidence was refused.",
                            recommended_action="Request authorised synthetic test evidence."))
    if not events:
        return InvestigationResult(payment_id=payment_id, outcome="INSUFFICIENT_EVIDENCE",
            finding=Finding(status="UNKNOWN", explanation="No payment events are recorded.",
                            recommended_action="Request event history."))
    if any(e.paymentId != payment_id or not e.evidenceRef or not e.source for e in events):
        return InvestigationResult(payment_id=payment_id, outcome="INSUFFICIENT_EVIDENCE",
            finding=Finding(status="UNKNOWN", explanation="Event provenance is missing or does not match the payment.",
                            recommended_action="Reconcile the records before investigation."))
    if any(events[i].occurredAt > events[i+1].occurredAt for i in range(len(events)-1)):
        return InvestigationResult(payment_id=payment_id, outcome="INSUFFICIENT_EVIDENCE",
            finding=Finding(status="UNKNOWN", explanation="Event history is out of chronological order.",
                            recommended_action="Reconcile the timeline."))
    last = events[-1]
    if payment.status != last.type:
        return InvestigationResult(payment_id=payment_id, outcome="INSUFFICIENT_EVIDENCE",
            payment_status=payment.status, last_event_type=last.type,
            finding=Finding(status="CONFLICT", evidence_refs=[last.evidenceRef],
                explanation="Stored payment status conflicts with the last recorded event.",
                recommended_action="Escalate for human investigation of inconsistent evidence."))
    refs = [last.evidenceRef]
    # A single last event establishes only the *recorded synthetic status*.
    # No status here is independently attested by a scheme or settlement provider.
    if last.type == "RJCT":
        finding = Finding(status="RJCT", evidence_refs=refs,
            explanation="The last synthetic event records a payment rejection: " + last.description,
            recommended_action="Have an authorised operator verify the rejection reason and evidence.")
    elif last.type == "PENDING":
        finding = Finding(status="PENDING", evidence_refs=refs,
            explanation="The last synthetic event records a pending payment: " + last.description +
                        " No settlement or beneficiary credit is confirmed.",
            recommended_action="Check liquidity or processing holds with an authorised source; do not assume settlement.")
    elif last.type == "UNKNOWN":
        finding = Finding(status="UNKNOWN", evidence_refs=refs,
            explanation="The synthetic payment outcome is unknown: " + last.description +
                        " A missing response is not evidence of rejection or settlement.",
            recommended_action="Reconcile the payment with authoritative status evidence before retrying or acting.")
    elif last.type == "ACTC":
        finding = Finding(status="ACTC", evidence_refs=refs,
            explanation="The last synthetic event records technical acceptance only. " +
                        "This does not confirm settlement or beneficiary credit.",
            recommended_action="Obtain authoritative subsequent processing and settlement evidence.")
    elif last.type == "ACSC":
        finding = Finding(status="ACSC", evidence_refs=refs,
            explanation="The synthetic record contains an ACSC status. " +
                        "The lab has no independent confirmation from a payment infrastructure.",
            recommended_action="Verify the actual scheme and account outcome with an authorised source.")
    elif last.type == "SIMULATED":
        finding = Finding(status="SIMULATED", evidence_refs=refs,
            explanation="The last event records a completed teaching simulation only. " +
                        "No actual payment transmission, settlement or beneficiary credit occurred in this lab.",
            recommended_action="Do not use the synthetic trace as evidence of real payment completion.")
    else:
        finding = Finding(status="OTHER", evidence_refs=refs,
            explanation="Last recorded synthetic event: " + last.type + ". No additional outcome is established.",
            recommended_action="Review the evidence and confirm the current state with an authorised source.")
    return InvestigationResult(payment_id=payment_id, outcome="EVIDENCE_FOUND",
                               payment_status=payment.status, last_event_type=last.type, finding=finding)


def build_agent(tools: PaymentTools):
    async def fetch(state: State):
        pid=state["payment_id"]
        try:
            payment=await tools.get_payment_status(pid)
            events=await tools.get_payment_history(pid)
            return {"payment":payment,"events":events,"error":None}
        except PaymentNotFound:
            return {"error":"not_found"}
        except (CoreUnavailable, ValueError):
            return {"error":"unavailable"}

    def validate(state: State):
        pid=state["payment_id"]
        err=state.get("error")
        if err:
            absent=err=="not_found"
            result=InvestigationResult(payment_id=pid,
                outcome="NOT_FOUND" if absent else "SERVICE_UNAVAILABLE",
                finding=Finding(status="UNKNOWN" if absent else "UNAVAILABLE",
                    explanation="No matching synthetic payment was found." if absent else "Payment Core evidence is unavailable.",
                    recommended_action="Verify payment reference." if absent else "Retry after service restoration."))
        else:
            result=_evidence(state["payment"],state["events"],pid)
        return {"result":result}

    async def go_cross_check(state: State):
        """Opt-in Go event review is a veto/check, never a status authority."""
        if os.getenv("INVESTIGATION_ENABLE_GO_RULES", "false").lower() != "true":
            return {}
        result = state["result"]
        if result.outcome != "EVIDENCE_FOUND":
            return {}
        try:
            go = await GoRulesClient().reconcile(state["payment"], state["events"])
            # UNKNOWN and PENDING are expected as review-required; mismatched or
            # malformed evidence is NOT permitted through the LLM node.
            risk_ids = {rule.id for rule in go.rules}
            ordinary_review = (
                go.verdict == "REVIEW_REQUIRED"
                and risk_ids <= {"EVT-UNKNOWN", "EVT-PENDING"}
                and result.finding.status in ("UNKNOWN", "PENDING")
            )
            consistent = go.verdict == "CONSISTENT" and not risk_ids
            if not (ordinary_review or consistent):
                return {"result": result.model_copy(update={
                    "outcome": "INSUFFICIENT_EVIDENCE",
                    "finding": Finding(status="CONFLICT",
                        explanation="Independent Go event correlation requires human review.",
                        recommended_action="Investigate source event IDs and timestamps without retrying.",
                        evidence_refs=[]),
                    "go_engine": go.model_dump(),
                })}
            return {"result": result.model_copy(update={"go_engine": go.model_dump()})}
        except (GoRulesUnavailable, ValueError):
            return {"result": result.model_copy(update={
                "outcome": "INSUFFICIENT_EVIDENCE",
                "finding": Finding(status="UNAVAILABLE",
                    explanation="Opt-in independent Go rule checks are unavailable.",
                    recommended_action="Review the authoritative synthetic event trail before continuing."),
                "go_engine": {"verdict": "UNAVAILABLE", "synthetic": True,
                              "settlementAttested": False, "safeToRetry": False},
            })}

    async def explain(state: State):
        result=state["result"]
        text=await gemini_explanation(result)
        return {"result":result.model_copy(update={"ai_explanation":text,"ai_used":bool(text)})}

    graph=StateGraph(State)
    graph.add_node("read_only_tools",fetch)
    graph.add_node("deterministic_guardrails",validate)
    graph.add_node("go_deterministic_cross_check",go_cross_check)
    graph.add_node("optional_ai_explanation",explain)
    graph.add_edge(START,"read_only_tools")
    graph.add_edge("read_only_tools","deterministic_guardrails")
    graph.add_edge("deterministic_guardrails","go_deterministic_cross_check")
    graph.add_edge("go_deterministic_cross_check","optional_ai_explanation")
    graph.add_edge("optional_ai_explanation",END)
    return graph.compile()

async def investigate(payment_id: str, tools: PaymentTools | None = None) -> InvestigationResult:
    start=time.monotonic()
    try:
        graph=build_agent(tools or PaymentTools())
        state=await graph.ainvoke({"payment_id":payment_id})
        result=state["result"]
        # Metadata-only observability; no account details, prompts, key, or raw transaction contents.
        log.info("investigation outcome=%s ai_used=%s duration_ms=%d",
                 result.outcome,result.ai_used,int((time.monotonic()-start)*1000))
        return result
    except Exception:
        log.exception("investigation unexpected_error")  # Caller sees no internal data.
        raise
