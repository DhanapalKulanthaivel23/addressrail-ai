import {test} from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/payment-microservices/worker.mjs";
const token="demo-internal-secret";
const req=(path,data,headers={})=>new Request("https://test"+path,{method:"POST",headers:{"content-type":"application/json","x-internal-token":token,...headers},body:JSON.stringify(data)});
const pay={synthetic:true,messageType:"pacs.008",reference:"AR-DEMO-123",currency:"EUR",receiverBic:"BANKDEFF",uetr:"123e4567-e89b-42d3-a456-426614174000"};
const service=(role,others={})=>({SERVICE_ROLE:role,INTERNAL_TOKEN:token,...others});
const binding=env=>({fetch:r=>worker.fetch(r,env)});
test("internal services are not publicly callable",async()=>{
 const result=await worker.fetch(req("/",pay,{"x-internal-token":"wrong"}),service("cbpr"));assert.equal(result.status,403);
});
test("only explicit synthetic requests are accepted",async()=>{
 const result=await worker.fetch(req("/",{...pay,synthetic:false}),service("cbpr"));assert.equal(result.status,400);
});
test("CBPR flags incomplete example, not XSD-valid",async()=>{
 const r=await worker.fetch(req("/",{...pay,payload:"<Document/>"}),service("cbpr"));const j=await r.json();
 assert.equal(j.validSubset,true);assert.match(j.validation,/not_xsd/);assert.equal(j.settlementAttested,false);
});
test("GPI traverses independent SWIFT network and bank simulation",async()=>{
 const bank=service("bank");const swift=service("swift-network",{BANK:binding(bank)});const gpi=service("gpi",{SWIFT:binding(swift)});
 const r=await worker.fetch(req("/",pay),gpi);const j=await r.json();
 assert.equal(j.trackingStatus,"ACSP");assert.equal(j.networkResponse.networkAck,"SIMULATED_ACCEPTED");assert.equal(j.settlementAttested,false);
});
test("SEPA SCT Inst goes through distinct clearing service",async()=>{
 const s=service("sepa",{CLEARING:binding(service("sepa-clearing"))});
 const j=await (await worker.fetch(req("/",{...pay,scheme:"SCT_INST"}),s)).json();
 assert.equal(j.clearing.clearingStatus,"SIMULATED_ACCEPTED");
});
test("CHAPS settlement uses RTGS service and enforces GBP",async()=>{
 const s=service("chaps",{RTGS:binding(service("rtgs"))});
 assert.equal((await worker.fetch(req("/",pay),s)).status,400);
 const j=await (await worker.fetch(req("/",{...pay,currency:"GBP"}),s)).json();
 assert.equal(j.settlement.settlementStatus,"SIMULATED_SETTLED");assert.equal(j.settlement.realFundsMoved,false);
});
test("Gateway must have tenant quota database, fails closed",async()=>{
 const s=service("gateway",{API_KEY:"key",CBPR:binding(service("cbpr"))});
 const r=await worker.fetch(req("/v1/cbpr/validate",{...pay,payload:"<Document/>"},{"x-api-key":"key"}),s);
 assert.equal(r.status,429);
});
test("Unknown scheme message is rejected",async()=>{
 assert.equal((await worker.fetch(req("/",{...pay,messageType:"pain.001"}),service("gpi"))).status,400);
});