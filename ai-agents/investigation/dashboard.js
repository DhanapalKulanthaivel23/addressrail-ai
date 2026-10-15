"use strict";
const $=id=>document.getElementById(id);
const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=String(text??"");return node;};
let selected="";
let workflow=null;
function state(text){$("list-state").textContent=text;}
async function jsonResponse(response){if(!response.ok)throw Error("Request unavailable (HTTP "+response.status+")");return response.json();}
async function refresh(){
 state("Loading local synthetic cases…");$("cases").replaceChildren();
 try{
  const status=$("filter").value;
  const query="?limit=40"+(status?"&status="+encodeURIComponent(status):"");
  const cases=await jsonResponse(await fetch("/api/dashboard/cases"+query,{cache:"no-store"}));
  state(cases.length+" synthetic case(s) returned; at most 40. Select a case or search by ID.");
  for(const item of cases){
   const button=add("button",item.paymentId);button.type="button";button.className="case";
   button.setAttribute("aria-current",String(selected===item.paymentId));
   button.append(add("small",item.scheme+" / "+item.status+" / "+item.messageType));
   button.addEventListener("click",()=>openCase(item.paymentId));
   $("cases").append(button);
  }
 }catch(error){state(error.message+". Check local Quarkus at 127.0.0.1:8081.");}
}
async function openCase(id){
 selected="";workflow=null;resetWorkflow();$("investigate").disabled=true;$("detail-title").textContent="Loading synthetic evidence…";
 $("timeline").replaceChildren();$("metadata").replaceChildren();
 $("agent-panel").replaceChildren(add("p","No investigation requested."));$("agent-state").textContent="";
 try{
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(id))throw Error("Enter a valid payment ID.");
  const detail=await jsonResponse(await fetch("/api/dashboard/cases/"+encodeURIComponent(id),{cache:"no-store"}));
  if(detail.payment.synthetic!==true || detail.payment.id!==id)throw Error("Evidence mismatch");
  selected=id;
  $("detail-title").textContent=detail.payment.id;
  const p=detail.payment;
  $("metadata").append(add("span",p.scheme+" · "+p.messageType+" · "+p.status+" · "+p.currency+" "+p.amount));
  for(const e of detail.events){
   const card=add("article","");card.className="event";
   card.append(add("strong",e.type+" · "+e.source),
               add("p",e.description),add("small",e.occurredAt+" · "+e.evidenceRef));
   $("timeline").append(card);
  }
  if(!detail.events.length)$("timeline").append(add("p","No recorded evidence."));
  $("investigate").disabled=false;
  await loadWorkflow(id);
  for(const button of $("cases").children)
    button.setAttribute("aria-current",String(button.firstChild?.textContent===id));
 }catch(error){$("detail-title").textContent="Unable to open payment";$("metadata").textContent=error.message;}
}
async function investigate(){
 if(!selected)return;
 const id=selected;
 $("investigate").disabled=true;$("agent-state").textContent="Running read-only LangGraph investigation…";
 try{
  const result=await jsonResponse(await fetch("/investigate",{method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify({payment_id:id})}));
  if(id!==selected)return;
  const panel=$("agent-panel");panel.replaceChildren();
  panel.append(add("h3",result.outcome+" · "+String(result.payment_status??"NO STATUS")));
  const badge=add("span",result.ai_used?"Gemini explanation validated":"Deterministic finding / Gemini not used");
  badge.className="badge";panel.append(badge);
  panel.append(add("p",result.finding?.explanation||"No finding available."));
  panel.append(add("p","Recommended action: "+(result.finding?.recommended_action||"Human review required.")));
  panel.append(add("p","Evidence: "+(result.finding?.evidence_refs||[]).join(", ")));
  panel.append(add("p","Requires human review: "+(result.finding?.requires_human_review===true?"YES":"CHECK")));
  if(result.ai_used && result.ai_explanation) panel.append(add("p","Gemini advisory: "+result.ai_explanation));
  $("agent-state").textContent="Investigation finished. Source status is unchanged.";
 }catch(error){$("agent-state").textContent=error.message+"; deterministic evidence remains in the timeline.";}
 finally{if(id===selected)$("investigate").disabled=false;}
}
$("refresh").addEventListener("click",refresh);
$("filter").addEventListener("change",refresh);
$("lookup").addEventListener("click",()=>openCase($("search").value.trim()));
$("search").addEventListener("keydown",event=>{if(event.key==="Enter")openCase($("search").value.trim());});
$("investigate").addEventListener("click",investigate);

function resetWorkflow(){
 $("workflow-state").textContent="Select a payment to load a training case.";
 $("workflow-details").replaceChildren();$("workflow-history").replaceChildren();
 $("open-workflow").disabled=true;$("add-workflow-note").disabled=true;
 $("save-workflow").disabled=true;
}
function showWorkflow(data){
 workflow=data;
 const c=data.trainingCase;
 $("workflow-state").textContent="Training case "+c.id+" · state "+c.state;
 $("workflow-details").replaceChildren(add("p","Owner: "+c.ownerAlias+" · Version: "+c.version));
 $("training-owner").value=c.ownerAlias;
 $("training-state-select").value=c.state;
 $("open-workflow").disabled=true;$("add-workflow-note").disabled=false;
 $("save-workflow").disabled=false;
 $("workflow-history").replaceChildren();
 for(const entry of data.history){
  const card=add("article","");card.className="event";
  card.append(add("strong",entry.action+" · "+entry.actorAlias),
              add("p",entry.note),add("small",entry.occurredAt+" · "+entry.evidenceRef));
  $("workflow-history").append(card);
 }
}
async function loadWorkflow(id){
 if(!id || id!==selected)return;
 try{
  const response=await fetch("/api/dashboard/workflow/"+encodeURIComponent(id),{cache:"no-store"});
  if(id!==selected)return;
  if(response.status===404){
   $("workflow-state").textContent="No case opened for this synthetic payment.";
   $("open-workflow").disabled=false;return;
  }
  showWorkflow(await jsonResponse(response));
 }catch(error){if(id===selected)$("workflow-state").textContent="Training case unavailable: "+error.message;}
}
async function workflowPost(path,payload){
 const id=selected;if(!id)return;
 $("workflow-state").textContent="Saving local synthetic training workflow…";
 try{
  const result=await jsonResponse(await fetch(path,{method:"POST",
   headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}));
  if(id===selected){showWorkflow(result);$("training-note").value="";}
 }catch(error){
  if(id===selected)$("workflow-state").textContent=error.message+"; refresh case state before retrying.";
 }
}
$("open-workflow").addEventListener("click",()=>workflowPost("/api/dashboard/workflow",{
 paymentId:selected,actorAlias:$("training-actor").value.trim()
}));
$("add-workflow-note").addEventListener("click",()=>{
 if(!workflow)return;
 workflowPost("/api/dashboard/workflow/"+encodeURIComponent(workflow.trainingCase.id)+"/notes",{
  actorAlias:$("training-actor").value.trim(),note:$("training-note").value.trim()
 });
});
$("save-workflow").addEventListener("click",()=>{
 if(!workflow)return;
 workflowPost("/api/dashboard/workflow/"+encodeURIComponent(workflow.trainingCase.id)+"/transition",{
  actorAlias:$("training-actor").value.trim(),ownerAlias:$("training-owner").value.trim(),
  state:$("training-state-select").value,note:$("training-note").value.trim(),
  expectedVersion:workflow.trainingCase.version
 });
});
refresh();
