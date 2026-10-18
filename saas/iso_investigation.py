"""Deterministic, tenant-safe fictional payment investigation report builder.

Bank/network status is always derived from a previously validated private API
response, not the model or the client's requested simulation scenario.
Retrieval uses fixed vetted records from the existing curated RAG catalogue.
This is a bounded evidence lookup, NOT a live Gemini inference or scheme UG.
"""
from __future__ import annotations
import hashlib
import json
from pathlib import Path
import uuid

ALLOWED=("ISO-BASE-VS-PROFILE","SWIFT-TRACKER-NO-SETTLEMENT")
CATALOGUE=(Path(__file__).resolve().parents[1]/"ai-agents"/"investigation"/
           "knowledge"/"catalogue.json")
STATUSES={
    "BANK_REJECTED":("RJCT",
        "The fictional beneficiary bank rejected this synthetic payment. Review the bank rejection and original evidence before taking any action."),
    "BANK_ACCEPTED":("UNKNOWN",
        "The fictional bank accepted this synthetic payment message. This is not proof of settlement, beneficiary credit, or successful screening."),
}
def case_id(tenant,reference):
    return uuid.uuid5(uuid.NAMESPACE_URL,"addressrail-iso-investigation-v1/"+tenant+"/"+reference)

def curated_citations():
    doc=json.loads(CATALOGUE.read_text(encoding="utf-8"))
    records={item["id"]:item for item in doc["records"]}
    result=[]
    for ident in ALLOWED:
        item=records[ident]
        if (not item["url"].startswith("https://") or not item["version"]
            or not item["reviewed"] or len(item["facts"])>1200):
            raise ValueError("Invalid curated source metadata")
        result.append({"id":item["id"],"version":item["version"],
                       "reviewed":item["reviewed"],"url":item["url"],
                       "context":item["facts"]})
    return result

def build(reference,version,amount_minor,schema_hash,status):
    if version not in ("13","14") or not isinstance(reference,str):
        raise ValueError("Invalid synthetic ISO report input")
    if not isinstance(schema_hash,str) or len(schema_hash)!=64:
        raise ValueError("Missing pinned base-XSD provenance")
    if (not isinstance(status,dict) or status.get("synthetic") is not True
        or status.get("settled") is not False or
        status.get("network_ack")!="SIMULATED_ACK" or
        status.get("state")!="BANK_RESPONSE_RECEIVED"):
        raise ValueError("Cannot investigate unresolved or untrusted synthetic response")
    bank_status=status.get("bank_status")
    if bank_status not in STATUSES:
        raise ValueError("No authoritative synthetic final bank outcome")
    case_status,explanation=STATUSES[bank_status]
    evidence=[
        "ISO-BASE-XSD-V"+version,
        "SIMULATED_NETWORK_ACK",
        "SYNTHETIC_BANK_STATUS_"+bank_status,
    ]
    citations=curated_citations()
    provenance=hashlib.sha256(json.dumps({
        "reference":reference,"version":version,"amount_minor":amount_minor,
        "schema_sha256":schema_hash,"bank_status":bank_status,
        "network_state":status["state"],"evidence_refs":evidence,
    },sort_keys=True,separators=(",",":")).encode()).hexdigest()
    report={
        "origin":"ADDRESSRAIL_DETERMINISTIC_SYNTHETIC_NETWORK_SNAPSHOT",
        "source_method":"CURATED_REFERENCE_LOOKUP_NOT_LLM_RAG",
        "reference":reference,"message_family":"pacs.008",
        "iso_version":version,"amount_minor":amount_minor,"currency":"EUR",
        "simulated_status":case_status,
        "bank_status":bank_status,"network_state":status["state"],
        "network_ack":"SIMULATED_ACK","validation_result":"BASE_XSD_VALID",
        "schema_sha256":schema_hash,"cbpr_conformance":"NOT_ASSESSED",
        "validation_rule_ids":["ISO-BASE-XSD-V"+version],
        "evidence_refs":evidence,"source_citation_ids":[c["id"] for c in citations],
        "source_citations":citations,
        "explanation":explanation,
        "evidence_fingerprint":provenance,
        "explanation_origin":"DETERMINISTIC_TEMPLATE",
        "ai_model_used":False,
        "synthetic":True,"requires_human_review":True,
        "settlement_attested":False,"safe_to_retry":False,"settled":False,
    }
    return case_status,report
