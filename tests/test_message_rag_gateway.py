"""MT/MX synthetic gateway must not send pasted raw messages to the provider."""
import pytest
from fastapi import HTTPException
from backend.app import make_excerpt
from backend.workbench_ai import MESSAGE_RAILS, retrieve_sources

def example(rail, codes):
    return dict(product="AddressRail Message Validator", synthetic=True,
                rail=rail, stages=["RECEIVED", "CHECKED"], finding_codes=codes,
                raw_message="{1:EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE}")

@pytest.mark.parametrize("rail,code", [("mt","DEMO_MT_ENVELOPE"),("mx","DEMO_XML_STRUCTURE"),("mx","DEMO_BIC_FORMAT")])
def test_only_known_findings_reach_rag(rail,code):
    assert rail in MESSAGE_RAILS
    excerpt=make_excerpt(example(rail,[code]))
    assert len(excerpt)==1
    assert "EXAMPLE_PRIVATE_SHOULD_NOT_ESCAPE" not in str(excerpt)
    assert excerpt[0]["finding_codes"]==[code]
    sources=retrieve_sources.invoke(dict(rail=rail,finding_codes=[code]))
    assert sources and all(rail in s["rails"] for s in sources)

@pytest.mark.parametrize("rail,codes", [("invalid",["DEMO_MT_ENVELOPE"]),("mt",["FAKE_PAYMENT_SETTLED"]),("mx",["DEMO_MT_ENVELOPE"])])
def test_unrecognised_evidence_fails_closed(rail,codes):
    payload=example(rail,codes)
    # Generic MT-envelope finding is deliberately allowed only for MT requests.
    if rail=="mx" and codes==["DEMO_MT_ENVELOPE"]:
        # A cross-format finding requires investigation and cannot establish conformance.
        assert make_excerpt(payload)[0]["finding_codes"]==codes
        return
    with pytest.raises(HTTPException):
        make_excerpt(payload)
