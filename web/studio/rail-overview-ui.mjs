import {getOverview,sampleOverview} from "./rail-overview-data.mjs";
import {getRail} from "./payment-intelligence/catalog.mjs";
const id=document.body.dataset.overview,rail=getOverview(id),get=key=>document.getElementById(key);
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);return n};
get("overview-intro").textContent=rail.intro;
get("overview-boundary").textContent=rail.distinction;
get("overview-message").textContent=rail.sample;
const src=get("overview-source");src.href=getRail(id==="sdd"?"sdd-core":id==="bacs"?"bacs-credit":id).reference;
const actors=get("overview-actors");
rail.actors.forEach((a,i)=>{actors.append(el("span",a));if(i<rail.actors.length-1)actors.append(el("b","→"))});
const ai=get("overview-ai");for(const item of rail.ai)ai.append(el("li",item));
get("overview-ai-caution").textContent=rail.caution;
const scheme=get("overview-scheme");
if(scheme)scheme.addEventListener("change",render);
const select=get("overview-scenario");
for(const sc of rail.scenarios){const option=el("option",sc.title);option.value=sc.id;select.append(option)}
const params=new URLSearchParams(location.search);
select.value=rail.scenarios.some(x=>x.id===params.get("scenario"))?params.get("scenario"):"success";
select.addEventListener("change",render);
function render(){
 const simulation=sampleOverview(id,select.value);
 const trace=get("overview-trace"),rules=get("overview-rules"),script=get("overview-script");
 trace.replaceChildren();rules.replaceChildren();script.replaceChildren();
 for(const [i,item] of simulation.stages.entries()){
  const line=el("article");line.append(el("strong","Step "+(i+1)+" · "+item.sender+" → "+item.receiver),
   el("p","Exchange: "+item.message),el("p",item.meaning));trace.append(line);
 }
 const last=el("article");last.append(el("strong","SIMULATED "+simulation.status),
  el("p",simulation.scenario.evidence),el("small",simulation.evidenceRef));trace.append(last);
 const basic=el("article");basic.append(el("strong","SIM-"+id.toUpperCase()+"-"+simulation.scenario.id.toUpperCase()+" · INJECTED FICTIONAL EVENT"),
  el("p",simulation.scenario.evidence));rules.append(basic);
 const boundary=el("article");boundary.append(el("strong","SIM-OUTCOME-NOT-ATTESTED · NOTICE"),
  el("p","This status is a fictional training marker, not real payment finality or ISO/EPC conformance."));rules.append(boundary);
 get("overview-outcome").textContent=simulation.status+" · "+simulation.scenario.title;
 get("overview-next").textContent="Human review: "+simulation.scenario.next;
 if(id==="sdd"){
  get("overview-scheme-caveat").textContent=(scheme?.value==="b2b")?
   "SDD B2B: the debtor PSP must perform scheme-specific mandate verification; the authorised-transaction refund rights differ from Core.":
   "SDD Core: refund protections for authorised collections differ from B2B; verify mandate and current scheme rules.";
 }
 const blocks=[
  ["0:00–0:35","Introduce the scheme",rail.intro],
  ["0:35–1:20","Explain participants and messages",rail.distinction],
  ["1:20–2:15","Inject "+simulation.scenario.title,simulation.scenario.evidence],
  ["2:15–3:00","Review evidence and next action",simulation.scenario.next]
 ];
 for(const [time,title,text] of blocks){const p=el("p");p.append(el("strong",time+" · "+title+": "),document.createTextNode(text));script.append(p)}
 const url=new URL(location.href);
 url.searchParams.set("scenario",select.value);
 if(scheme)url.searchParams.set("scheme",scheme.value);
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
if(scheme&&params.get("scheme")==="b2b")scheme.value="b2b";
get("overview-export").addEventListener("click",()=>{
 const report={...sampleOverview(id,select.value),scheme:scheme?.value||null,ruleIds:["SIM-"+id.toUpperCase()+"-"+select.value.toUpperCase(),"SIM-OUTCOME-NOT-ATTESTED"]};
 const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:"application/json"}));
 const a=el("a");a.href=url;a.download="addressrail-"+id+"-"+select.value+"-fictional.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
render();
