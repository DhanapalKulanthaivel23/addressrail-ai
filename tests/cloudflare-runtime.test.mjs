import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {smoke} from '../scripts/cloudflare-smoke.mjs';
const root=new URL('../cloudflare/payment-microservices/',import.meta.url);
const token='local-internal-token',key='local-demo-key';
const graph={bank:{},'swift-network':{BANK:'bank'},gpi:{SWIFT:'swift-network'},cbpr:{},'sepa-clearing':{},sepa:{CLEARING:'sepa-clearing'},rtgs:{},chaps:{RTGS:'rtgs'},t2:{RTGS:'rtgs'},gateway:{CBPR:'cbpr',GPI:'gpi',SWIFT:'swift-network',SEPA:'sepa',RTGS:'rtgs',CHAPS:'chaps',T2:'t2'}};
test('real Worker runtime and SQLite D1: smoke chain, durable payment, atomic quota and failures',async()=>{
 const mf=new Miniflare(convertV4MiniflareOptions({workers:Object.entries(graph).map(([name,serviceBindings])=>({name,modules:['worker.mjs','rail-flows.mjs','phase1.mjs','registry.mjs'].map(file=>({type:'ESModule',path:new URL(file,root).pathname})),compatibilityDate:'2026-10-01',bindings:{SERVICE_ROLE:name,INTERNAL_TOKEN:token,API_KEY:key,DAILY_LIMIT:'25'},serviceBindings,...(name==='gateway'?{d1Databases:{DB:'usage'}}:{})}))}));
 try{
 const db=await mf.getD1Database('DB','gateway');
 // D1 exec requires one statement per line.
 await db.exec(readFileSync(new URL('schema.sql',root),'utf8').replace(/\n/g,' ').split(';').map(s=>s.trim()).filter(Boolean).join(';\n')+';');
 const gateway=await mf.getWorker('gateway');
 const fetcher=(url,init)=>gateway.fetch(url,init);
 await smoke('https://example.com/',key,fetcher);
 const call=(path,body)=>gateway.fetch('https://example.com'+path,{method:body?'POST':'GET',headers:{'x-api-key':key,'idempotency-key':'SMOKEKEY123','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const p={synthetic:true,messageType:'pacs.008',receiverBic:'BANKDEFF',uetr:crypto.randomUUID(),payload:'<Document/>'};
 const created=await call('/v1/payments',p);assert.equal(created.status,201);const saved=await created.json();assert.equal(saved.payment.state,'BANK_ACCEPTED');
 assert.equal((await (await call('/v1/payments',p)).json()).replayed,true);
 assert.equal((await call('/v1/payments/'+saved.payment.id+'/events')).status,200);
 assert.equal((await call('/v1/gpi/typo',p)).status,404);
 await db.prepare('UPDATE api_usage SET count=24').run();
 const results=await Promise.all(Array.from({length:8},()=>call('/v1/gpi/payments',p)));
 assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===429).length,7);
 assert.equal((await call('/v1/payments',p)).status,429);assert.equal((await call('/v1/payments/'+saved.payment.id)).status,429);
 assert.equal((await db.prepare('SELECT count FROM api_usage').first()).count,25);
 await db.exec('DROP TABLE api_usage');assert.equal((await call('/v1/payments',p)).status,503);
 }finally{await mf.dispose()}
});
