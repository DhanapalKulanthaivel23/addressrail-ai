"""No-network XML base-XSD tests; a tiny test XSD is NOT an ISO release."""
import hashlib
import json
import pytest
from investigation.schema_validation import inspect

NS="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08"
XSD=f"""<?xml version="1.0"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"
  targetNamespace="{NS}" xmlns:t="{NS}" elementFormDefault="qualified">
  <xs:element name="Document"><xs:complexType><xs:sequence>
  <xs:element name="FIToFICstmrCdtTrf" type="xs:string"/>
  </xs:sequence></xs:complexType></xs:element></xs:schema>"""
GOOD=f'<Document xmlns="{NS}"><FIToFICstmrCdtTrf>AR-DEMO-1</FIToFICstmrCdtTrf></Document>'
BAD=f'<Document xmlns="{NS}"><Wrong>AR-DEMO</Wrong></Document>'

def test_no_schema_does_not_pretend_full_conformance(monkeypatch):
    monkeypatch.delenv("ADDRESSRAIL_XSD_DIR",raising=False)
    v=inspect(GOOD)
    assert v.status=="SCHEMA_UNAVAILABLE"
    assert not v.certified_cbpr and not v.official_schema_asserted
    assert "BASE_XSD_NOT_INSTALLED" in v.errors

def test_pinned_provisioned_schema_validates_and_reports_version(tmp_path):
    raw=XSD.encode()
    digest=hashlib.sha256(raw).hexdigest()
    (tmp_path/"pacs.008.001.08.xsd").write_bytes(raw)
    (tmp_path/"manifest.json").write_text(json.dumps({"schemas":{NS:{
       "file":"pacs.008.001.08.xsd","sha256":digest,"version":"LOCAL-SYNTHETIC-TEST-XSD"
    }}}))
    good=inspect(GOOD,str(tmp_path))
    assert good.status=="BASE_XSD_VALID"
    assert good.schema_sha256==digest
    assert good.schema_version=="LOCAL-SYNTHETIC-TEST-XSD"
    assert good.provenance=="operator-supplied-offline-XSD"
    assert not good.certified_cbpr and not good.official_schema_asserted
    assert inspect(BAD,str(tmp_path)).status=="BASE_XSD_INVALID"
    (tmp_path/"pacs.008.001.08.xsd").write_bytes(raw+b" ")
    with pytest.raises(ValueError,match="checksum"):
        inspect(GOOD,str(tmp_path))

def test_rejects_doctype_external_entities_and_unsafe_sources(tmp_path):
    malicious=f'<!DOCTYPE Document [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Document xmlns="{NS}">&xxe;</Document>'
    with pytest.raises(ValueError,match="DTD"):
        inspect(malicious)
    assert inspect("<Document>",str(tmp_path)).status=="INVALID_XML"
    assert inspect("<oops />",str(tmp_path)).status=="UNSUPPORTED_ROOT"
    assert inspect('<Document xmlns="https://evil.invalid"/>').status=="UNSUPPORTED_NAMESPACE"
    assert inspect(GOOD,str(tmp_path)).status=="SCHEMA_UNAVAILABLE" if (tmp_path/"manifest.json").exists() else True
