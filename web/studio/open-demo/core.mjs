/**
 * AddressRail AI Open Demo: deterministic, browser-only synthetic case management.
 * NO authentication, server persistence, authorisation, real payment processing,
 * live Gemini calls, or third-party network requests. Tenants are visual filters.
 */
export const STORE_KEY = "addressrail.open-demo.cases.v1";
export const TENANTS = Object.freeze([
  {id:"demo-bank",name:"Demo Bank"},
  {id:"demo-fintech",name:"Demo Fintech"}
]);
export const WORKFLOW_STATES = Object.freeze(["OPEN","IN_REVIEW","ESCALATED","CLOSED"]);
export const DECISIONS = Object.freeze(["APPROVED_FOR_TRAINING","REJECTED_FOR_TRAINING"]);
export const SCENARIOS = Object.freeze([
  {
    id:"sct-local-reject",rail:"SEPA SCT",label:"Invalid beneficiary account — local rejection",
    paymentStatus:"RJCT",messageType:"pain.001",currency:"EUR",amount:"125.00",
    finding:"Synthetic bank-side rejection. No interbank pacs.008 was sent.",
    recommendation:"Review the fictional beneficiary information before any new instruction.",
    stages:[["INITIATED","Synthetic customer-to-bank instruction received"],
            ["RJCT","Illustrative local validation rejection; no interbank submission"]]
  },
  {
    id:"sct-technical-ack",rail:"SEPA SCT",label:"Technical acknowledgment — outcome not verified",
    paymentStatus:"ACTC",messageType:"pacs.008",currency:"EUR",amount:"125.00",
    finding:"Synthetic technical acceptance does not confirm settlement or account credit.",
    recommendation:"Obtain further processing and authorised settlement evidence.",
    stages:[["INITIATED","Illustrative payment initiation"],["BASIC_VALIDATED","Basic syntax checks only"],
            ["INTERBANK_SIMULATED","Synthetic STEP2 path; no real scheme connection"],
            ["ACTC","Technical acceptance demonstration; settlement unverified"]]
  },
  {
    id:"inst-rt1-timeout",rail:"SEPA Instant · RT1",label:"RT1 — missing outcome",
    paymentStatus:"UNKNOWN",messageType:"pacs.008",currency:"EUR",amount:"125.00",
    finding:"Synthetic response timeout leaves the final payment outcome UNKNOWN.",
    recommendation:"Reconcile with an authoritative source before considering a retry.",
    stages:[["INITIATED","Synthetic instant-payment initiation"],
            ["BASIC_VALIDATED","Illustrative bank checks"],
            ["ROUTED","Fictional RT1 route; no real infrastructure connection"],
            ["UNKNOWN","Missing simulated final response — reconciliation required"]]
  },
  {
    id:"inst-tips-success",rail:"SEPA Instant · TIPS",label:"TIPS — fictional completion",
    paymentStatus:"ACSC",messageType:"pacs.008",currency:"EUR",amount:"125.00",
    finding:"Fictional ACSC is a simulated teaching status, not independently verified settlement.",
    recommendation:"Do not use this record as evidence of real payment completion.",
    stages:[["INITIATED","Synthetic initiation"],["BASIC_VALIDATED","Illustrative bank checks"],
            ["ROUTED","Fictional TIPS route; distinct from RT1"],
            ["ACSC","Fictional completion only — not a real settlement confirmation"]]
  },
  {
    id:"chaps-liquidity",rail:"CHAPS · RTGS",label:"Insufficient liquidity — pending",
    paymentStatus:"PENDING",messageType:"pacs.008",currency:"GBP",amount:"250000.00",
    finding:"Synthetic liquidity hold is PENDING, not rejected and not settled.",
    recommendation:"Review hypothetical liquidity availability and authoritative RTGS evidence.",
    stages:[["RECEIVED","Fictional GBP high-value payment"],
            ["BASIC_CHECKS","Illustrative CHAPS data checks"],
            ["RTGS_ROUTED","Teaching-only RTGS route; no Bank of England connection"],
            ["PENDING","Insufficient illustrative liquidity — settlement unconfirmed"]]
  },
  {
    id:"chaps-unknown",rail:"CHAPS · RTGS",label:"Missing RTGS confirmation — unknown",
    paymentStatus:"UNKNOWN",messageType:"pacs.009 CORE",currency:"GBP",amount:"1500000.00",
    finding:"Missing synthetic RTGS confirmation does not establish a completed or rejected payment.",
    recommendation:"Reconcile status from an authorised RTGS source; do not assume settlement.",
    stages:[["RECEIVED","Fictional financial-institution payment"],
            ["RTGS_ROUTED","Illustrative RTGS processing only"],
            ["UNKNOWN","No authoritative settlement evidence in this synthetic demo"]]
  }
]);

const validActor = value => typeof value === "string" && /^[A-Za-z][A-Za-z0-9 _-]{1,35}$/.test(value);
const validNote = value => typeof value === "string" && value.trim().length >= 3
  && value.trim().length <= 260 && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
const fail = message => { throw new Error(message); };
const stamp = () => new Date().toISOString();
const copyState = state => structuredClone(state);

