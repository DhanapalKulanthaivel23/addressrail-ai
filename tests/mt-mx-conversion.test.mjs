import test from 'node:test';
import assert from 'node:assert/strict';
import {convertMessage} from '../apps/workbench/message-conversion.mjs';
import {MT_EXAMPLE} from '../apps/workbench/raw-review.mjs';

test('MT103 maps only evidenced transaction fields into well-formed ISO draft, not complete scheme validation',()=>{
 const c=convertMessage('MT',MT_EXAMPLE);
 assert.equal(c.ok,true);
 assert.equal(c.identifier,'pacs.008.001.14');
 assert.match(c.output,/<MsgId>AR-DEMO-103<\/MsgId>/);
 assert.match(c.output,/<InstrId>AR-DEMO-103<\/InstrId>/);
 assert.match(c.output,/<IntrBkSttlmAmt Ccy="EUR">100.00<\/IntrBkSttlmAmt>/);
 assert.match(c.output,/<IntrBkSttlmDt>2026-10-20<\/IntrBkSttlmDt>/);
 assert.match(c.output,/<ChrgBr>SHAR<\/ChrgBr>/);
 assert.match(c.output,/<Nm>SYNTHETIC PAYER<\/Nm>/);
 assert.ok(c.diagnostics.some(x=>x.field==='GrpHdr/SttlmInf'));
 assert.ok(c.diagnostics.some(x=>x.field==='23B'));
 assert.equal(c.complete,false);
 assert.ok(!c.output.includes('<EndToEndId>'));
 assert.ok(!c.output.includes('<SttlmMtd>CLRG</SttlmMtd>'));
});
test('Even an erroneous MT103 produces a partial MX draft without invented payment fields',()=>{
 const source=MT_EXAMPLE.replace(/^:32A:.*$/m,'').replace(/^:71A:.*$/m,'');
 const c=convertMessage('MT',source);
 assert.equal(c.ok,true);
 assert.match(c.output,/pacs\.008\.001\.14/);
 assert.ok(!c.output.includes('IntrBkSttlmAmt'));
 assert.ok(!c.output.includes('ChrgBr'));
 assert.ok(c.diagnostics.some(x=>x.field==='32A'));
});
test('MT202 maps to pacs.009 with related-reference handling',()=>{
 const source='{1:F01BANKGB2LAXXX}{2:I202BANKDEFFXXXXN}{4:\n:20:FI-001\n:21:RELATED-002\n:32A:261020USD14,25\n:58A:BANKDEFFXXX\n-}';
 const c=convertMessage('MT',source);
 assert.equal(c.ok,true);
 assert.equal(c.identifier,'pacs.009.001.12');
 assert.match(c.output,/<EndToEndId>RELATED-002<\/EndToEndId>/);
 assert.match(c.output,/<FICdtTrf>/);
});
test('Unknown MT and unsafe/oversized requests fail closed',()=>{
 assert.equal(convertMessage('MT',MT_EXAMPLE.replace('{2:I103','{2:I999')).ok,false);
 assert.equal(convertMessage('MX','<!DOCTYPE Document><Document/>').ok,false);
 assert.equal(convertMessage('MT','x'.repeat(65537)).ok,false);
 assert.equal(convertMessage('MT','').ok,false);
});
test('Escapes XML meta characters in supplied payment references',()=>{
 const msg=MT_EXAMPLE.replace('AR-DEMO-103','A&B<TEST');
 const c=convertMessage('MT',msg);
 assert.ok(c.ok);
 assert.match(c.output,/<MsgId>A&amp;B&lt;TEST<\/MsgId>/);
 assert.ok(!c.output.includes('<MsgId>A&B<TEST</MsgId>'));
});
