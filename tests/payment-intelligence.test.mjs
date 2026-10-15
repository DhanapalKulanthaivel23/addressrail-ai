import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RAILS,getRail,listRails,IS_REAL_SCHEME} from "../web/studio/payment-intelligence/catalog.mjs";
import {
 SCENARIOS,UETR,isIban,isBic,isUetr,generateFixture,
 validateFixture,applyEvidenceRepair
} from "../web/studio/payment-intelligence/engine.mjs";
import {
 MESSAGE_FAMILIES,teachingMessage,traceByUetr,serializeReport
} from "../web/studio/payment-intelligence/messages.mjs";
import {
 HANDOFF_KEY,prepareHandoff,validateHandoff
} from "../web/studio/payment-intelligence/handoff.mjs";
import {
 createInitialState,createIntelligenceCase,casesForTenant,decideCase,validSavedState
} from "../web/studio/open-demo/core.mjs";

test("coverage separates major schemes, networks, overlays and infrastructures",()=>{
 assert.ok(RAILS.length>=35);
 assert.equal(new Set(RAILS.map(r=>r.id)).size,RAILS.length);
 for(const id of ["cbpr","gpi","g4c","swift-fin","swift-go","chaps","boe-rtgs",
 "fps","bacs-credit","bacs-debit","ics","cop","link","sct","sct-inst",
 "sdd-core","sdd-b2b","oct-inst","vop","srtp","step2","step2-sdd","rt1",
 "tips","t2","t2s","euro1","cls"]){
   assert.ok(getRail(id).reference.startsWith("https://"),id);
 }
 assert.ok(getRail("g4c").kind.includes("overlay"));
 assert.ok(getRail("gpi").kind.includes("overlay"));
 assert.ok(getRail("chaps").kind.includes("payment system"));
 assert.ok(getRail("t2").kind.includes("RTGS"));
 assert.ok(getRail("tips").kind.includes("infrastructure"));
 assert.ok(getRail("bacs-debit").kind.includes("direct debit"));
 assert.ok(IS_REAL_SCHEME("sct"));
 assert.equal(IS_REAL_SCHEME("t2"),false);
 assert.ok(listRails({region:"UK"}).length>=8);
 assert.ok(listRails({query:"g4c"}).some(r=>r.id==="g4c"));
 assert.ok(listRails({query:"CHAPS"}).some(r=>r.id==="chaps"));
});
test("every catalogue item has working browser-only fictional fixture and rule result",()=>{
 for(const rail of RAILS){
  const m=generateFixture(rail.id);
  assert.equal(m.synthetic,true);
  assert.equal(m.railId,rail.id);
  assert.ok(m.timeline.length>=3);
  const report=validateFixture(m);
  assert.equal(report.rail.id,rail.id);
  assert.equal(report.synthetic,true);
  assert.equal(report.evidence.at(-1).type,m.status);
  assert.ok(report.limitations.some(l=>l.includes("Synthetic")));
  assert.equal(report.issues.some(i=>i.code==="DEMO_TIMELINE"),false,rail.id);
  assert.equal(report.issues.some(i=>i.code==="DEMO_STATUS_CONFLICT"),false,rail.id);
  const message=teachingMessage(m);
  assert.ok(message.includes("TEACHING")||message.includes("EDUCATIONAL")||message.includes("training")||message.includes("CONCEPTUAL")||message.includes("MT103"),rail.id);
 }
});
test("nine synthetic fault scenarios have distinct validation outcomes",()=>{
 assert.equal(SCENARIOS.length,9);
 const baseline=validateFixture(generateFixture("cbpr"));
 assert.equal(baseline.assessment,"ILLUSTRATIVE_ONLY");
 assert.ok(!baseline.issues.some(i=>i.severity==="ERROR"));
 const scenarios=[
  ["missing-town","DEMO_ADDRESS_STRUCTURE"],["invalid-iban","DEMO_IBAN_CHECK"],
  ["invalid-bic","DEMO_BIC_FORMAT"],["missing-uetr","DEMO_UETR"],
  ["timeout","DEMO_UNKNOWN_OUTCOME"],["liquidity","DEMO_PENDING_OUTCOME"],
  ["conflict","DEMO_STATUS_CONFLICT"]
 ];
 for(const [scenario,expected] of scenarios){
  const report=validateFixture(generateFixture("cbpr",scenario));
  assert.ok(report.issues.some(i=>i.code===expected),"scenario "+scenario);
 }
 assert.ok(validateFixture(generateFixture("sdd-core","mandate")).issues.some(i=>i.code==="DEMO_MANDATE"));
 assert.ok(validateFixture(generateFixture("bacs-debit","mandate")).issues.some(i=>i.code==="DEMO_MANDATE"));
});
test("basic identifier checks are conservative and do not constitute scheme checks",()=>{
 assert.ok(isIban("DE89370400440532013000"));
 assert.ok(isIban("FR1420041010050500013M02606"));
 assert.equal(isIban("FR1420041010050500013M02607"),false);
 assert.ok(isBic("AAAADEFFXXX"));
 assert.equal(isBic("BAD-BIC"),false);
 assert.ok(isUetr(UETR));
 assert.equal(isUetr("some-text"),false);
 assert.throws(()=>validateFixture({synthetic:false,railId:"cbpr"}),/synthetic/);
});
test("address repair is evidence-backed, review-only, and cannot fabricate a city",()=>{
 const before=generateFixture("cbpr","missing-town");
 const report=validateFixture(before);
 assert.equal(report.proposals.length,1);
 const proposal=report.proposals[0];
 assert.equal(proposal.path,"creditor.address.town");
 assert.equal(proposal.proposed,"Paris");
 const fixed=applyEvidenceRepair(before,proposal);
 assert.equal(fixed.creditor.address.town,"Paris");
 assert.equal(before.creditor.address.town,"");
 assert.equal(validateFixture(fixed).proposals.length,0);
 assert.throws(()=>applyEvidenceRepair(fixed,proposal),/already populated/);
 assert.throws(()=>applyEvidenceRepair(before,{...proposal,proposed:"Berlin"}),/no longer supports/);
 const unsupported=structuredClone(before);
 unsupported.creditor.address.unstructured="Unknown locality";
 assert.equal(validateFixture(unsupported).proposals.length,0);
});
test("SWIFT gpi / g4C UETR trace never invents live tracker results",()=>{
 for(const rail of ["gpi","g4c","cbpr"]){
   const report=validateFixture(generateFixture(rail));
   const matching=traceByUetr(report,UETR);
   assert.equal(matching.length,report.evidence.length,rail);
   assert.deepEqual(traceByUetr(report,"missing"),[],rail);
 }
});
test("ISO message explorer exposes distinct educational families and safe XML escaping",()=>{
 const m=generateFixture("cbpr");
 assert.ok(MESSAGE_FAMILIES.length>=13);
 const pairs=[
  ["pacs.008","FIToFICstmrCdtTrf"],
  ["pacs.009-core","FICdtTrf"],["pacs.009-cov","UndrlygCstmrCdtTrf"],
  ["pacs.002","FIToFIPmtStsRpt"],["pacs.004","PmtRtr"],
  ["pain.001","CstmrCdtTrfInitn"],["pain.008","CstmrDrctDbtInitn"],
  ["pacs.003","FIToFICstmrDrctDbt"],
  ["camt.056","FIToFIPmtCxlReq"],["camt.029","RsltnOfInvstgtn"],
  ["camt.053","BkToCstmrStmt"],["camt.054","BkToCstmrDbtCdtNtfctn"]
 ];
 for(const [id,tag] of pairs){
   const xml=teachingMessage(m,id);
   assert.match(xml,/<Document xmlns=/);
   assert.ok(xml.includes(tag),id);
   assert.match(xml,/NOT XSD\/CBPR\+\/EPC\/T2\/CHAPS CONFORMANT/);
 }
 const malicious=generateFixture("cbpr");
 malicious.debtor.name="SYNTHETIC <script>alert(1)</script> & CO";
 const xml=teachingMessage(malicious,"pacs.008");
 assert.ok(xml.includes("&lt;script&gt;"));
 assert.ok(!xml.includes("<script>"));
 assert.match(teachingMessage(generateFixture("swift-fin")),/HISTORICAL MT103/);
 assert.match(teachingMessage(generateFixture("fps")),/CONCEPTUAL TRAINING RECORD/);
});
test("report export is structured synthetic-only and no official settlement proof",()=>{
 const m=generateFixture("chaps","liquidity");
 const r=validateFixture(m);
 const out=JSON.parse(serializeReport(r,m));
 assert.equal(out.paymentStatus,"PENDING");
 assert.ok(out.guardrails.some(x=>x.includes("No certified participant")));
 assert.ok(out.note.includes("not authentic"));
 assert.ok(!JSON.stringify(out).includes("GEMINI_API_KEY"));
});
test("cross-rail report imports as a private guest case without changing payment status",()=>{
 const generated=validateFixture(generateFixture("cbpr","missing-town"));
 const handoff=prepareHandoff(generated);
 assert.ok(validateHandoff(handoff));
 assert.equal(handoff.railId,"cbpr");
 const first=createInitialState();
 const state=createIntelligenceCase(first,{tenant:"demo-bank",actor:"Demo Guest",handoff});
 assert.equal(state.cases.length,first.cases.length+1);
 const imported=state.cases[0];
 assert.equal(imported.scenarioId,"intelligence-import");
 assert.equal(imported.paymentStatus,generated.paymentStatus);
 assert.equal(imported.events.length,generated.evidence.length);
 assert.equal(imported.intelligence.issues.length,generated.issues.length);
 assert.equal(casesForTenant(state,"demo-bank")[0].id,imported.id);
 assert.ok(validSavedState(state));
 const reviewed=decideCase(state,{tenant:"demo-bank",caseId:imported.id,
    actor:"Demo Reviewer",decision:"APPROVED_FOR_TRAINING"});
 assert.equal(reviewed.cases[0].paymentStatus,generated.paymentStatus);
 assert.equal(first.cases.length,4);
 assert.equal(validateHandoff({...handoff,railId:"unknown"}),false);
 assert.equal(HANDOFF_KEY,"addressrail.intelligence.handoff.v1");
});
test("open-demo and intelligence apps are static same-origin browser-only",()=>{
 const files=[
  "web/studio/payment-intelligence/lab.mjs",
  "web/studio/payment-intelligence/engine.mjs",
  "web/studio/payment-intelligence/messages.mjs",
  "web/studio/payment-intelligence/handoff.mjs",
  "web/studio/open-demo/lab.mjs"
 ];
 for(const file of files){
  const content=readFileSync(file,"utf8");
  assert.doesNotMatch(content,/\bfetch\s*\(/,file);
  assert.doesNotMatch(content,/\bXMLHttpRequest\b/,file);
  assert.doesNotMatch(content,/innerHTML\s*=/,file);
  assert.doesNotMatch(content,/localStorage\./,file);
 }
 const html=readFileSync("web/studio/payment-intelligence/index.html","utf8");
 assert.match(html,/43 PAYMENT SYSTEMS/);
 assert.match(html,/No login/);
 assert.match(html,/not submission-ready/);
 assert.match(html,/id="send-case"/);
 assert.match(html,/id="rail-list"/);
});

test("non-euro EU country infrastructure keeps PLN SEK DKK separate from EUR SEPA",()=>{
 const currencyByRail=[
  ["se-rix-inst","SEK"],["se-rix-rtgs","SEK"],["se-swish","SEK"],
  ["pl-elixir","PLN"],["pl-express-elixir","PLN"],
  ["dk-retail-clearing","DKK"],["dk-tips","DKK"]
 ];
 for(const [rail,currency] of currencyByRail){
  const input=generateFixture(rail);
  assert.equal(input.currency,currency,rail);
  const result=validateFixture(input);
  assert.equal(result.issues.some(i=>i.code==="DEMO_CURRENCY"),false,rail);
  const handoff=prepareHandoff(result);
  assert.ok(validateHandoff(handoff),rail);
  const modified=structuredClone(input);
  modified.currency="EUR";
  assert.ok(validateFixture(modified).issues.some(i=>i.code==="DEMO_CURRENCY"),rail);
 }
 assert.equal(generateFixture("sct-inst").currency,"EUR");
 assert.equal(generateFixture("fps").currency,"GBP");
 assert.equal(getRail("de-sepa-clearer").region,"EU national");
});
