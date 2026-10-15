import {EXAMPLES,evaluateExample,evaluateClaim,evaluationSummary} from "./guardrails.mjs";
const $=id=>document.getElementById(id);
const item=(tag,value)=>{const e=document.createElement(tag);e.textContent=String(value??"");return e;};
const selectedId=new URLSearchParams(location.search).get("case");
let active=EXAMPLES.some(e=>e.id===selectedId)?selectedId:EXAMPLES[0].id;
function show(id){
 const f=EXAMPLES.find(x=>x.id===id);if(!f)return;
 active=id;$("fixture").value=f.id;
 const r=evaluateExample(f);
 $("model-claim").value=f.claim;
 $("scenario-context").textContent=r.simulation.journey.title+" · "+r.simulation.scenario.label+
  " · fictional status: "+r.simulation.status;
 const evidence=$("evidence");evidence.replaceChildren();
 for(const e of r.simulation.evidence){const p=item("p",e.evidenceRef+" · "+e.type+" · "+e.description);evidence.append(p);}
 $("expected").textContent="Authored expected outcome: "+f.expected+"; evaluation of the original claim: "+r.result.verdict;
 $("explanation").textContent=f.why;check();
}
function check(){
 const f=EXAMPLES.find(e=>e.id===active),r=evaluateExample(f);
 let out;
 try{out=evaluateClaim(r.simulation,$("model-claim").value);}
 catch(error){$("decision").textContent=error.message;return;}
 const display=$("decision");display.replaceChildren();
 display.append(item("h3",out.verdict+" · "+out.violations.length+" fired rule(s)"));
 for(const v of out.violations){const section=item("article","");
  section.append(item("strong",v.id+" · "+v.explanation),item("p","Source: "+v.evidenceRef));display.append(section);}
 if(!out.violations.length)display.append(item("p","No listed unsupported-claim patterns were detected. This is NOT proof of truth."));
 display.append(item("p",out.limitations));
}
for(const f of EXAMPLES){const o=item("option",f.title+" · "+f.id);o.value=f.id;$("fixture").append(o);
 const b=item("button",f.title+" — expected "+f.expected);b.type="button";b.addEventListener("click",()=>show(f.id));$("all-fixtures").append(b);}
$("fixture").addEventListener("change",()=>show($("fixture").value));
$("check-claim").addEventListener("click",check);
const summary=evaluationSummary();
$("case-count").textContent=String(summary.cases);
$("pass-count").textContent=String(summary.passed)+"/"+summary.cases;
$("reject-count").textContent=String(summary.rejected);
show(active);
