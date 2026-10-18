import test from 'node:test';
import assert from 'node:assert/strict';
import {FICTIONAL_WATCHLIST,screenSyntheticPayment,addFictionalEntry,simulateChannel,CHANNELS} from '../web/studio/shared/learning-tools.mjs';
import {generateFixture} from '../web/studio/payment-intelligence/engine.mjs';
const fresh=()=>generateFixture('cbpr');
test('fictional watchlist has no third-party source and is deterministic',()=>{
 assert.equal(FICTIONAL_WATCHLIST.length,3);
 assert.ok(FICTIONAL_WATCHLIST.every(x=>x.id.startsWith('DEMO-')));
 const result=screenSyntheticPayment(fresh());
 assert.equal(result.outcome,'POTENTIAL_MATCH');
 assert.equal(result.matches.length,1);
 assert.equal(result.matches[0].party,'creditor');
 assert.equal(result.matches[0].rule,'FICTIONAL_EXACT_NAME');
 assert.equal(result.matches[0].score,100);
 assert.equal(result.networkSubmitted,false);
 assert.equal(result.ai.status,'DETERMINISTIC_FALLBACK');
 assert.deepEqual(screenSyntheticPayment(fresh()),result);
});
test('false positives are review findings, not real sanctions conclusions',()=>{
 const input=fresh();input.debtor.name='SYNTHETIC RECEIVER LTD';input.creditor.name='TRAINING CLEAR COMPANY';
 const output=screenSyntheticPayment(input);
 assert.equal(output.matches.length,1);
 assert.equal(output.matches[0].disposition,'REVIEW_REQUIRED');
 assert.equal(output.outcome,'POTENTIAL_MATCH');
 const clean=fresh();clean.debtor.name='NOVEL TRAINING PAYER';clean.creditor.name='ANOTHER FICTIONAL PAYEE';
 assert.equal(screenSyntheticPayment(clean).outcome,'NO_MATCH');
});
test('temporary records are bounded; duplicates and unsynthetic payments are refused',()=>{
 const added=addFictionalEntry('FICTIONAL LEARNING BANK');
 assert.equal(added.category,'SESSION_FICTIONAL');
 const matches=screenSyntheticPayment({...fresh(),debtor:{...fresh().debtor,name:added.name}},[added]);
 assert.equal(matches.outcome,'POTENTIAL_MATCH');
 assert.throws(()=>addFictionalEntry(added.name,[added]),/already exists/);
 assert.throws(()=>addFictionalEntry('a'),/at least four/);
 assert.throws(()=>screenSyntheticPayment({...fresh(),synthetic:false}),/synthetic/);
 assert.throws(()=>screenSyntheticPayment({...fresh(),reference:'bad reference'}),/reference/);
 assert.throws(()=>screenSyntheticPayment({...fresh(),padding:'X'.repeat(18500)}),/18 KB/);
});
test('REST MQ Kafka File SFTP return reproducible mocked channel evidence',()=>{
 const input=fresh();
 for(const channel of CHANNELS){
  const one=simulateChannel(input,{channel}),two=simulateChannel(input,{channel});
  assert.deepEqual(one,two);assert.equal(one.synthetic,true);
  assert.equal(one.transport,'SIMULATED_ONLY');
  assert.equal(one.brokerConnected,false);assert.equal(one.fileTransferred,false);
  assert.equal(one.events.length,2);assert.match(one.idempotencyKey,/^SIM-/);
 }
 assert.throws(()=>simulateChannel(input,{channel:'SWIFT'}),/Unsupported/);
 assert.throws(()=>simulateChannel(input,{attempt:11}),/attempt/);
 assert.throws(()=>simulateChannel({...input,educationalOnly:false}),/synthetic/);
});
