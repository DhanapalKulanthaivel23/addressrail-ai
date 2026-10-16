"""Read-only LangGraph RAG copilot across Java evidence, Go rules and Gemini.

No payment/approval mutation tools. Fails closed on missing evidence or Go errors;
a model generates *advice only*, never authoritative payment state.
"""
from __future__ import annotations
import os
import re
from typing import TypedDict
import httpx
from langgraph.graph import StateGraph, START, END
from pydantic import BaseModel, ConfigDict, Field
from .agent import _evidence
from .models import InvestigationResult, Finding
from .tools import PaymentTools, PaymentNotFound, CoreUnavailable
from .go_rules import GoRulesClient, GoRulesUnavailable
from .rag import KnowledgeStore, Citation, standard_store, INJECTION
from .copilot_llm import invoke_gemini, ModelAttempt

PAYMENT_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
PII_PATTERN = re.compile(r"(?i)([\w.+-]+@[\w.-]+\.[a-z]{2,}|"
                         r"\b(?:\+44|0044|0)7\d{9}\b|"
                         r"\b(?:\d[ -]*?){14,19}\b)")
RAILS=("SCT_INST","SCT","SDD","CHAPS","FPS","BACS","T2","CBPR","CLS","ISO")
MAX_XML=48000

class CopilotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,80}$")
    question: str = Field(min_length=5,max_length=360)
    synthetic_xml: str | None = Field(default=None,max_length=48000)

class CopilotResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_id: str
    rail: str
    status: str
    outcome: str
    evidence_refs: list[str]
    go_findings: list[dict]
    citations: list[dict]
    explanation: str | None
    ai_used: bool
    ai_model: str | None
    ai_reason: str
    guardrails: list[str]
    requires_human_review: bool = True
    settlement_attested: bool = False
    safe_to_retry: bool = False
    synthetic: bool = True
    notice: str = "Educational synthetic evidence only; no authoritative scheme confirmation."

def select_rail(scheme: str) -> str:
    name=scheme.upper()
    if "INSTANT" in name or "SCT INST" in name or "SCT_INST" in name:
        return "SCT_INST"
    for x in RAILS:
        if x in name:
            return x
    return "ISO"

def validate_request(req: CopilotRequest) -> None:
    if INJECTION.search(req.question) or PII_PATTERN.search(req.question):
        raise ValueError("Untrusted commands or potential customer identifiers in question")
    if req.synthetic_xml is not None:
        sample=req.synthetic_xml
        if (len(sample)<10 or len(sample)>MAX_XML or
            PII_PATTERN.search(sample) or
            not any(x in sample.upper() for x in ("AR-DEMO","SYNTHETIC","TEST-"))):
            raise ValueError("Only bounded fictional XML without obvious personal data is accepted")
    # This is a conservative filter, NOT production-grade PII detection.

class State(TypedDict,total=False):
    req: CopilotRequest
    payment: object
    events: list
    finding: InvestigationResult
    rail: str
    rules: list
    citations: list
    go_error: str | None
    attempt: ModelAttempt | None
    error: str | None

