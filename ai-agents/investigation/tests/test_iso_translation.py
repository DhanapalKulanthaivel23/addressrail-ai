import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from investigation.app import app
from investigation.iso_translation import inspect_message,mt_to_mx,mx_to_mt,parse_mx

MT="""{4:
:20:TEST-12345
:23B:CRED
:32A:261017EUR125,00
:50K:SYNTHETIC TRADING
10 TEST STREET
:52A:AAAAGB2L
:57A:BBBBDEFF
:59:SYNTHETIC EXPORTERS
20 TEST ROAD
:70:TEST-INVOICE-1
:71A:SHA
-}"""
CONTEXT={'message_id':'TEST-MSG-1','creation_time':'2026-10-17T12:00:00Z',
         'end_to_end_id':'TEST-E2E-1','settlement_date':'2026-10-17','settlement_method':'INDA'}

@pytest.mark.parametrize('version',['pacs.008.001.13','pacs.008.001.14'])
def test_mt_roundtrip_requires_explicit_loss_acknowledgement(version):
    converted=mt_to_mx(MT,version,CONTEXT,schema_dir='')
    assert converted['status']=='UNVALIDATED_CANDIDATE'
    assert converted['base_schema']['status']=='SCHEMA_UNAVAILABLE'
    assert not converted['unmapped_fields']
    assert converted['explicit_enrichment']==CONTEXT
    assert '125.00' in converted['output'] and '<Ctry>' not in converted['output']
    blocked=mx_to_mt(converted['output'],schema_dir='')
    assert blocked['status']=='LOSS_REQUIRES_ACKNOWLEDGEMENT' and blocked['output'] is None
    assert len(blocked['unmapped_metadata'])==5
    restored=mx_to_mt(converted['output'],allow_metadata_loss=True,schema_dir='')
    assert restored['status']=='LOSSY_REVIEW_CANDIDATE' and restored['output']==MT
    assert restored['safe_to_retry'] is False and restored['settlement_attested'] is False

@pytest.mark.parametrize('family',['pain.001.001.13','pacs.002.001.16','camt.053.001.14','camt.999.999.99'])
def test_generic_parse_is_not_a_schema_or_mapping_claim(family):
    xml=f'<Document xmlns="urn:iso:std:iso:20022:tech:xsd:{family}"><MsgId>TEST-1</MsgId></Document>'
    result=inspect_message(xml,schema_dir='')
    assert result['message_id']==family and result['well_formed']
    assert result['base_schema']['status']=='SCHEMA_UNAVAILABLE'
    assert mx_to_mt(xml,schema_dir='')['status']=='UNSUPPORTED_MAPPING'

@pytest.mark.parametrize('change',[
    lambda x:x.replace(':71A:',':72:TEST-UNMAPPED\n:71A:'),
    lambda x:x.replace(':50K:',':50F:'),
])
def test_unmapped_mt_fields_produce_no_output(change):
    result=mt_to_mx(change(MT),'pacs.008.001.14',CONTEXT,schema_dir='')
    assert result['status']=='UNSUPPORTED_MAPPING' and result['output'] is None

@pytest.mark.parametrize('change',[
    lambda x:x.replace(':20:TEST-12345',':20:TEST-12345\n:20:TEST-SECOND'),
    lambda x:x.replace(':50K:SYNTHETIC',':50K:/TEST-ACCOUNT\nSYNTHETIC'),
    lambda x:x.replace('125,00','125,001'),
    lambda x:x.replace('AAAAGB2L','INVALID'),
    lambda x:x.replace('SYNTHETIC TRADING','SYNTHETIC '+('X'*35)),
    lambda x:x.replace('{4:', '{1:IGNORED}{4:'),
])
def test_duplicate_account_truncation_precision_and_envelope_refused(change):
    with pytest.raises(ValueError): mt_to_mx(change(MT),'pacs.008.001.14',CONTEXT)


def test_mx_unknown_field_is_not_silently_discarded():
    xml=mt_to_mx(MT,'pacs.008.001.14',CONTEXT,schema_dir='')['output']
    xml=xml.replace('</CdtTrfTxInf>','<Purp><Cd>TEST</Cd></Purp></CdtTrfTxInf>')
    result=mx_to_mt(xml,allow_metadata_loss=True,schema_dir='')
    assert result['status']=='UNSUPPORTED_MAPPING' and result['output'] is None
    assert result['unmapped_fields']

@pytest.mark.parametrize('xml',[
    '<!DOCTYPE Document [<!ENTITY a SYSTEM "file:///etc/passwd">]><Document>TEST-1</Document>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14"><MsgId xmlns="evil">TEST-1</MsgId></Document>',
    '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14"><MsgId>TEST-1</MsgId></Document><Document/>',
])
def test_unsafe_xml_refused(xml):
    with pytest.raises(ValueError): parse_mx(xml)


def test_api_opt_in_auth_and_unsupported_mapping(monkeypatch):
    client=TestClient(app)
    body={'synthetic':True,'message':MT,'source_type':'MT103_BLOCK4','target_type':'pain.001.001.13'}
    assert client.post('/api/messages/v1/translate',json=body).status_code==404
    monkeypatch.setenv('ADDRESSRAIL_ENABLE_TRANSLATION','true')
    monkeypatch.setenv('COPILOT_ENABLE_API','true')
    monkeypatch.setenv('COPILOT_API_TOKEN','T'*48)
    assert client.post('/api/messages/v1/translate',json=body).status_code==401
    headers={'Authorization':'Bearer '+'T'*48}
    result=client.post('/api/messages/v1/translate',json=body,headers=headers)
    assert result.status_code==200 and result.json()['status']=='UNSUPPORTED_MAPPING'
    assert result.headers['cache-control']=='no-store'
    assert client.post('/api/messages/v1/translate',json=body,headers={**headers,'Origin':'https://evil.example'}).status_code==403

@pytest.mark.parametrize('version',['pacs.008.001.13','pacs.008.001.14'])
def test_actual_published_base_schema(version):
    result=mt_to_mx(MT,version,CONTEXT,schema_dir=os.getenv('ADDRESSRAIL_PUBLISHED_XSD_TEST_DIR',str(Path(__file__).resolve().parents[3]/'schemas'/'iso20022')))
    assert result['status']=='BASE_XSD_VALID_CANDIDATE',result['base_schema']
    assert result['base_schema']['certified_cbpr'] is False


@pytest.mark.parametrize('version',['pacs.008.001.13','pacs.008.001.14'])
def test_reverse_translation_fail_closed_when_installed_xsd_rejects_source(version):
    schema_dir=str(Path(__file__).resolve().parents[3]/'schemas'/'iso20022')
    candidate=mt_to_mx(MT,version,CONTEXT,schema_dir=schema_dir)
    assert candidate['status']=='BASE_XSD_VALID_CANDIDATE'
    # Changing the amount attribute to an invalid ISO currency token retains
    # the same mapped field shape but violates the actual published base XSD.
    malformed=candidate['output'].replace('Ccy="EUR"', 'Ccy="EURO"')
    rejected=mx_to_mt(malformed,allow_metadata_loss=True,schema_dir=schema_dir)
    assert rejected['status']=='SOURCE_SCHEMA_REJECTED'
    assert rejected['output'] is None
    assert rejected['base_schema']['status']=='BASE_XSD_INVALID'
    assert rejected['safe_to_retry'] is False
