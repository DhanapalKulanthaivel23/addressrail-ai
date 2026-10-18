import {test} from "node:test";
import assert from "node:assert/strict";
import {catalogue,support,canonicalType,transition,flows} from "../cloudflare/payment-microservices/registry.mjs";
test("catalogue contains MT, pain, pacs, camt with documented scope",()=>{
 for(const family of ["MT","pain","pacs","camt"])assert.ok(catalogue.some(m=>m.family===family));
 assert.ok(catalogue.every(m=>m.scope==="recognised-only"));
 assert.ok(catalogue.length>80);
});
test("message names normalised with versions but not assumed compliant",()=>{
 assert.equal(canonicalType("pacs.008.001.08"),"pacs.008");
 assert.equal(canonicalType("MT202 COV"),"MT202COV");
 assert.equal(support("CBPR","pacs.008.001.08").workflow,true);
 assert.equal(support("CBPR","camt.053.001.14").workflow,false);
 assert.equal(support("CBPR","camt.053.001.14").recognised,true);
 assert.equal(support("CBPR","something").recognised,false);
});
test("SEPA SDD has independent scheme message routes",()=>{
 assert.ok(flows.SDD_CORE.includes("pacs.003"));
 assert.ok(flows.SDD_B2B.includes("pain.008"));
 assert.ok(flows.SCT_INST.includes("pacs.008"));
 assert.equal(support("SDD_B2B","pacs.009").workflow,false);
});
test("payment state machine disallows invented direct settlement",()=>{
 assert.equal(transition("CREATED","SIMULATED_SETTLED"),false);
 assert.equal(transition("CREATED","VALIDATED"),true);
 assert.equal(transition("SUBMITTED","NETWORK_ACCEPTED"),true);
 assert.equal(transition("NETWORK_ACCEPTED","BANK_ACCEPTED"),true);
 assert.equal(transition("BANK_ACCEPTED","SETTLEMENT_PENDING"),true);
 assert.equal(transition("SETTLEMENT_PENDING","SIMULATED_SETTLED"),true);
 assert.equal(transition("REJECTED","SIMULATED_SETTLED"),false);
});
