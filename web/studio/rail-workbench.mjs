import {getJourney,simulate} from "../journeys/core.mjs";
import {presenterScript,educationalRules,guideMetadata} from "../journeys/presenter.mjs";
import {teachingMessage,serializeReport} from "../payment-intelligence/messages.mjs";
const $=id=>document.getElementById(id);
const el=(tag,v)=>{const n=document.createElement(tag);n.textContent=String(v??"");return n;};
export function mountRailWorkbench(railId){
 const journey=getJourney(railId),select=$("case-scenario");
 if(!select)return;
 for(const s of journey.scenarios){const o=el("option",s.label);o.value=s.id;select.append(o);}
 const params=new URLSearchParams(location.search);
 select.value=journey.scenarios.some(s=>s.id===params.get("scenario"))?params.get("scenario"):"success";
 const m=guideMetadata(railId);
 $("case-review").textContent="Last reviewed "+m.reviewed+" · "+m.ruleVersion;
 const refs=$("case-reference");refs.href=m.reference;
 let current=null;
 function render(){
  const id=select.value;current=simulate(railId,id);
  const route=$("case-route")?.value||null,events=$("case-events"),rules=$("case-rules"),script=$("case-script");
  const ext=route?"Synthetic infrastructure route: "+route+" (alternative, NOT a combined RT1 → TIPS chain).":"";
  $("case-outcome").textContent=current.scenario.label+" · "+current.status+" — "+current.scenario.what+" "+ext;
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
  for(const r of educationalRules(current)){
   const n=el("article","");n.append(el("strong",r.id+" / "+r.severity),el("p",r.description),
     el("small",r.kind+" · "+r.evidenceRef));rules.append(n);
  }
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
  const data={rail:railId,scenario:current.scenarioId,route:$("case-route")?.value||null,
   result:JSON.parse(serializeReport(current.report,current.fixture)),
   firedRules:educationalRules(current),presenterScript:presenterScript(current),
   disclaimer:"SYNTHETIC EDUCATION ONLY — no bank or infrastructure evidence."};
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const a=el("a","");a.download="addressrail-"+railId+"-"+current.scenarioId+"-teaching.json";a.href=url;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 render();
}
