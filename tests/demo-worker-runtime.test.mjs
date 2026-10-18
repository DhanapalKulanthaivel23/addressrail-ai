import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {generateFixture} from '../web/studio/payment-intelligence/engine.mjs';
import {executeDemo} from '../web/studio/shared/demo-engine.mjs';
test('public TypeScript execution contract produces identical results in workerd and browser-compatible module',async()=>{
 const root=new URL('../web/studio/',import.meta.url);
 const files=['shared/demo-engine.mjs','shared/product-registry.mjs','payment-intelligence/engine.mjs','payment-intelligence/catalog.mjs'];
 const mf=new Miniflare(convertV4MiniflareOptions({modules:[
  {type:'ESModule',path:'/virtual/entry.mjs',contents:"import {executeDemo} from './shared/demo-engine.mjs';export default {async fetch(request){return Response.json(executeDemo(await request.json()))}}"},
  ...files.map(file=>({type:'ESModule',path:'/virtual/'+file,contents:readFileSync(new URL(file,root),'utf8')}))
 ],compatibilityDate:'2026-10-01'}));
 try{
  for(const [id,scenario] of [['sct','baseline'],['chaps','liquidity'],['cbpr','invalid-bic'],['sdd-b2b','mandate']]){
   const request={contractVersion:1,synthetic:true,productId:id,scenarioId:scenario,syntheticEpoch:'2026-10-18T00:00:00.000Z',payload:generateFixture(id,scenario)};
   const response=await mf.dispatchFetch('https://local.test/',{method:'POST',body:JSON.stringify(request)});
   assert.equal(response.status,200);assert.deepEqual(await response.json(),executeDemo(request));
  }
 }finally{await mf.dispose()}
});
