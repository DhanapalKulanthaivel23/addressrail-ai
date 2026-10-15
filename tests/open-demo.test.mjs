import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 STORE_KEY,TENANTS,SCENARIOS,WORKFLOW_STATES,DECISIONS,
 createInitialState,createCase,casesForTenant,assignCase,addCaseNote,
 changeCaseState,decideCase,validSavedState,scenarioById
} from "../web/studio/open-demo/core.mjs";

const fields=s=>({caseId:s.cases[0].id,tenant:s.cases[0].tenant});
test("public demo creates realistic but exclusively synthetic seeded scenarios",()=>{
 const state=createInitialState();
 assert.equal(state.cases.length,4);
 assert.ok(validSavedState(state));
 assert.equal(casesForTenant(state,"demo-bank").length,3);
 assert.equal(casesForTenant(state,"demo-fintech").length,1);
 const statuses=state.cases.map(c=>c.paymentStatus);
 assert.ok(statuses.includes("PENDING"));
 assert.ok(statuses.includes("RJCT"));
 assert.ok(statuses.includes("UNKNOWN"));
 for(const item of state.cases){
  assert.match(item.id,/^DEMO-CASE-/);
  assert.match(item.paymentId,/^DEMO-PAY-/);
  assert.ok(item.events.every(e=>e.evidenceRef.startsWith(item.paymentId)));
  assert.equal(item.workflowState,"OPEN");
  assert.equal(item.decision,null);
 }
});
test("guest can create case without login, password, server or key",()=>{
 const initial=createInitialState();
 const out=createCase(initial,{tenant:"demo-bank",scenarioId:"sct-technical-ack",actor:"Guest Tester"});
 assert.equal(initial.cases.length,4,"core leaves previous state intact");
 assert.equal(out.cases.length,5);
 assert.equal(out.cases[0].paymentStatus,"ACTC");
 assert.match(out.cases[0].activity[0].description,/no payment was sent/i);
 assert.ok(out.cases[0].events.every(e=>!e.description.includes("settled by bank")));
});
test("browser demo organisations are selectable filters, not claimed authentication",()=>{
 const state=createInitialState();
 const bank=casesForTenant(state,"demo-bank");
 const fintech=casesForTenant(state,"demo-fintech");
 assert.ok(bank.every(c=>c.tenant==="demo-bank"));
 assert.ok(fintech.every(c=>c.tenant==="demo-fintech"));
 assert.throws(()=>casesForTenant(state,"fake-tenant"),/Invalid demonstration/);
 assert.throws(()=>createCase(state,{tenant:"fake-tenant",scenarioId:"chaps-liquidity",actor:"Guest"}),/Select/);
});
test("assign, add note and escalate append training activity without modifying payment status",()=>{
 const start=createInitialState();
 const {caseId,tenant}=fields(start);
 const priorStatus=start.cases[0].paymentStatus;
 let state=assignCase(start,{caseId,tenant,actor:"Demo Guest",assignee:"Demo Reviewer"});
 state=addCaseNote(state,{caseId,tenant,actor:"Demo Guest",note:"Synthetic liquidity remains on hold."});
 state=changeCaseState(state,{caseId,tenant,actor:"Demo Guest",newState:"ESCALATED"});
 const item=state.cases[0];
 assert.equal(item.assignedTo,"Demo Reviewer");
 assert.equal(item.workflowState,"ESCALATED");
 assert.equal(item.paymentStatus,priorStatus);
 assert.deepEqual(item.activity.map(a=>a.action),["CASE_OPENED","ASSIGNED","NOTE","WORKFLOW_UPDATED"]);
 assert.deepEqual(item.activity.map(a=>a.id),[...new Set(item.activity.map(a=>a.id))]);
 assert.equal(start.cases[0].assignedTo,"Unassigned");
});
test("review is explicitly training-only, final and never changes payment status",()=>{
 const initial=createInitialState();
 const {caseId,tenant}=fields(initial);
 const state=decideCase(initial,{caseId,tenant,actor:"Demo Reviewer",decision:"APPROVED_FOR_TRAINING"});
 const item=state.cases[0];
 assert.equal(item.decision,"APPROVED_FOR_TRAINING");
 assert.equal(item.workflowState,"CLOSED");
 assert.equal(item.paymentStatus,initial.cases[0].paymentStatus);
 assert.match(item.activity.at(-1).description,/No real payment was approved/);
 assert.throws(()=>decideCase(state,{caseId,tenant,actor:"Another Guest",decision:"REJECTED_FOR_TRAINING"}),/already closed/);
 assert.throws(()=>changeCaseState(state,{caseId,tenant,actor:"Guest",newState:"OPEN"}),/cannot be changed/);
});
test("guest API only permits fictional statuses and bounded notes",()=>{
 const start=createInitialState();
 const {caseId,tenant}=fields(start);
 assert.throws(()=>assignCase(start,{caseId,tenant,actor:"a",assignee:"Demo Reviewer"}),/invented guest alias/);
 assert.throws(()=>addCaseNote(start,{caseId,tenant,actor:"Demo Guest",note:""}),/synthetic note/);
 assert.throws(()=>addCaseNote(start,{caseId,tenant,actor:"Demo Guest",note:"x".repeat(261)}),/synthetic note/);
 assert.throws(()=>decideCase(start,{caseId,tenant,actor:"Demo Guest",decision:"REAL_PAYMENT_SETTLED"}),/Unsupported training decision/);
 assert.throws(()=>changeCaseState(start,{caseId,tenant,actor:"Demo Guest",newState:"SETTLED"}),/Invalid training/);
});
test("all scenario descriptions keep unverified settlement boundaries",()=>{
 assert.equal(SCENARIOS.length,6);
 assert.equal(scenarioById("inst-rt1-timeout").paymentStatus,"UNKNOWN");
 assert.match(scenarioById("chaps-liquidity").finding,/not rejected and not settled/);
 assert.match(scenarioById("sct-technical-ack").finding,/does not confirm settlement/);
 assert.match(scenarioById("inst-tips-success").finding,/not independently verified settlement/);
 assert.throws(()=>scenarioById("nonexistent"),/Unknown synthetic/);
});
test("invalid or tampered browser cache resets instead of being trusted",()=>{
 const state=createInitialState();
 assert.equal(validSavedState(state),true);
 assert.equal(validSavedState({...state,version:9000}),false);
 assert.equal(validSavedState({...state,cases:[{...state.cases[0],tenant:"private-bank"}]}),false);
 assert.equal(validSavedState({...state,cases:[{...state.cases[0],decision:"PAID_OUT"}]}),false);
 assert.equal(validSavedState(null),false);
});
test("public UI is stand-alone, no credentials, network calls, or raw HTML injection",()=>{
 const html=readFileSync("web/studio/open-demo/index.html","utf8");
 const js=readFileSync("web/studio/open-demo/lab.mjs","utf8");
 const core=readFileSync("web/studio/open-demo/core.mjs","utf8");
 assert.match(html,/No login required/);
 assert.match(html,/Public demonstration, not a hosted bank service/);
 assert.match(html,/other visitors cannot see them/);
 assert.match(html,/organisations and roles shown here are/i);
 assert.match(html,/not a payment approval/);
 assert.match(js,/sessionStorage/);
 assert.doesNotMatch(js,/\bfetch\s*\(/);
 assert.doesNotMatch(core,/\bfetch\s*\(/);
 assert.doesNotMatch(js,/innerHTML\s*=/);
 assert.doesNotMatch(js,/localStorage/);
 assert.doesNotMatch(html,/src="https?:\/\//);
 assert.match(html,/id="entry-error"/);
 assert.match(html,/id="export-case"/);
 assert.equal(STORE_KEY,"addressrail.open-demo.cases.v1");
});