export function scenarioById(id) {
  return SCENARIOS.find(s=>s.id === id) ?? fail("Unknown synthetic scenario.");
}
export function isDemoTenant(id) { return TENANTS.some(t=>t.id===id); }
function checkActor(actor) {
  if (!validActor(actor)) fail("Use an invented guest alias (2–36 letters, numbers, spaces, _ or -).");
}
function checkState(state) {
  if (!state || state.version !== 1 || !Array.isArray(state.cases) ||
      !Number.isSafeInteger(state.nextCase) || !Number.isSafeInteger(state.nextActivity) ||
      state.cases.length > 60) fail("Invalid demo state.");
}
function record(state, item, actor, action, description) {
  item.activity.push({
    id:"DEMO-ACT-"+String(state.nextActivity++).padStart(5,"0"),
    at:stamp(),actor,action,description
  });
}
export function createInitialState() {
  const state={version:1,nextCase:1,nextActivity:1,cases:[]};
  // Initial walkthroughs across two illustrative organisations.
  for (const [tenant, scenarioId] of [
    ["demo-bank","chaps-liquidity"],["demo-bank","sct-local-reject"],
    ["demo-bank","inst-rt1-timeout"],["demo-fintech","inst-tips-success"]
  ]) {
    const next = createCase(state,{tenant,scenarioId,actor:"Demo Guide"});
    Object.assign(state,next);
  }
  return state;
}
export function createCase(state,{tenant,scenarioId,actor}) {
  checkState(state);
  if (!isDemoTenant(tenant)) fail("Select a demo organisation.");
  checkActor(actor);
  if (state.cases.length >= 60) fail("Demo case limit reached. Reset your browser sandbox.");
  const scenario=scenarioById(scenarioId);
  const next=copyState(state);
  const id="DEMO-CASE-"+String(next.nextCase).padStart(5,"0");
  const paymentId="DEMO-PAY-"+String(next.nextCase++).padStart(5,"0");
  const item={
    id,paymentId,tenant,scenarioId,rail:scenario.rail,messageType:scenario.messageType,
    paymentStatus:scenario.paymentStatus,currency:scenario.currency,amount:scenario.amount,
    workflowState:"OPEN",assignedTo:"Unassigned",openedBy:actor,
    decision:null,reviewedBy:null,
    events:scenario.stages.map(([type,description],i)=>({
      type,description,evidenceRef:paymentId+"-E"+(i+1)
    })),
    activity:[]
  };
  record(next,item,actor,"CASE_OPENED","Opened synthetic case; no payment was sent.");
  next.cases.unshift(item);
  return next;
}
export function casesForTenant(state,tenant,filter="ALL") {
  checkState(state);
  if(!isDemoTenant(tenant))fail("Invalid demonstration organisation.");
  return state.cases.filter(c=>c.tenant===tenant &&
    (filter==="ALL" || c.workflowState===filter || c.paymentStatus===filter));
}
function target(state,id,tenant) {
  checkState(state);
  if(!isDemoTenant(tenant))fail("Invalid demonstration organisation.");
  const next=copyState(state);
  const item=next.cases.find(c=>c.id===id && c.tenant===tenant);
  if(!item)fail("Case not found in the selected demo organisation.");
  return [next,item];
}
export function assignCase(state,{caseId,tenant,actor,assignee}) {
  checkActor(actor);checkActor(assignee);
  const [next,item]=target(state,caseId,tenant);
  if(item.workflowState==="CLOSED")fail("Closed cases cannot be reassigned.");
  item.assignedTo=assignee;
  record(next,item,actor,"ASSIGNED","Assigned fictional case to "+assignee+".");
  return next;
}
export function addCaseNote(state,{caseId,tenant,actor,note}) {
  checkActor(actor);
  if(!validNote(note))fail("Enter a synthetic note of 3–260 printable characters.");
  const [next,item]=target(state,caseId,tenant);
  if(item.activity.length>=100)fail("Activity limit reached.");
  record(next,item,actor,"NOTE",note.trim());
  return next;
}
export function changeCaseState(state,{caseId,tenant,actor,newState}) {
  checkActor(actor);
  if(!WORKFLOW_STATES.includes(newState))fail("Invalid training workflow state.");
  const [next,item]=target(state,caseId,tenant);
  if(item.decision)fail("Reviewed training cases cannot be changed.");
  if(item.workflowState===newState)fail("Choose a different workflow state.");
  const previous=item.workflowState;
  item.workflowState=newState;
  record(next,item,actor,"WORKFLOW_UPDATED",previous+" → "+newState+" (training only).");
  return next;
}
export function decideCase(state,{caseId,tenant,actor,decision}) {
  checkActor(actor);
  if(!DECISIONS.includes(decision))fail("Unsupported training decision.");
  const [next,item]=target(state,caseId,tenant);
  if(item.workflowState==="CLOSED"||item.decision)fail("This training case is already closed.");
  item.decision=decision;
  item.reviewedBy=actor;
  item.workflowState="CLOSED";
  record(next,item,actor,"TRAINING_DECISION",decision+
    ". No real payment was approved, released or settled.");
  return next;
}
export function validSavedState(value) {
  try {
    checkState(value);
    if(value.cases.some(c=>!isDemoTenant(c.tenant) ||
      !SCENARIOS.some(s=>s.id===c.scenarioId) ||
      !WORKFLOW_STATES.includes(c.workflowState) ||
      typeof c.id!=="string" || !Array.isArray(c.events) ||
      !Array.isArray(c.activity) || c.activity.length>100 ||
      (c.decision!==null && !DECISIONS.includes(c.decision))))return false;
    return true;
  }catch{return false;}
}