def make_graph(tools: PaymentTools, go: GoRulesClient | None,
               knowledge: KnowledgeStore, model_client: httpx.AsyncClient | None,
               model_key: str | None):
    async def read(state: State):
        req=state["req"]
        try:
            payment=await tools.get_payment_status(req.payment_id)
            events=await tools.get_payment_history(req.payment_id)
            return {"payment":payment,"events":events,"rail":select_rail(payment.scheme)}
        except PaymentNotFound:
            return {"error":"not_found","rail":"ISO"}
        except (CoreUnavailable,ValueError,TypeError):
            return {"error":"core_unavailable","rail":"ISO"}

    def evidence(state: State):
        if "error" in state:
            return {"finding":InvestigationResult(payment_id=state["req"].payment_id,
                outcome="NOT_FOUND" if state["error"]=="not_found" else "SERVICE_UNAVAILABLE",
                finding=Finding(status="UNAVAILABLE",
                     explanation="Synthetic source payment evidence is unavailable.",
                     recommended_action="Ask an authorised operator for valid source evidence."))}
        return {"finding":_evidence(state["payment"],state["events"],state["req"].payment_id)}

    async def go_rules(state: State):
        found=state["finding"]
        if found.outcome!="EVIDENCE_FOUND":
            return {"rules":[]}
        if go is None:
            return {"rules":[],"go_error":"go_disabled"}
        try:
            checked=await go.reconcile(state["payment"],state["events"])
            rule_ids={r.id for r in checked.rules}
            allowed_review=(found.payment_status in ("UNKNOWN","PENDING")
                and checked.verdict=="REVIEW_REQUIRED"
                and rule_ids and rule_ids<={"EVT-UNKNOWN","EVT-PENDING"})
            if not (checked.verdict=="CONSISTENT" and not rule_ids or allowed_review):
                return {"rules":[],"go_error":"go_inconsistent"}
            rules=[r.model_dump() for r in checked.rules]
            if state["req"].synthetic_xml:
                xml=await go.inspect_xml(state["rail"],state["req"].synthetic_xml)
                if not xml.wellFormed:
                    # Report invalid XML as findings, but never send source XML to LLM.
                    rules.extend(r.model_dump() for r in xml.rules)
                else:
                    rules.extend(r.model_dump() for r in xml.rules)
            return {"rules":rules}
        except (GoRulesUnavailable,ValueError,httpx.HTTPError):
            return {"rules":[],"go_error":"go_unavailable"}

    def retrieve(state: State):
        if state["finding"].outcome!="EVIDENCE_FOUND" or state.get("go_error"):
            return {"citations":[]}
        found=state["finding"]
        try:
            query=state["req"].question+" "+state["rail"]+" "+found.finding.status
            citations=knowledge.search(query,rail=state["rail"],limit=3)
            return {"citations":citations}
        except ValueError:
            return {"citations":[]}

    async def explain(state: State):
        if (state["finding"].outcome!="EVIDENCE_FOUND" or
            state.get("go_error") or not state.get("citations")):
            return {}
        model=await invoke_gemini(state["finding"],state["req"].question,
                                  state["citations"],state["rules"],
                                  client=model_client,key=model_key)
        return {"attempt":model}

    graph=StateGraph(State)
    for name,func in (("read_payment_tools",read),("check_evidence",evidence),
                      ("go_deterministic_rules",go_rules),("versioned_vector_retrieval",retrieve),
                      ("managed_gemini_optional",explain)):
        graph.add_node(name,func)
    graph.add_edge(START,"read_payment_tools")
    graph.add_edge("read_payment_tools","check_evidence")
    graph.add_edge("check_evidence","go_deterministic_rules")
    graph.add_edge("go_deterministic_rules","versioned_vector_retrieval")
    graph.add_edge("versioned_vector_retrieval","managed_gemini_optional")
    graph.add_edge("managed_gemini_optional",END)
    return graph.compile()

async def run_copilot(req: CopilotRequest, *, tools: PaymentTools | None = None,
                      go: GoRulesClient | None = None, knowledge: KnowledgeStore | None = None,
                      model_client: httpx.AsyncClient | None = None,
                      model_key: str | None = None) -> CopilotResponse:
    validate_request(req)
    if go is None and os.getenv("COPILOT_REQUIRE_GO","true").lower()=="true":
        go=GoRulesClient()
    result=await make_graph(tools or PaymentTools(),go,knowledge or standard_store(),
                            model_client,model_key).ainvoke({"req":req})
    finding=result["finding"]
    citations: list[Citation]=result.get("citations",[])
    rules=result.get("rules",[])
    attempt=result.get("attempt")
    # No inferred payment state: evidence result is the source, including failure.
    return CopilotResponse(
        payment_id=req.payment_id,rail=result.get("rail","ISO"),
        status=finding.finding.status,outcome=finding.outcome,
        evidence_refs=finding.finding.evidence_refs,go_findings=rules,
        citations=[{"id":x.id,"version":x.version,"effective_date":x.effective_date,
                    "reviewed":x.reviewed,"url":x.url,"summary":x.excerpt} for x in citations],
        explanation=attempt.answer if attempt and attempt.accepted else None,
        ai_used=bool(attempt and attempt.accepted),
        ai_model=attempt.model if attempt and attempt.accepted else None,
        ai_reason=attempt.reason if attempt else ("human_review_required" if result.get("go_error") else
            "no_retrieval_evidence" if not citations else "model_not_invoked"),
        guardrails=(["synthetic_only","payment_status_immutable","citation_ids_checked",
                     "go_rule_ids_checked","no_payment_action_tools","human_review_required"]
                    + ([result["go_error"]] if result.get("go_error") else [])))
