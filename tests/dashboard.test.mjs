import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {RAILS} from "../web/studio/payment-intelligence/catalog.mjs";
import {JOURNEY_IDS} from "../web/studio/journeys/core.mjs";
import {EXAMPLES} from "../web/studio/ai-lab/guardrails.mjs";
const page=readFileSync("web/studio/index.html","utf8");
const css=readFileSync("web/studio/dashboard.css","utf8");
const script=readFileSync("web/studio/dashboard.js","utf8");

test("navy dashboard has three audience entry points and screenshot-like visual sections",()=>{
 for(const title of ["For Banking &amp;","AI &amp; LLM","For Beginners","Payment Systems Explorer",
 "Interactive Payment Simulation","Banking AI Lab","5 Step Learning Path"]){
  assert.ok(page.includes(title),title);
 }
 for(const name of ["site-topbar","dashboard-overview","audience-cards","explorer-panel",
  "dashboard-boards","banking-board","ai-board","learning-board","feature-grid"]){
  assert.ok(css.includes("."+name),name);
 }
 assert.ok(css.includes("@media(max-width:700px)"));
 assert.ok(page.includes('id="release-id">v3'));
});
test("redesign preserves old live simulation roots and synthetic scope",()=>{
 for(const id of ["rail","scenario","simulate","trace","flow-title","flow-description",
 "rail-meta","references","scenario-result","question","answers","quiz-feedback",
 "module-nav","trace-demo","agent-trace","simulator","agent-lab","products","academy"]){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.match(page,/No actual payment is transmitted/);
 assert.match(page,/No Official Certification/);
 assert.ok(page.includes('href="../#ai"'));
});
test("dashboard previews are wired to existing local catalog, journeys and guardrails",()=>{
 assert.equal(RAILS.length,43);
 assert.equal(JOURNEY_IDS.length,6);
 assert.equal(EXAMPLES.length,8);
 for(const id of ["dashboard-rail-list","dashboard-map-title","dashboard-map-flow",
  "dashboard-map-open","dashboard-ai-case","dashboard-ai-verdict",
  "dashboard-lesson-list","dashboard-lesson-title","dashboard-lesson-open"]){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.ok(script.includes('from"./payment-intelligence/catalog.mjs"'));
 assert.ok(script.includes('from"./journeys/core.mjs"'));
 assert.ok(script.includes('from"./ai-lab/guardrails.mjs"'));
 assert.ok(script.includes("evaluateExample"));
 assert.ok(script.includes("aria-pressed"));
 for(const disallowed of ["fetch(","XMLHttpRequest","innerHTML =","localStorage."]){
  assert.ok(!script.includes(disallowed),disallowed);
 }
});
