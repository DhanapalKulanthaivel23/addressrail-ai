import {getJourney,simulate} from "./journeys/core.mjs";
import {presenterScript,educationalRules,guideMetadata} from "./journeys/presenter.mjs";
import {teachingMessage,serializeReport} from "./payment-intelligence/messages.mjs";
const $=id=>document.getElementById(id);
const el=(tag,v)=>{const n=document.createElement(tag);n.textContent=String(v??"");return n;};
export function mountRailWorkbench(railId){
 const journey=getJourney(railId),select=$("case-scenario");
 if(!select)return;
 for(const s of journey.scenarios){const o=el("option",s.label);o.value=s.id;select.append(o);}
 if(railId==="sct-inst"){
  const option=el("option","Late reply after timeout (fictional RJCT)");option.value="late-reply";select.append(option);
 }
 const params=new URLSearchParams(location.search);
 select.value=(journey.scenarios.some(s=>s.id===params.get("scenario"))||railId==="sct-inst"&&params.get("scenario")==="late-reply")?params.get("scenario"):"success";
 const m=guideMetadata(railId);
 $("case-review").textContent="Last reviewed "+m.reviewed+" · "+m.ruleVersion;
 const refs=$("case-reference");refs.href=m.reference;
 let current=null;
 function render(){
  const id=select.value,late=id==="late-reply"&&railId==="sct-inst";current=simulate(railId,late?"timeout":id);
  const route=$("case-route")?.value||null,events=$("case-events"),rules=$("case-rules"),script=$("case-script");
  const ext=route?"Synthetic infrastructure route: "+route+" (alternative, NOT a combined RT1 → TIPS chain).":"";
  $("case-outcome").textContent=late?"UNKNOWN at timeout → later fictional pacs.002 RJCT response; requires reconciliation. "+ext:current.scenario.label+" · "+current.status+" — "+current.scenario.what+" "+ext;
  events.replaceChildren();rules.replaceChildren();script.replaceChildren();
  for(const stage of current.stages.filter(x=>x.reachable)){
   const n=el("article","");
   const msg=railId==="sct-inst"&&stage.index===2?
    "Example route "+route+": pacs.008 via selected infrastructure only":stage.message;
   n.append(el("strong","Step "+(stage.index+1)+" · "+stage.title),
     el("p",stage.sender+" → "+stage.receiver),
     el("p","Exchange: "+msg),
     el("p",stage.meaning));events.append(n);
  }
  const fin=el("article","");
  fin.append(el("strong","Synthetic outcome · "+current.status),el("p",current.scenario.what),
   el("small",current.evidence.at(-1)?.evidenceRef));
  events.append(fin);
  if(late){const entry=el("article","");entry.append(el("strong","Late reply: fictional pacs.002 RJCT"),el("p","Reconcile the original message and late negative response. Timeout alone was UNKNOWN."),el("small","EDU-INSTANT-LATE-REPLY"));events.append(entry);}
  for(const r of educationalRules(current)){
   const n=el("article","");n.append(el("strong",r.id+" / "+r.severity),el("p",r.description),
     el("small",r.kind+" · "+r.evidenceRef));rules.append(n);
  }
  if(late){const item=el("article","");item.append(el("strong","SIM-SCT_INST-LATE_REPLY / training event"),el("p","A late negative response arrived. This does not confirm settlement or make a blind retry safe."));rules.append(item);}
  for(const item of presenterScript(current)){
   const n=el("article","");n.append(el("strong",item.minute+" · "+item.action),el("p",item.say));script.append(n);
  }
  try{$("case-message").textContent=teachingMessage(current.fixture);}
  catch(e){$("case-message").textContent="Incomplete fictional message: "+e.message;}
  $("case-guidance").textContent="Human investigation: "+current.scenario.next+
    " No scheme conformance, settlement, status feed, routing or live payment is verified.";
  const shared=new URL("../journeys/",location.href);
  shared.searchParams.set("rail",railId);shared.searchParams.set("scenario",id);
  $("case-full-journey").href=shared.pathname+shared.search;
  const url=new URL(location.href);url.searchParams.set("scenario",id);
  history.replaceState(null,"",url.pathname+url.search+url.hash);
 }
 select.addEventListener("change",render);
 $("case-route")?.addEventListener("change",render);
 $("case-download").addEventListener("click",()=>{
  if(!current)return;
  const late=railId==="sct-inst"&&select.value==="late-reply";
  const data={rail:railId,scenario:late?"late-reply":current.scenarioId,route:$("case-route")?.value||null,
   lateEvidence:late?{before:"UNKNOWN",after:"fictional pacs.002 RJCT",reconciled:false}:null,
   result:JSON.parse(serializeReport(current.report,current.fixture)),
   firedRules:educationalRules(current),presenterScript:presenterScript(current),
   disclaimer:"SYNTHETIC EDUCATION ONLY — no bank or infrastructure evidence."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=el("a","");a.download="addressrail-"+railId+"-"+current.scenarioId+"-teaching.json";a.href=url;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 render();
}
