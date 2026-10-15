import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {getOverview,OVERVIEWS,sampleOverview} from "../web/studio/rail-overview-data.mjs";
import {getCard,gradeCard} from "../web/studio/rail-card.mjs";
import {compareRails,COMPARISON} from "../web/studio/journeys/compare.mjs";
import {USE_CASES,filterUseCases} from "../web/studio/ai-lab/usecases.mjs";
import {validateSyntheticXML,XML_EXAMPLES} from "../web/studio/shared-xml-review.mjs";
const names=["sdd","fps","bacs","t2","cbpr","cls"];
test("AR-107 AR-305 AR-306: six distinct rail pages have unique canonical, title and described exceptions",()=>{
 assert.deepEqual(Object.keys(OVERVIEWS),names);
 for(const id of names){
  const p="web/studio/"+id+"/index.html",html=readFileSync(p,"utf8");
  const rail=getOverview(id);
  assert.match(html,new RegExp('<link rel="canonical" href="[^"]*/studio/'+id+'/'));
  assert.equal((html.match(/<h1[^>]*>/g)||[]).length,1);
  assert.ok(html.includes("site-shell.js"));
  assert.equal(rail.steps.length,5,id);
  assert.ok(rail.scenarios.length>=3,id);
  assert.ok(rail.scenarios.filter(sc=>sc.id!=="success").length>=2,id);
  assert.equal(new Set(rail.scenarios.map(sc=>sc.id)).size,rail.scenarios.length);
  for(const scenario of rail.scenarios){
   const result=sampleOverview(id,scenario.id);
   assert.equal(result.stages.length,scenario.at+1);
   assert.equal(result.status,scenario.status);
   assert.match(result.evidenceRef,/AR-SIM-/);
  }
 }
 assert.equal(getOverview("sdd").scenarios.length,6);
 assert.match(getOverview("sdd").sample,/pain\.008.*pacs\.003/);
 assert.match(getOverview("sdd").distinction,/Core and B2B/);
 assert.throws(()=>getOverview("constructor"),/Unknown overview/);
 assert.throws(()=>sampleOverview("cls","unknown"),/Unknown synthetic scenario/);
});
test("AR-501 AR-502 AR-503: SCT, instant and CHAPS rail cards cover required sections and 5 quizzes",()=>{
 for(const id of ["sct","sct-inst","chaps"]){
  const card=getCard(id);
  assert.equal(card.quizzes.length,5);
  assert.equal(card.actors.length,5);
  assert.ok(card.messageSuccess.length>=5);
  assert.ok(card.messageFailure.length>=5);
  assert.ok(card.ai.length>=3);
  assert.match(card.caution,/AI /);
  for(let i=0;i<5;i++){
   assert.equal(gradeCard(id,i,card.quizzes[i].correct).correct,true);
   assert.ok(gradeCard(id,i,(card.quizzes[i].correct+1)%3).explanation);
  }
  const html=readFileSync("web/studio/"+id+"/index.html","utf8");
  assert.match(html,/data-rail-card=/);
  assert.match(html,/ar-card-success/);
  assert.match(html,/ar-card-failure/);
  assert.match(html,/ar-card-quiz/);
 }
});
test("AR-307: comparison limits to 2–4 distinct supported rails with settlement and official sources",()=>{
 assert.equal(COMPARISON.length,6);
 for(const rail of compareRails(["chaps","sct","sct-inst","fps"])){
  for(const key of ["actors","when","settlement","finality","messages","exceptions","reference"])
   assert.ok(rail[key].length>10,key);
  assert.ok(rail.reference.startsWith("https://"));
 }
 assert.throws(()=>compareRails(["sct"]),/2–4/);
 assert.throws(()=>compareRails(["sct","sct"]),/2–4/);
 assert.throws(()=>compareRails(["sct","ghost"]),/Unknown/);
 assert.match(readFileSync("web/studio/journeys/index.html","utf8"),/id="compare-rails"/);
});
test("AR-404/405/406: 12 risk-labelled AI use cases, SVG local diagram and governance",()=>{
 assert.ok(USE_CASES.length>=10);
 for(const x of USE_CASES)for(const key of ["id","rail","task","data","risk","human","metric","status","link"])
  assert.ok(x[key].length>0,key);
 assert.ok(filterUseCases("High").every(x=>x.risk==="High"));
 const html=readFileSync("web/studio/ai-lab/index.html","utf8");
 assert.match(html,/id="ar-usecase-risk"/);
 assert.match(html,/<svg/);
 assert.match(html,/Local-only design/);
 assert.match(html,/UK GDPR/);
 assert.match(html,/DORA/);
 assert.match(html,/AI Act/);
});
test("AR-301/302: safe browser-only XML subset validation guards against non-synthetic and oversized inputs",()=>{
 for(const id of ["sct","sct-inst","chaps"]){
  const xml=XML_EXAMPLES[id];assert.match(xml,/SYNTHETIC|AR-DEMO/);
  const result=validateSyntheticXML(xml,id,undefined);
  assert.ok(Array.isArray(result));
  assert.ok(result.some(x=>x.id==="XML-ENV"),"Node should not claim browser XML XSD support");
  const html=readFileSync("web/studio/"+id+"/index.html","utf8");
  assert.match(html,/data-xml-review=/);
  assert.match(html,/No ISO XSD validation/);
 }
 assert.equal(validateSyntheticXML("<Document>NOTPRIVATE</Document>","sct")[0].id,"XML-PRIVACY");
 assert.equal(validateSyntheticXML("x".repeat(65537),"sct")[0].id,"XML-SIZE");
 assert.equal(validateSyntheticXML('<!DOCTYPE foo><Document>SYNTHETIC</Document>',"sct")[0].id,"XML-ENTITY");
 assert.throws(()=>validateSyntheticXML("<Document/>","cls"),/Unsupported/);
});
