import test from 'node:test';
import assert from 'node:assert/strict';
import {mtBusinessIssues,mxBusinessIssues,KNOWN_MT,KNOWN_MX} from '../apps/workbench/message-rules.mjs';
import {reviewRawMessage,MT_EXAMPLE} from '../apps/workbench/raw-review.mjs';

test('MT103 sample has all basic mandatory fields (not official FIN certification)',()=>{
  assert.deepEqual(mtBusinessIssues('MT103',MT_EXAMPLE.split('{4:')[1].split('-}')[0].trim()),[]);
});
test('missing MT103 23B and 71A are named with exact fields',()=>{
  const broken=MT_EXAMPLE.replace(/^:23B:.*$/m,'').replace(/^:71A:.*$/m,'');
  const findings=reviewRawMessage('MT',broken).issues;
  assert.deepEqual(findings.filter(x=>x.code==='DEMO_REQUIRED_FIELD').map(x=>x.path),['/FIN/4/23B','/FIN/4/71A']);
});
test('MT103 invalid 32A calendar month and unsupported fees code are rejected',()=>{
  const broken=MT_EXAMPLE.replace('261020EUR100,00','261320EUR100,00').replace(':71A:SHA',':71A:XXY');
  const issues=reviewRawMessage('MT',broken).issues;
  assert.ok(issues.some(x=>x.path==='/FIN/4/32A'));
  assert.ok(issues.some(x=>x.path==='/FIN/4/71A'));
});
test('MT202 missing related reference and beneficiary institution is not clean',()=>{
  const message=MT_EXAMPLE.replace('{2:I103','{2:I202');
  const issues=reviewRawMessage('MT',message).issues;
  assert.ok(issues.some(x=>x.path==='/FIN/4/21'));
  assert.ok(issues.some(x=>x.path==='/FIN/4/58a'));
});
test('unknown MT identifier is not treated as a validated type',()=>{
  const message=MT_EXAMPLE.replace('{2:I103','{2:I999');
  assert.equal(reviewRawMessage('MT',message).issues.at(-1).code,'DEMO_UNSUPPORTED_MESSAGE');
});
test('pinned MX subset is explicit, not all official ISO versions',()=>{
  assert.ok(KNOWN_MT.includes('MT103'));
  assert.ok(KNOWN_MX.includes('pacs.008.001.14'));
  const unknown=mxBusinessIssues('pacs.009.001.99',{});
  assert.equal(unknown[0].code,'DEMO_UNSUPPORTED_MESSAGE');
});
