import {test} from "node:test";
import assert from "node:assert/strict";
import {phase1} from "../cloudflare/payment-microservices/phase1.mjs";
// Minimal deterministic D1 contract double: supports only documented SQL used by Phase 1.
function mockDB(){
 const payments=[],events=[];let serial=0;
 return {payments,events,prepare(sql){
   let args=[];
   return {bind(...v){args=v;return this},async run(){
     if(sql.startsWith("INSERT OR IGNORE INTO payments")){
       const [id,tenant,key,hash,uetr,type,reference,bic]=args;
       if(payments.some(p=>p.tenant===tenant&&(p.idempotency_key===key||p.uetr===uetr)))return {meta:{changes:0}};
       payments.push({id,tenant,idempotency_key:key,request_hash:hash,uetr,state:"PROCESSING",message_type:type,reference,receiver_bic:bic,network_ack:null,bank_status:null,error:null,created_at:"now",updated_at:"now"});
       return {meta:{changes:1}};
     }
     if(sql.startsWith("INSERT INTO payment_events")){events.push({id:++serial,payment_id:args[0],event_type:args[1],detail:args[2],created_at:"now"});return {meta:{changes:1}}}
     const p=payments.find(x=>x.id===args.at(-1));
     if(sql.includes("state='REJECTED'")){Object.assign(p,{state:"REJECTED",error:args[0]});return {meta:{changes:1}}}
     if(sql.includes("state='UNKNOWN'")){Object.assign(p,{state:"UNKNOWN",error:"network_outcome_unknown"});return {meta:{changes:1}}}
     if(sql.startsWith("UPDATE payments SET state=?")){Object.assign(p,{state:args[0],network_ack:args[1],bank_status:args[2]});return {meta:{changes:1}}}
     throw Error("unexpected SQL "+sql);
   },async first(){
     if(sql.includes("request_hash FROM payments"))return payments.find(x=>x.tenant===args[0]&&(x.idempotency_key===args[1]||x.uetr===args[2]))||null;
     if(sql.includes("FROM payments WHERE tenant"))return payments.find(x=>x.tenant===args[0]&&x.id===args[1])||null;
     throw Error("unexpected query "+sql);
   },async all(){return {results:events.filter(x=>x.payment_id===args[0])}}};
 }};
}
const input={synthetic:true,messageType:"pacs.008",uetr:"123e4567-e89b-42d3-a456-426614174000",receiverBic:"BANKDEFF",reference:"AR-DEMO-123",payload:"<Document><Payment/></Document>"};
const send=(body,key="TESTKEY0001")=>new Request("https://demo/v1/payments",{method:"POST",headers:{"idempotency-key":key,"content-type":"application/json"},body:JSON.stringify(body)});
const binding=handler=>({fetch:async request=>new Response(JSON.stringify(await handler(await request.json())),{headers:{"content-type":"application/json"}})});
const env=(db,bank="ACSP")=>({DB:db,INTERNAL_TOKEN:"test",
 CBPR:binding(async()=>({validSubset:true,validation:"educational_structure_only_not_xsd_or_cbpr_conformance"})),
 GPI:binding(async()=>({trackingStatus:bank,networkResponse:{networkAck:"SIMULATED_ACCEPTED"}}))});
test("durably records simulated happy path, events and report",async()=>{
 const db=mockDB(),e=env(db);
 const r=await phase1(send(input),e);const j=await r.json();
 assert.equal(r.status,201);assert.equal(j.payment.state,"BANK_ACCEPTED");
 assert.deepEqual(j.payment.events.map(x=>x.event_type),["CREATED","VALIDATED","NETWORK_ACCEPTED","BANK_ACCEPTED"]);
 const rep=await (await phase1(new Request("https://demo/v1/payments/"+j.payment.id+"/report"),e)).json();
 assert.equal(rep.evidence.length,4);assert.equal(rep.source,"deterministic_simulator_not_ai");
});
test("replay does not resubmit or double append events",async()=>{
 const db=mockDB(),e=env(db);
 await phase1(send(input),e);
 const r=await phase1(send(input),e);assert.equal((await r.json()).replayed,true);
 assert.equal(db.payments.length,1);assert.equal(db.events.length,4);
 const changed=await phase1(send({...input,receiverBic:"OTHERDEFF"}),e);
 assert.equal(changed.status,409);
});
test("rejection and unknown network outcomes never claim settlement",async()=>{
 const rejected=await (await phase1(send(input),env(mockDB(),"RJCT"))).json();
 assert.equal(rejected.payment.state,"REJECTED");assert.equal(rejected.settlementAttested,false);
 const db=mockDB();const outage=env(db);delete outage.GPI;
 const r=await phase1(send(input),outage);assert.equal(r.status,202);
 const p=(await r.json()).payment;assert.equal(p.state,"UNKNOWN");assert.equal(p.bank_status,null);
});
test("synthetic marker and idempotency required",async()=>{
 const db=mockDB(),e=env(db);
 assert.equal((await phase1(send({...input,synthetic:false}),e)).status,400);
 assert.equal((await phase1(send(input,"bad"),e)).status,400);
 assert.equal(db.payments.length,0);
});
