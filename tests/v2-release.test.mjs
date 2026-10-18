import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {JOURNEYS,simulate} from "../web/studio/journeys/core.mjs";
import {educationalRules,presenterScript,guideMetadata} from "../web/studio/journeys/presenter.mjs";
import {EXAMPLES,GUARDRAIL_RULES,evaluateClaim,evaluateExample,evaluationSummary} from "../web/studio/ai-lab/guardrails.mjs";

test("all six journeys have evidence-linked presenter scripts and visible stable educational IDs",()=>{
 for(const j of JOURNEYS)for(const scenario of j.scenarios){
  const sim=simulate(j.id,scenario.id);
  const script=presenterScript(sim);
  assert.equal(script.length,4);
  assert.match(script[0].minute,/0:00/);
  assert.match(script.at(-1).minute,/3:00/);
  for(const item of script)assert.ok(item.action&&item.say);
  const rules=educationalRules(sim);
  assert.ok(rules[0].id.startsWith("SIM-"));
  assert.match(rules[0].kind,/SCENARIO/);
  assert.equal(rules[0].evidenceRef,sim.evidence.at(-1).evidenceRef);
  assert.ok(rules.some(x=>x.id.startsWith("DEMO_")),j.id+"/"+scenario.id);
  assert.ok(guideMetadata(j.id).reviewed);
  assert.ok(guideMetadata(j.id).reference.startsWith("https://"));
 }
 assert.match(guideMetadata("sct-inst").ruleVersion,/2025.*v1.2/);
 assert.throws(()=>presenterScript({}),/synthetic/);
});

test("eight authored adversarial and safe claims yield expected guardrail decisions",()=>{
 assert.equal(EXAMPLES.length,8);
 assert.equal(new Set(EXAMPLES.map(e=>e.id)).size,8);
 assert.ok(GUARDRAIL_RULES.length>=6);
 for(const example of EXAMPLES){
  const result=evaluateExample(example);
  assert.equal(result.result.verdict,example.expected,example.id);
  assert.equal(result.passed,true,example.id);
  assert.ok(result.result.evidenceRef.startsWith("EDU-"));
  if(example.expected==="REJECT")assert.ok(result.result.violations.length,example.id);
  else assert.equal(result.result.violations.length,0,example.id);
 }
 const summary=evaluationSummary();
 assert.deepEqual([summary.cases,summary.passed,summary.rejected,summary.falseAllows,summary.falseRejects],[8,8,6,0,0]);
 assert.match(summary.scope,/not real LLM accuracy/i);
});

test("guardrails reject fabricated settlement despite a 'safe' status example",()=>{
 const simulation=simulate("sct-inst","timeout");
 const block=evaluateClaim(simulation,"The payment is settled. Retry immediately.");
 assert.equal(block.verdict,"REJECT");
 assert.ok(block.violations.some(x=>x.id==="AI-G01"));
 assert.ok(block.violations.some(x=>x.id==="AI-G03"));
 assert.match(evaluateClaim(simulation,"This outcome is UNKNOWN; reconcile official evidence.").limitations,/NOT a factual verification/);
 assert.throws(()=>evaluateClaim({}, "The payment is settled"),/Synthetic journey/);
 assert.throws(()=>evaluateClaim(simulation,"a".repeat(701)),/700 characters/);
});

test("v2 site links and lab controls exist without new browser-side network or credential storage",()=>{
 const files=[
  "web/studio/ai-lab/index.html","web/studio/start/index.html",
  "web/studio/sct-inst/index.html","web/studio/chaps/index.html",
  "web/studio/journeys/index.html","web/studio/index.html",
  "web/studio/payment-intelligence/index.html"
 ];
 for(const file of files)assert.match(readFileSync(file,"utf8"),/AddressRail/i,file);
 const index=readFileSync("web/studio/index.html","utf8");
 assert.match(index,/id="release-id">v2/);
 assert.match(index,/href="start\//);
 assert.match(index,/href="ai-lab\//);
 const cross=readFileSync("web/studio/payment-intelligence/index.html","utf8");
 assert.match(cross,/id="beginner-mode"/);
 const instant=readFileSync("web/studio/sct-inst/index.html","utf8");
 assert.match(instant,/id="case-route"/);
 const chaps=readFileSync("web/studio/chaps/index.html","utf8");
 assert.match(chaps,/id="case-lab"/);
 const ai=readFileSync("web/studio/ai-lab/index.html","utf8");
 assert.match(ai,/authored sample claims/i);
 const sitemap=readFileSync("web/sitemap.xml","utf8");
 for(const end of ["studio/start/","studio/sct-inst/","studio/ai-lab/"])assert.ok(sitemap.includes(end));
 for(const script of ["web/studio/start/lab.mjs","web/studio/ai-lab/lab.mjs","web/studio/rail-workbench.mjs","web/studio/ai-lab/guardrails.mjs"]){
  const code=readFileSync(script,"utf8");
  assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|localStorage\.|innerHTML\s*=/,script);
 }
});

test("all four guides have review date and correct EPC postponement caveats",()=>{
 const paths=["web/pacs008-address-validation/index.html","web/iso20022-structured-address/index.html","web/cbpr-address-guide/index.html","web/mt103-address-correction/index.html"];
 for(const path of paths){
  const s=readFileSync(path,"utf8");
  assert.match(s,/Last reviewed 15 October 2026/);
  assert.match(s,/15 November 2026/);
  assert.match(s,/30 September 2026/);
  assert.match(s,/dateModified/);
 }
 const p=readFileSync(paths[0],"utf8");
 const parsed=p.split("Illustrative structured fields for review")[1].split("</pre>")[0];
 assert.ok(parsed.indexOf("&lt;StrtNm&gt;")<parsed.indexOf("&lt;TwnNm&gt;"));
 assert.doesNotMatch(parsed,/&lt;AdrLine&gt;/);
 const cbpr=readFileSync(paths[2],"utf8");
 assert.match(cbpr,/cross-border messaging CBPR\+.*requirements/i);
 assert.match(readFileSync(paths[3],"utf8"),/Legacy \/ transition example/);
});
