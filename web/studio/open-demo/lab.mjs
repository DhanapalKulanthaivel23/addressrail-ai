import {HANDOFF_KEY,validateHandoff} from "../payment-intelligence/handoff.mjs";
import {
  STORE_KEY,TENANTS,SCENARIOS,WORKFLOW_STATES,createInitialState,validSavedState,
  scenarioById,casesForTenant,createCase,assignCase,addCaseNote,
  changeCaseState,decideCase,createIntelligenceCase
} from "./core.mjs";

const $=id=>document.getElementById(id);
const el=(name,value)=>{const item=document.createElement(name);item.textContent=String(value??"");return item};
const makeButton=(label,callback,classname="")=>{
  const button=el("button",label);
  button.type="button";
  button.className=classname;
  button.addEventListener("click",callback);
  return button;
};
const currentActor=()=>($("actor").value.trim()||"Demo Guest");
const guestNameValid=name=>/^[A-Za-z][A-Za-z0-9 _-]{1,35}$/.test(name);
let state;
let selected=null;
let currentTenant="demo-bank";
let guestAlias="Demo Guest";

function restore(){
  try {
    const saved=sessionStorage.getItem(STORE_KEY);
    const value=saved ? JSON.parse(saved) : null;
    if(validSavedState(value))return value;
  }catch{/* Private browsing may block sessionStorage. In-memory demo still works. */}
  return createInitialState();
}
function persist(){
  try{sessionStorage.setItem(STORE_KEY,JSON.stringify(state));}
  catch{/* A disabled storage API never prevents trying the demo. */}
}
state=restore();
function message(value){$("action-status").textContent=value;}
function queueMessage(value){$("queue-status").textContent=value;}
function perform(callback,success){
  try {
    const next=callback();
    state=next;
    persist();
    render();
    message(success);
  }catch(error){message(error.message||"That demo action could not be completed.");}
}
function updateCounters(){
  const all=casesForTenant(state,currentTenant);
  $("count-total").textContent=String(all.length);
  $("count-open").textContent=String(all.filter(c=>c.workflowState!=="CLOSED").length);
  $("count-closed").textContent=String(all.filter(c=>c.workflowState==="CLOSED").length);
}
function renderQueue(){
  const filtered=casesForTenant(state,currentTenant,$("status-filter").value);
  const list=$("case-list");
  list.replaceChildren();
  if(selected && !filtered.some(c=>c.id===selected))selected=null;
  if(!selected && filtered.length)selected=filtered[0].id;
  for(const item of filtered){
    const scenario=item.intelligence?{label:"Cross-rail: "+item.intelligence.rail+
      " / "+item.intelligence.assessment}:scenarioById(item.scenarioId);
    const button=makeButton("",
      ()=>{selected=item.id;render();message("Opened synthetic case "+item.id+".");},
      "case-item");
    button.setAttribute("aria-current",String(selected===item.id));
    button.append(el("span",item.id));
    button.lastChild.className="case-id";
    button.append(el("strong",scenario.label));
    button.append(el("span",item.rail+" · "+item.paymentStatus+" · "+item.workflowState));
    button.lastChild.className="mini";
    list.append(button);
  }
  queueMessage(filtered.length+" of "+casesForTenant(state,currentTenant).length+
    " synthetic cases shown. These belong to this browser tab only.");
}
function renderTimeline(container,events,activity=false){
  container.replaceChildren();
  if(!events.length){
    container.append(el("p","No fictional events recorded."));
    return;
  }
  for(const item of activity?[...events].reverse():events){
    const entry=el("article","");
    entry.append(el("strong",activity?item.action+" · "+item.actor:item.type));
    entry.append(el("p",activity?item.description:item.description));
    entry.append(el("small",activity?item.at+" · "+item.id:item.evidenceRef));
    container.append(entry);
  }
}
function renderDetail(){
  const item=state.cases.find(c=>c.id===selected && c.tenant===currentTenant);
  const controls=["assign","add-note","change-state","decide","export-case"];
  for(const id of controls)$(id).disabled=!item;
  if(!item){
    $("detail-title").textContent="Choose a case to inspect";
    $("payment-status").textContent="SYNTHETIC";
    $("payment-meta").textContent="Choose a case on the left.";
    $("finding").textContent="Evidence will appear here.";
    $("recommendation").textContent="Human review is always required.";
    $("event-list").replaceChildren();
    $("activity-list").replaceChildren();
    return;
  }
  const scenario=item.intelligence?
   {finding:item.intelligence.finding,
    recommendation:item.intelligence.recommendation}:
   scenarioById(item.scenarioId);
  $("detail-title").textContent=item.id;
  $("payment-status").textContent=item.paymentStatus+" / TRAINING";
  $("payment-meta").replaceChildren();
  for(const data of [
    item.rail,item.messageType,item.currency+" "+item.amount,
    item.paymentId,"Case: "+item.workflowState,
    "Assigned: "+item.assignedTo,
    item.decision ? "Decision: "+item.decision : "Review: not yet recorded"
  ]){
    const span=el("span",data);
    $("payment-meta").append(span);
  }
  $("finding").textContent=scenario.finding;
  $("recommendation").textContent=scenario.recommendation;
  $("assignee").value=item.assignedTo==="Unassigned"?"Demo Reviewer":item.assignedTo;
  $("workflow-state").value=item.workflowState;
  renderTimeline($("event-list"),item.events);
  renderTimeline($("activity-list"),item.activity,true);
  $("assign").disabled=item.workflowState==="CLOSED";
  $("change-state").disabled=Boolean(item.decision);
  $("decide").disabled=item.workflowState==="CLOSED";
}
function pendingIntelligence(){
  try{
    const raw=sessionStorage.getItem(HANDOFF_KEY);
    if(!raw||raw.length>9000)return null;
    const value=JSON.parse(raw);
    return validateHandoff(value)?value:null;
  }catch{return null;}
}
function renderPendingImport(){
  const pending=pendingIntelligence();
  $("import-intelligence").disabled=!pending;
  $("import-status").textContent=pending ?
    "Ready to import "+pending.rail+" · "+pending.paymentStatus+" as a synthetic case.":
    "No valid pending synthetic report in this browser tab.";
}
function render(){
  renderPendingImport();
  updateCounters();
  renderQueue();
  renderDetail();
}
function enter(event){
  event.preventDefault();
  const chosen=$("start-alias").value.trim()||"Demo Guest";
  if(!guestNameValid(chosen)){
    $("entry-error").textContent="Use a fictional name of 2–36 letters, numbers, spaces, _ or -.";
    return;
  }
  guestAlias=chosen;
  $("entry-error").textContent="";
  $("actor").value=guestAlias;
  $("guest-entry").hidden=true;
  $("workspace").hidden=false;
  selected=null;
  currentTenant=$("tenant").value;
  render();
  $("workspace").scrollIntoView({behavior:"smooth",block:"start"});
}
function exportExample(){
  const item=state.cases.find(c=>c.id===selected && c.tenant===currentTenant);
  if(!item)return;
  const blob=new Blob([JSON.stringify({
    notice:"SYNTHETIC BROWSER DEMO ONLY — NOT AUDITED OR AUTHENTICATED",
    exportDate:new Date().toISOString(),
    tenantSimulation:item.tenant,case:item
  },null,2)],{type:"application/json"});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement("a");
  anchor.href=url;
  anchor.download=item.id+"-synthetic.json";
  anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
for(const tenant of TENANTS){
  const option=el("option",tenant.name);
  option.value=tenant.id;
  $("tenant").append(option);
}
for(const scenario of SCENARIOS){
  const option=el("option",scenario.rail+" — "+scenario.label);
  option.value=scenario.id;
  $("scenario").append(option);
}
$("entry-form").addEventListener("submit",enter);
$("tenant").addEventListener("change",()=>{
  currentTenant=$("tenant").value;
  selected=null;
  $("status-filter").value="ALL";
  render();
  message("Switched illustrative organisation. This is only a browser filter, not tenant access control.");
});
$("status-filter").addEventListener("change",()=>{selected=null;render();});
$("create-case").addEventListener("click",()=>{
  const actor=currentActor();
  perform(()=>createCase(state,{tenant:currentTenant,scenarioId:$("scenario").value,actor}),
    "Created a synthetic payment and case in this browser only.");
  $("status-filter").value="ALL";
  selected=state.cases.find(c=>c.tenant===currentTenant)?.id??null;
  render();
});
$("assign").addEventListener("click",()=>{
  perform(()=>assignCase(state,{tenant:currentTenant,caseId:selected,
    actor:currentActor(),assignee:$("assignee").value.trim()}),
    "Fictional case owner assigned. No real identity verification.");
});
$("add-note").addEventListener("click",()=>{
  perform(()=>addCaseNote(state,{tenant:currentTenant,caseId:selected,
    actor:currentActor(),note:$("note").value}),
    "Saved a synthetic note to this browser tab.");
  if($("action-status").textContent.startsWith("Saved"))$("note").value="";
});
$("change-state").addEventListener("click",()=>{
  perform(()=>changeCaseState(state,{tenant:currentTenant,caseId:selected,
    actor:currentActor(),newState:$("workflow-state").value}),
    "Updated the fictional training workflow. Payment status is unchanged.");
});
$("decide").addEventListener("click",()=>{
  if(!window.confirm("Record this fictional training decision? This does NOT approve or settle a real payment."))return;
  perform(()=>decideCase(state,{tenant:currentTenant,caseId:selected,
    actor:currentActor(),decision:$("decision").value}),
    "Recorded training-only decision. No real payment was approved or settled.");
});
$("import-intelligence").addEventListener("click",()=>{
  const handoff=pendingIntelligence();
  if(!handoff){
    message("No verified synthetic report is pending for this tab.");
    return;
  }
  try{
    state=createIntelligenceCase(state,{
      tenant:currentTenant,actor:currentActor(),handoff
    });
    sessionStorage.removeItem(HANDOFF_KEY);
    persist();
    selected=state.cases[0].id;
    $("status-filter").value="ALL";
    render();
    message("Cross-rail educational finding imported as "+selected+
      ". Training actions remain browser-private.");
  }catch(error){message(error.message||"Unable to import this synthetic report.");}
});
$("export-case").addEventListener("click",exportExample);
$("reset-demo").addEventListener("click",()=>{
  if(!window.confirm("Reset all synthetic cases and notes in this browser tab?"))return;
  state=createInitialState();
  persist();selected=null;
  $("status-filter").value="ALL";
  render();message("Synthetic browser workspace reset.");
});
$("exit-demo").addEventListener("click",()=>{
  $("workspace").hidden=true;
  $("guest-entry").hidden=false;
  $("start-alias").value=guestAlias;
  $("guest-entry").scrollIntoView({behavior:"smooth",block:"start"});
});
