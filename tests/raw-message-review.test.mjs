import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRawMessage,MT_EXAMPLE} from '../apps/workbench/raw-review.mjs';
test('MT103 synthetic sample parses as envelope only',()=>{
 const r=reviewRawMessage('MT',MT_EXAMPLE);
 assert.equal(r.identifier,'MT103');assert.equal(r.issues.length,0);
 assert.equal(r.schemaValidated,false);assert.equal(r.schemeValidated,false);
});
test('missing FIN terminator may be safely appended and rechecked',()=>{
 const broken=MT_EXAMPLE.slice(0,-2);
 const r=reviewRawMessage('MT',broken);
 assert.equal(r.issues[0].code,'DEMO_MT_ENVELOPE');
 assert.ok(r.proposal);
 assert.equal(reviewRawMessage('MT',r.proposal.corrected).issues.length,0);
});
test('unknown or malformed inputs never invent fields',()=>{
 const cases=['{2:I999BANKDEFFXXXXN}{4:\n:20:TEST\n-}','{1:F01BANKGB2LAXXX}{2:I103BANKDEFFXXXXN}{4:\n:20:\n-}'];
 for(const value of cases){const r=reviewRawMessage('MT',value);assert.ok(r.issues.length);assert.equal(r.proposal,null)}
});
test('invalid families, oversized messages and empty input are rejected',()=>{
 assert.throws(()=>reviewRawMessage('JSON','{}'));
 assert.equal(reviewRawMessage('MX','').validated,false);
 assert.equal(reviewRawMessage('MX','x'.repeat(65537)).validated,false);
});
