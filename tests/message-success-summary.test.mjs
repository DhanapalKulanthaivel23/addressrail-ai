import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeMessage} from '../apps/workbench/message-summary.mjs';
import {reviewRawMessage,MT_EXAMPLE} from '../apps/workbench/raw-review.mjs';

test('successful local MT103 check yields actual reference/currency/amount/date, not AI boilerplate',()=>{
 const checked=reviewRawMessage('MT',MT_EXAMPLE);
 assert.deepEqual(checked.issues,[]);
 const details=Object.fromEntries(summarizeMessage('MT',MT_EXAMPLE,checked.identifier).map(x=>[x.label,x.value]));
 assert.deepEqual(details,{
   'Message type':'MT103',
   'Reference':'AR-DEMO-103',
   'Value date (YYMMDD)':'261020',
   'Currency':'EUR',
   'Amount':'100,00',
   'Charges':'SHA'
 });
});
test('summary never invents unprovided references or amount',()=>{
 const fields=Object.fromEntries(summarizeMessage('MT','{1:F01BANKGB2LAXXX}{2:I202BANKDEFFXXXXN}{4:\n:20:ABC\n-}','MT202').map(x=>[x.label,x.value]));
 assert.equal(fields.Reference,'ABC');
 assert.equal(fields['Related reference'],undefined);
 assert.equal(fields.Amount,undefined);
 assert.equal(fields.Currency,undefined);
});
