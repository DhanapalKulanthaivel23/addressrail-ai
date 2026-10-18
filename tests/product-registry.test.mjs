import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCTS,PRODUCT_GROUPS,getProduct,postmanCollection} from '../web/studio/shared/product-registry.mjs';
import {executeDemo} from '../web/studio/shared/demo-engine.mjs';
import {generateFixture} from '../web/studio/payment-intelligence/engine.mjs';
const request=(id='sct',scenario='baseline')=>({contractVersion:1,synthetic:true,productId:id,scenarioId:scenario,syntheticEpoch:'2026-10-18T00:00:00.000Z',payload:generateFixture(id,scenario)});
test('all contexts have one registry group and conservative coverage',()=>{
 assert.equal(new Set(PRODUCTS.map(p=>p.id)).size,PRODUCTS.length);
 for(const p of PRODUCTS){
  assert.equal(PRODUCT_GROUPS.filter(g=>g.children.includes(p.id)).length,1);
  assert.equal(p.implementation.status,'PARTIAL');assert.ok(Object.isFrozen(p));
  assert.equal(p.messageVersions.length,0);assert.equal(p.standardsReleases.length,0);
  assert.ok(p.implementation.evidence.length);
  assert.ok(p.transformations.every(t=>t.capability.status==='PENDING'));
 }
 assert.throws(()=>getProduct('__proto__'));assert.equal(postmanCollection().item.length,0);
});
test('all registered scenarios reproduce execution evidence without mutation',()=>{
 for(const p of PRODUCTS)for(const s of p.scenarios){
  const input=request(p.id,s.id),before=JSON.stringify(input),first=executeDemo(input);
  assert.deepEqual(first,executeDemo(input));assert.equal(JSON.stringify(input),before);
  assert.equal(first.steps.length,2);assert.equal(first.steps[0].syntheticTimestamp,input.syntheticEpoch);
  assert.equal(first.steps[1].syntheticTimestamp,'2026-10-18T00:00:01.000Z');
  assert.deepEqual(first.steps[1].input,input.payload);assert.deepEqual(first.steps[1].output,first.report);
  assert.equal(first.ai.model,null);assert.deepEqual(first.ai.retrieval,[]);
 }
});
test('negative findings and invalid or oversized contracts',()=>{
 assert.ok(executeDemo(request('sct','invalid-bic')).report.issues.some(i=>i.code==='DEMO_BIC_FORMAT'));
 for(const patch of [{contractVersion:2},{synthetic:false},{productId:'unknown'},{scenarioId:'unknown'},{syntheticEpoch:'today'},{payload:{...request().payload,railId:'chaps'}}])assert.throws(()=>executeDemo({...request(),...patch}));
 const oversized=request();oversized.payload.padding='x'.repeat(65536);assert.throws(()=>executeDemo(oversized),/64 KiB/);
});
