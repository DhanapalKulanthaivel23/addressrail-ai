"""Staging-only server-to-server bridge to the PRIVATE synthetic network.

The public source contains *only* the documented API contract, not private
network algorithms. Never use for real payments or expose localhost lab.
"""
from __future__ import annotations

import hashlib
import os
import re
from urllib.parse import urlsplit
from uuid import UUID

import httpx

REF=re.compile(r"[A-Za-z0-9_-]{4,60}\Z")
STATES={"AWAITING_BANK","BANK_RESPONSE_RECEIVED","BANK_RESPONSE_PENDING","DEAD_LETTER"}
BANK_STATUSES={None,"BANK_ACCEPTED","BANK_REJECTED","BANK_PENDING"}
PREFIXES={"ACCEPT":"SIMOK_","REJECT":"SIMRJCT_","PENDING":"SIMWAIT_"}

def network_config():
    if os.getenv("SAAS_ENABLE_NETWORK_BRIDGE")!="true":
        raise ValueError("Private network staging bridge disabled")
    raw=os.environ.get("SAAS_SIM_NETWORK_URL","")
    parsed=urlsplit(raw)
    # Only a loopback service on the SAME host is permitted in this staging
    # boundary. No arbitrary tenant-selected host, DNS or redirects.
    if (parsed.scheme!="http" or parsed.hostname!="127.0.0.1"
        or parsed.port is None or parsed.path not in ("","/")
        or parsed.username or parsed.password or parsed.query or parsed.fragment):
        raise ValueError("Private network must be on explicit loopback port")
    key=os.getenv("SAAS_SIM_NETWORK_SERVICE_KEY","")
    if len(key)<32 or len(key)>256:
        raise ValueError("Missing private network test-only service key")
    return raw.rstrip("/"),key

def scoped_reference(tenant:str,reference:str,scenario:str):
    UUID(tenant)
    if not isinstance(reference,str) or not REF.fullmatch(reference) or scenario not in PREFIXES:
        raise ValueError("Invalid synthetic simulation input")
    digest=hashlib.sha256((tenant+"\0"+reference).encode("ascii")).hexdigest()[:28].upper()
    return PREFIXES[scenario]+digest

def _request(method,path,payload=None):
    url,token=network_config()
    with httpx.Client(timeout=5,trust_env=False,follow_redirects=False) as client:
        try:
            response=client.request(method,url+path,
                       headers={"X-Sim-Service-Key":token,
                                "Accept":"application/json"},
                       json=payload)
            if response.status_code not in (200,202):
                raise ValueError("Private synthetic network rejected/unavailable")
            if len(response.content)>12000:
                raise ValueError("Unbounded private network result")
            data=response.json()
        except (httpx.HTTPError,ValueError,TypeError) as exc:
            raise ValueError("Private synthetic network unavailable or invalid") from exc
    if not isinstance(data,dict):
        raise ValueError("Invalid private network envelope")
    return data

def check_status(data,expected_id=None,initial=False):
    if (data.get("synthetic") is not True or data.get("settled") is not False
        or data.get("network_ack")!="SIMULATED_ACK"
        or data.get("state") not in STATES
        or data.get("bank_status") not in BANK_STATUSES):
        raise ValueError("Untrusted private network status")
    if (data["state"]=="AWAITING_BANK" or data["state"]=="DEAD_LETTER") and data["bank_status"] is not None:
        raise ValueError("Unresolved network payment claims business outcome")
    if data["state"]=="BANK_RESPONSE_PENDING" and data["bank_status"]!="BANK_PENDING":
        raise ValueError("Contradictory synthetic pending response")
    if data["state"]=="BANK_RESPONSE_RECEIVED" and data["bank_status"] not in {"BANK_ACCEPTED","BANK_REJECTED"}:
        raise ValueError("Contradictory synthetic final response")
    message_id=data.get("message_id")
    try:
        parsed=str(UUID(message_id))
    except (ValueError,TypeError,AttributeError) as exc:
        raise ValueError("Missing network correlation identifier") from exc
    if parsed!=message_id or expected_id is not None and expected_id!=message_id:
        raise ValueError("Network payment identity mismatch")
    return {"state":data["state"],"network_ack":data["network_ack"],
            "bank_status":data["bank_status"],"synthetic":True,"settled":False}

def submit(tenant,reference,scenario):
    remote_ref=scoped_reference(tenant,reference,scenario)
    payload={"rail":"SWIFT_CBPR","sender_bic":"BANKAA22","receiver_bic":"BANKBB33",
             "reference":remote_ref,"message_format":"PACS008",
             "payload":"<Synthetic/>","synthetic":True}
    data=_request("POST","/v1/async/messages",payload)
    return data["message_id"],check_status(data,initial=True)

def status(message_id):
    canonical=str(UUID(message_id))
    data=_request("GET","/v1/async/messages/"+canonical)
    return check_status(data,expected_id=canonical)
