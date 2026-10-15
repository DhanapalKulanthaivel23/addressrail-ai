"use strict";
const $=id=>document.getElementById(id);
const add=(tag,text)=>{const node=document.createElement(tag);node.textContent=String(text??"");return node;};
let selected="";
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
 selected="";$("investigate").disabled=true;$("detail-title").textContent="Loading synthetic evidence…";
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
refresh();
