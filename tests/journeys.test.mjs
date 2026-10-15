import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RAILS,getRail} from "../web/studio/payment-intelligence/catalog.mjs";
import {validateFixture} from "../web/studio/payment-intelligence/engine.mjs";
import {teachingMessage,serializeReport} from "../web/studio/payment-intelligence/messages.mjs";
import {prepareHandoff,validateHandoff} from "../web/studio/payment-intelligence/handoff.mjs";
import {createInitialState,createIntelligenceCase,validSavedState} from "../web/studio/open-demo/core.mjs";
import {AUDIENCES,JOURNEYS,JOURNEY_IDS,ALL_CONTEXTS,CONNECTIONS,getJourney,connectionsFor,simulate,aiReplay,gradeQuiz} from "../web/studio/journeys/core.mjs";

test("three audience experiences reuse one six-journey education engine",()=>{
 assert.deepEqual(Object.keys(AUDIENCES),["professional","ai","learner"]);
 assert.deepEqual(JOURNEY_IDS,["cbpr","sct","sct-inst","chaps","fps","bacs-debit"]);
 assert.equal(JOURNEYS.length,6);
 assert.equal(ALL_CONTEXTS,RAILS);
 assert.equal(new Set(JOURNEY_IDS).size,6);
 assert.throws(()=>getJourney("constructor"),/Unsupported/);
 for(const j of JOURNEYS){
  assert.equal(getRail(j.id).id,j.id);
  assert.equal(j.stages.length,5,j.id);
  assert.equal(j.scenarios.length,4,j.id);
  assert.ok(j.intro.length>20&&j.distinction.length>20,j.id);
  assert.ok(j.quiz[0]&&j.quiz[1].length===3,j.id);
  assert.ok(j.stages.every(s=>s.sender&&s.receiver&&s.message&&s.meaning),j.id);
  assert.ok(new Set(j.scenarios.map(s=>s.id)).size===4,j.id);
 }
});
test("43-context connections graph only uses catalogued nodes, marks conceptual links",()=>{
 assert.equal(RAILS.length,43);
 assert.ok(CONNECTIONS.length>=30);
 for(const e of CONNECTIONS){
  assert.equal(getRail(e.from).id,e.from);
  assert.equal(getRail(e.to).id,e.to);
  assert.notEqual(e.from,e.to);
  assert.ok(e.kind.length>3&&e.detail.length>20);
 }
 for(const r of RAILS)assert.ok(Array.isArray(connectionsFor(r.id)));
 assert.ok(connectionsFor("chaps").some(e=>e.related.id==="boe-rtgs"));
 assert.ok(connectionsFor("sct-inst").some(e=>e.related.id==="rt1"));
 assert.ok(connectionsFor("sct-inst").some(e=>e.related.id==="tips"));
 assert.ok(connectionsFor("bacs-debit").some(e=>e.related.id==="bacs-credit"));
 assert.throws(()=>connectionsFor("no-such-rail"),/Unsupported/);
});
test("24 fictional journeys preserve status boundaries, correlation and basic validation",()=>{
 let count=0;
 for(const j of JOURNEYS)for(const scenario of j.scenarios){
  const sim=simulate(j.id,scenario.id);count++;
  assert.equal(sim.synthetic,true);
  assert.equal(sim.fixture.educationalOnly,true);
  assert.equal(sim.status,scenario.status);
  assert.equal(sim.report.paymentStatus,scenario.status);
  assert.equal(sim.stages.filter(s=>s.reachable).length,scenario.at+1);
  assert.equal(sim.stages.filter(s=>s.outcomeAt).length,1);
  assert.equal(sim.evidence.length,scenario.at+2);
  assert.equal(sim.evidence.at(-1).type,scenario.status);
  assert.ok(sim.evidence.at(-1).description.includes("Not an attested"),j.id+"/"+scenario.id);
  assert.ok(sim.evidence.every(x=>x.evidenceRef.startsWith("EDU-")));
  assert.equal(sim.report.issues.some(i=>i.code==="DEMO_STATUS_CONFLICT"),false,j.id+"/"+scenario.id);
  assert.deepEqual(validateFixture(sim.fixture).evidence,sim.report.evidence);
  assert.ok(teachingMessage(sim.fixture).length>60,j.id);
  const parsed=JSON.parse(serializeReport(sim.report,sim.fixture));
  assert.equal(parsed.rail.id,j.id);
  assert.equal(parsed.paymentStatus,scenario.status);
  const ai=aiReplay(sim);
  assert.equal(ai.liveModel,false);
  assert.equal(ai.backendCalled,false);
  assert.equal(ai.automatedPaymentAction,false);
  assert.match(ai.boundary,/SCRIPTED/);
  const handoff=prepareHandoff(sim.report);
  assert.ok(validateHandoff(handoff),j.id+"/"+scenario.id);
  const state=createIntelligenceCase(createInitialState(),{tenant:"demo-bank",actor:"Demo Learner",handoff});
  assert.ok(validSavedState(state),j.id+"/"+scenario.id);
  assert.equal(state.cases[0].paymentStatus,scenario.status);
 }
 assert.equal(count,24);
});
test("failed or uncertain flows never claim an unobserved downstream stage",()=>{
 for(const j of JOURNEYS)for(const scenario of j.scenarios.filter(s=>s.id!=="success")){
  const sim=simulate(j.id,scenario.id);
  for(const stage of sim.stages.slice(scenario.at+1))assert.equal(stage.reachable,false);
  assert.equal(sim.evidence.filter(e=>e.type.startsWith("STAGE_")).length,scenario.at+1);
  if(scenario.status==="UNKNOWN")assert.match(sim.report.nextAction,/Reconcile|Contact|reconcile/i);
 }
 const unknown=simulate("sct-inst","timeout");
 assert.equal(unknown.status,"UNKNOWN");
 assert.equal(unknown.stages[4].reachable,false);
 assert.equal(unknown.evidence.at(-1).type,"UNKNOWN");
 const rejection=simulate("sct","iban-reject");
 assert.ok(rejection.report.issues.some(x=>x.code==="DEMO_IBAN_CHECK"));
 const debit=simulate("bacs-debit","mandate");
 assert.ok(debit.report.issues.some(x=>x.code==="DEMO_MANDATE"));
 const address=simulate("cbpr","address-review");
 assert.ok(address.report.issues.some(x=>x.code==="DEMO_ADDRESS_STRUCTURE"));
 const liquidity=simulate("chaps","liquidity-hold");
 assert.equal(liquidity.status,"PENDING");
});
test("quiz answers are deterministic, bounded and explanatory",()=>{
 for(const j of JOURNEYS){
  const answer=j.quiz[2];
  assert.equal(gradeQuiz(j.id,answer).correct,true,j.id);
  assert.equal(gradeQuiz(j.id,(answer+1)%3).correct,false,j.id);
  assert.ok(gradeQuiz(j.id,answer).explanation.length>20);
 }
 assert.throws(()=>gradeQuiz("sct",42),/Invalid quiz/);
 assert.throws(()=>simulate("sct","constructor"),/Unsupported fictional/);
 assert.throws(()=>aiReplay({}),/Synthetic simulation/);
});
test("public mode page and catalog deep links remain browser-private and safe",()=>{
 const html=readFileSync("web/studio/journeys/index.html","utf8");
 const js=readFileSync("web/studio/journeys/lab.mjs","utf8");
 const cross=readFileSync("web/studio/payment-intelligence/lab.mjs","utf8");
 const index=readFileSync("web/studio/index.html","utf8");
 const main=readFileSync("web/index.html","utf8");
 const sitemap=readFileSync("web/sitemap.xml","utf8");
 for(const id of ["audience","connections","journey","ai-workflow","learn-check",
    "scenario-select","stage-list","map-rail","quiz-options","handoff-journey"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(index,/href="journeys\/"/);
 assert.match(main,/href="studio\/journeys\/"/);
 assert.match(sitemap,/studio\/journeys\//);
 assert.match(cross,/incoming\.get\("rail"\)/);
 assert.match(js,/sessionStorage\.setItem\(HANDOFF_KEY/);
 assert.match(html,/No bank connectivity/);
 for(const f of ["web/studio/journeys/core.mjs","web/studio/journeys/lab.mjs"]){
  const body=readFileSync(f,"utf8");
  assert.doesNotMatch(body,/\bfetch\s*\(|\bXMLHttpRequest\b|innerHTML\s*=|localStorage\./,f);
 }
});
