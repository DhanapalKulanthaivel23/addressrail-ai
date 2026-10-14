import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FIXTURE,ibanValid,validateInput,simulate,escapeXml, pain001, pacs008} from "../web/studio/sepa-sct/core.mjs";

test("synthetic fixture has check-digit valid IBANs",()=>{
 assert.equal(ibanValid(FIXTURE.debtorIban),true);
 assert.equal(ibanValid(FIXTURE.creditorIban),true);
 assert.deepEqual(validateInput(FIXTURE),[]);
});
test("IBAN mod 97 refuses corrupted check digits",()=>{
 assert.equal(ibanValid("DE00370400440532013000"),false);
 assert.equal(ibanValid("FR001234INVALID"),false);
 assert.equal(ibanValid(""),false);
});
test("accepted teaching journey never claims settlement and contains message roles",()=>{
 const result=simulate(FIXTURE);
 assert.equal(result.status,"OUTCOME_UNVERIFIED");
 assert.equal(result.settlement,"UNVERIFIED");
 assert.deepEqual(Object.keys(result.messages),["pain.001","pacs.008","pacs.002"]);
 assert.match(result.messages["pain.001"],/pain\.001\.001\.09/);
 assert.match(result.messages["pacs.008"],/pacs\.008\.001\.08/);
 assert.match(result.messages["pacs.002"],/<TxSts>ACTC<\/TxSts>/);
 assert.ok(!result.events.some(e=>/SETTLED|BENEFICIARY_CREDITED/.test(e.status)));
});
test("invalid local IBAN stops before pacs.008 and produces only bank-facing pain.002",()=>{
 const result=simulate(FIXTURE,"invalid-iban");
 assert.equal(result.status,"LOCAL_REJECTED");
 assert.equal(result.settlement,"NOT_ATTEMPTED");
 assert.deepEqual(Object.keys(result.messages),["pain.001","pain.002"]);
 assert.match(result.messages["pain.002"],/pain\.002\.001\.10/);
 assert.doesNotMatch(JSON.stringify(result.messages),/pacs\.002/);
});
test("CSM rejection is interbank with pacs.002, never verified settlement",()=>{
 const result=simulate(FIXTURE,"csm-reject");
 assert.equal(result.status,"CSM_REJECTED");
 assert.equal(result.settlement,"NOT_SETTLED");
 assert.deepEqual(Object.keys(result.messages),["pain.001","pacs.008","pacs.002"]);
 assert.match(result.messages["pacs.002"],/<TxSts>RJCT<\/TxSts>/);
 assert.ok(!result.messages["pain.002"]);
});
test("invalid user fields do not generate XML",()=>{
 const result=simulate({...FIXTURE,amount:"0",creditorIban:"NO"});
 assert.equal(result.status,"INPUT_INVALID");
 assert.deepEqual(result.messages,{});
});
test("XML escaping defends generated text fields",()=>{
 const result=simulate({...FIXTURE,debtorName:"A&B <Synthetic>"});
 assert.match(result.messages["pain.001"],/A&amp;B &lt;Synthetic&gt;/);
 assert.doesNotMatch(result.messages["pacs.008"],/<Synthetic>/);
 assert.equal(escapeXml("\"'&"),"&quot;&apos;&amp;");
});
test("generated identifiers agree between customer and interbank documents",()=>{
 const result=simulate(FIXTURE);
 for(const name of ["pain.001","pacs.008","pacs.002"])
  assert.match(result.messages[name],/<EndToEndId>AR-DEMO-SCT-001<\/EndToEndId>|<OrgnlEndToEndId>AR-DEMO-SCT-001<\/OrgnlEndToEndId>/);
});
test("unknown scenarios rejected rather than silently accepted",()=>{
 assert.throws(()=>simulate(FIXTURE,"not-real"),/Unsupported scenario/);
});
test("message editor has expected controls and is client-side only",()=>{
 const html=readFileSync("web/studio/sepa-sct/index.html","utf8");
 const lab=readFileSync("web/studio/sepa-sct/lab.mjs","utf8");
 for(const id of ["sct-form","sct-scenario","lab-events","generated-xml","message-tabs","copy-xml","download-xml","lab-feedback"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.doesNotMatch(lab,/fetch\(|XMLHttpRequest|innerHTML\s*=/);
});
