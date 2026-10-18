import copy
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import pytest

from saas.event_contract import sign_event, verify_event

KEY=b"test-only-signing-key-not-a-real-production-secret-000000000"
TENANT=str(uuid4())
OTHER=str(uuid4())
PAYLOAD={"event_type":"SYNTHETIC_JOB_PENDING","tenant_id":TENANT,
         "job_id":str(uuid4()),"case_id":str(uuid4()),
         "synthetic":True,"settlement_attested":False,"safe_to_retry":False}

def test_signed_event_accepts_only_exact_tenant_and_fresh_verified_payload():
    stamp=datetime.now(timezone.utc)
    signed=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY,issued_at=stamp)
    assert verify_event(signed,key=KEY,expected_tenant=TENANT,now=stamp)==PAYLOAD
    with pytest.raises(ValueError,match="Tenant mismatch"):
        verify_event(signed,key=KEY,expected_tenant=OTHER,now=stamp)

@pytest.mark.parametrize("field,altered",[
    ("tenant_id",OTHER),("job_id",str(uuid4())),("synthetic",False),
    ("settlement_attested",True),("safe_to_retry",True)])
def test_payload_tampering_rejected(field,altered):
    stamp=datetime.now(timezone.utc)
    signed=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY,issued_at=stamp)
    forged=copy.deepcopy(signed)
    forged["payload"][field]=altered
    with pytest.raises(ValueError):
        verify_event(forged,key=KEY,expected_tenant=TENANT,now=stamp)

def test_event_stale_future_wrong_key_extra_fields_and_weak_key_rejected():
    stamp=datetime.now(timezone.utc)
    signed=sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=KEY,issued_at=stamp)
    for now in (stamp+timedelta(seconds=301),stamp-timedelta(seconds=1)):
        with pytest.raises(ValueError):
            verify_event(signed,key=KEY,expected_tenant=TENANT,now=now)
    with pytest.raises(ValueError):
        verify_event(signed,key=b"other-signing-key-with-adequate-entropy-padding-0000",
                     expected_tenant=TENANT,now=stamp)
    with pytest.raises(ValueError):
        verify_event({**signed,"extra":"untrusted"},key=KEY,expected_tenant=TENANT,now=stamp)
    with pytest.raises(ValueError):
        sign_event(event_id=str(uuid4()),payload=PAYLOAD,key=b"short")
