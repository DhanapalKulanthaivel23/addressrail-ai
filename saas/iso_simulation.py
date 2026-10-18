"""Public API contract for a narrowly scoped, fictional ISO pacs.008 demo.

No proprietary network code or official Swift market-practice rules are here.
The PRIVATE SAA performs the actual pinned ISO base-XSD validation; this file
only creates deterministic, fictional, single-transaction public test inputs.
"""
import hashlib
from decimal import Decimal
from uuid import UUID

from saas import network_bridge

PINNED={
    "13":("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.13",
          "118183330dbdded59219efac775149660d7d32527cadc218ca5d97df07f2f481",
          "ISO-published-pacs.008.001.13-2025-02-27"),
    "14":("urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14",
          "e054014aabeb99ba0a59ddaaa9d925eb717f3c75e591551f246bddebc0764306",
          "ISO-published-pacs.008.001.14-2026-03-19")
}

def iso_reference(tenant,reference,scenario):
    UUID(tenant)
    if not isinstance(reference,str) or not network_bridge.REF.fullmatch(reference):
        raise ValueError("Invalid synthetic client reference")
    if scenario not in network_bridge.PREFIXES:
        raise ValueError("Invalid synthetic scenario")
    # ISO Max35Text EndToEndId: <=35 chars even with SIMRJCT_ prefix.
    digest=hashlib.sha256((tenant+"\\0"+reference).encode("ascii")).hexdigest()[:26].upper()
    return network_bridge.PREFIXES[scenario]+digest

def fixture(tenant,reference,scenario,version,amount_minor):
    if version not in PINNED or type(amount_minor) is not int or not 1<=amount_minor<=10**9:
        raise ValueError("Unsupported synthetic version or amount")
    remote_ref=iso_reference(tenant,reference,scenario)
    namespace=PINNED[version][0]
    amount=f"{Decimal(amount_minor)/100:.2f}"
    # A constant *fictional* creation time ensures the same request bytes on
    # retries after outages, avoiding downstream idempotency conflicts.
    xml=f'''<Document xmlns="{namespace}">
  <FIToFICstmrCdtTrf>
    <GrpHdr><MsgId>SIM-{remote_ref[-26:]}</MsgId>
      <CreDtTm>2026-01-01T00:00:00Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>INDA</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId><EndToEndId>{remote_ref}</EndToEndId></PmtId>
      <IntrBkSttlmAmt Ccy="EUR">{amount}</IntrBkSttlmAmt>
      <ChrgBr>SHAR</ChrgBr>
      <Dbtr><Nm>Fictional Sender</Nm></Dbtr>
      <DbtrAgt><FinInstnId><BICFI>BANKAA22</BICFI></FinInstnId></DbtrAgt>
      <CdtrAgt><FinInstnId><BICFI>BANKBB33</BICFI></FinInstnId></CdtrAgt>
      <Cdtr><Nm>Fictional Receiver</Nm></Cdtr>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>'''
    return remote_ref,xml

def verify_attestation(data,version,reference):
    expected_namespace,expected_digest,expected_version=PINNED[version]
    evidence=data.get("iso_base_validation")
    if not isinstance(evidence,dict) or any((
        evidence.get("result")!="BASE_XSD_VALID",
        evidence.get("namespace")!=expected_namespace,
        evidence.get("schema_sha256")!=expected_digest,
        evidence.get("schema_version")!=expected_version,
        evidence.get("original_reference")!=reference,
        evidence.get("synthetic") is not True,
        evidence.get("settled") is not False,
        evidence.get("certified_cbpr") is not False,
        evidence.get("swift_usage_guidelines_checked") is not False,
        data.get("scheme_conformance")!="NOT_ASSESSED",
        data.get("settled") is not False,
    )):
        raise ValueError("Untrusted or mismatched pinned ISO base-XSD result")
    return {
        "result":"BASE_XSD_VALID",
        "namespace":expected_namespace,
        "schema_sha256":expected_digest,
        "schema_version":expected_version,
        "cbpr_conformance":"NOT_ASSESSED"
    }

def submit(tenant,reference,scenario,version,amount_minor):
    remote_ref,xml=fixture(tenant,reference,scenario,version,amount_minor)
    payload={"rail":"SWIFT_CBPR","sender_bic":"BANKAA22","receiver_bic":"BANKBB33",
             "reference":remote_ref,"message_format":"PACS008",
             "payload":xml,"synthetic":True}
    response=network_bridge._request("POST","/v1/validate-iso-pacs008-async",payload)
    # Never store a remote ID or tell a tenant ACK was accepted without both
    # checked settlement=false and base-XSD provenance.
    status=network_bridge.check_status(response)
    attestation=verify_attestation(response,version,remote_ref)
    return response["message_id"],status,attestation
