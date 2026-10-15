import {AUDIENCES,JOURNEYS,ALL_CONTEXTS,getJourney,connectionsFor,simulate,aiReplay,gradeQuiz} from "./core.mjs";
import {getRail} from "../payment-intelligence/catalog.mjs";
import {educationalRules,presenterScript,guideMetadata} from "./presenter.mjs";
import {teachingMessage,serializeReport} from "../payment-intelligence/messages.mjs";
import {HANDOFF_KEY,prepareHandoff} from "../payment-intelligence/handoff.mjs";
const $=id=>document.getElementById(id);
const el=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value??"");return n;};
const set=(id,value)=>$(id).textContent=String(value??"");
const MODE_KEY="addressrail.journeys.audience.v1";
const PROGRESS_KEY="addressrail.journeys.progress.v1";
const params=new URLSearchParams(location.search);
const requestedMode=params.get("mode");
let mode=Object.hasOwn(AUDIENCES,requestedMode)?requestedMode:"learner";
try{const stored=sessionStorage.getItem(MODE_KEY);if(!requestedMode&&Object.hasOwn(AUDIENCES,stored))mode=stored;}catch{}
let journeyId=JOURNEYS.some(j=>j.id===params.get("rail"))?params.get("rail"):"cbpr";
let scenarioId="success",stepIndex=0,simulation=null;
let passed=[];
try{const v=JSON.parse(sessionStorage.getItem(PROGRESS_KEY)||"[]");if(Array.isArray(v))passed=v.filter(x=>JOURNEYS.some(j=>j.id===x));}catch{}
const store=(key,value)=>{try{sessionStorage.setItem(key,value);}catch{/* session-private storage may be blocked */}};
function updateUrl(){
 const next=new URL(location.href);next.searchParams.set("mode",mode);
 next.searchParams.set("rail",journeyId);next.searchParams.set("scenario",scenarioId);
 history.replaceState(null,"",next.pathname+next.search+next.hash);
}
function selectMode(id){
 if(!Object.hasOwn(AUDIENCES,id))return;
 mode=id;store(MODE_KEY,id);
 for(const btn of document.querySelectorAll("[data-mode]"))btn.setAttribute("aria-pressed",String(btn.dataset.mode===id));
 set("mode-description",AUDIENCES[id].description+" "+AUDIENCES[id].prompt);
 $("learner-help").hidden=id!=="learner";
 $("presenter-help").hidden=id!=="professional";
 $("ai-workflow").classList.toggle("mode-featured",id==="ai");
 if(simulation)updateUrl();
}
function renderMap(id){
 const r=getRail(id);
 $("map-rail").value=id;set("map-name",r.name);set("map-kind",r.region+" · "+r.kind);
 set("map-about",r.description);set("map-focus",r.name);
 $("map-reference").href=r.reference;
 const list=$("map-neighbours");list.replaceChildren();
 const rel=connectionsFor(id);
 if(!rel.length){list.append(el("p","No curated connections recorded for this introductory context yet. Use the source reference and full catalogue; do not infer a live routing path."));return;}
 for(const item of rel){
  const b=el("button","");b.type="button";b.className="map-related";b.dataset.target=item.related.id;
  b.append(el("small",item.kind),el("strong",item.related.name),el("span",item.detail));
  b.addEventListener("click",()=>renderMap(item.related.id));list.append(b);
 }
}
function loadJourney(id){
 getJourney(id);journeyId=id;$("journey-select").value=id;
 const journey=getJourney(id);
 const choices=$("scenario-select");choices.replaceChildren();
 for(const scenario of journey.scenarios){const opt=el("option",scenario.label);opt.value=scenario.id;choices.append(opt);}
 scenarioId=journey.scenarios.some(s=>s.id===params.get("scenario"))?params.get("scenario"):"success";
 choices.value=scenarioId;runScenario();
}
function runScenario(){
 simulation=simulate(journeyId,scenarioId);stepIndex=0;
 set("journey-title",simulation.journey.title);
 const meta=guideMetadata(journeyId);
 set("journey-rule-meta","Last reviewed "+meta.reviewed+" · "+meta.ruleVersion);
 set("journey-intro",simulation.journey.intro);
 set("journey-distinction","Important boundary: "+simulation.journey.distinction);
 $("journey-reference").href=getRail(journeyId).reference;
 $("journey-message").hidden=true;$("sample-message").textContent="Show synthetic message ↓";
 renderTeachingRules();renderPresenter();set("journey-feedback","");
 renderStage();renderAI();renderQuiz();
 const original=String(scenarioId).toLowerCase();
 const faultMap={"address-review":"missing-town","iban-reject":"invalid-iban","timeout":"timeout","tracking-gap":"timeout",
   "unknown":"timeout","response-lost":"timeout","liquidity-hold":"liquidity","mandate":"mandate"};
 const mapped=faultMap[original]||"baseline";
 $("open-deep-validator").href="../payment-intelligence/?rail="+encodeURIComponent(journeyId)+"&scenario="+encodeURIComponent(mapped);
 updateUrl();
}
function renderTeachingRules(){
 const list=$("journey-findings");list.replaceChildren();
 const codes=educationalRules(simulation);
 list.append(el("strong",codes.length+" educational rule/scenario ID(s) — not official scheme validation"));
 for(const rule of codes)list.append(el("p",rule.id+" / "+rule.severity+" / "+rule.kind+": "+rule.description));
}
function renderPresenter(){
 const container=$("presenter-script");container.replaceChildren();
 for(const item of presenterScript(simulation)){
  const li=el("li",item.minute+" — "+item.action+": "+item.say);container.append(li);
 }
}
function renderStage(){
 const {scenario,journey}=simulation;
 const list=$("stage-list");list.replaceChildren();
 const reachable=scenario.at+1;
 journey.stages.forEach((stage,i)=>{
  const li=el("li","");
  const b=el("button",(i+1)+". "+stage.title);
  b.type="button";b.disabled=i>=reachable;
  b.setAttribute("aria-current",i===stepIndex?"step":"false");
  if(i>scenario.at)b.append(el("small"," · not reached"));
  b.addEventListener("click",()=>{stepIndex=i;renderStage()});
  li.append(b);list.append(li);
 });
 $("step-prev").disabled=stepIndex===0;
 $("step-next").disabled=stepIndex===scenario.at;
 set("step-count","Step "+(stepIndex+1)+" of "+reachable+" reached");
 const stage=journey.stages[stepIndex];
 set("stage-title",stage.title);set("stage-sender",stage.sender);
 set("stage-receiver",stage.receiver);set("stage-message",stage.message);
 set("stage-explanation",stage.meaning);
 set("learner-question","What is the difference between sending '"+stage.message+"' and proving funds actually moved?");
 set("presenter-question","Ask the audience which actor can provide authoritative confirmation at this stage.");
 const outcome=$("scenario-outcome");outcome.replaceChildren();
 if(stepIndex===scenario.at){
  outcome.append(el("strong",scenario.label+" · FICTIONAL "+scenario.status),el("p",scenario.what),
   el("p","Evidence: "+scenario.evidence),el("p","Review next: "+scenario.next));
 }else outcome.append(el("p","The fictional instruction has not yet reached its scenario outcome. Advance to inspect the next exchange."));
 const ev=$("journey-evidence");ev.replaceChildren();
 const events=simulation.evidence.slice(0,stepIndex+1+(stepIndex===scenario.at?1:0));
 for(const item of events){const card=el("article","");
  card.append(el("strong",item.type),el("p",item.description),el("small",item.evidenceRef));
  ev.append(card);
 }
}
function renderAI(){
 const d=aiReplay(simulation);
 set("ai-rules",d.deterministic);set("ai-evidence",d.evidence);
 set("ai-replay",d.hypotheticalLLM);set("ai-review",d.humanReview);
 set("ai-boundary",d.boundary);
}
function renderQuiz(){
 const [question,options]=simulation.journey.quiz;
 set("quiz-question",question);$("quiz-options").replaceChildren();
 for(let i=0;i<options.length;i++){
  const b=el("button",options[i]);b.type="button";
  b.addEventListener("click",()=>{
   const outcome=gradeQuiz(journeyId,i);
   for(const btn of $("quiz-options").children)btn.setAttribute("aria-pressed",String(btn===b));
   set("quiz-result",(outcome.correct?"Correct. ":"Not quite. ")+outcome.explanation);
   if(outcome.correct&&!passed.includes(journeyId)){passed.push(journeyId);store(PROGRESS_KEY,JSON.stringify(passed));}
   renderProgress();
  });$("quiz-options").append(b);
 }
 set("quiz-result","Choose an answer to test your understanding.");
 renderProgress();
}
function renderProgress(){set("progress",passed.length+" of "+JOURNEYS.length+" guided journeys answered correctly in this browser tab. Not an accredited assessment.");}
function downloadJson(){
 const data={version:1,synthetic:true,educationalOnly:true,journey:journeyId,
  scenario:scenarioId,stages:simulation.stages,evidence:simulation.evidence,
  assessment:JSON.parse(serializeReport(simulation.report,simulation.fixture)),
  aiReplay:aiReplay(simulation),rulesFired:educationalRules(simulation),presenterScript:presenterScript(simulation),disclaimer:simulation.disclaimer};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
 const a=el("a","");a.href=url;a.download="addressrail-"+journeyId+"-"+scenarioId+"-synthetic-journey.json";a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
for(const m of Object.keys(AUDIENCES))document.querySelector('[data-mode="'+m+'"]').addEventListener("click",()=>selectMode(m));
for(const rail of ALL_CONTEXTS){const opt=el("option",rail.name);opt.value=rail.id;$("map-rail").append(opt);}
$("map-rail").addEventListener("change",()=>renderMap($("map-rail").value));
for(const journey of JOURNEYS){const opt=el("option",journey.title);opt.value=journey.id;$("journey-select").append(opt);}
$("journey-select").addEventListener("change",()=>{
 const id=$("journey-select").value;renderMap(id);loadJourney(id);
});
$("scenario-select").addEventListener("change",()=>{scenarioId=$("scenario-select").value;runScenario()});
$("step-prev").addEventListener("click",()=>{if(stepIndex>0){stepIndex--;renderStage()}});
$("step-next").addEventListener("click",()=>{if(stepIndex<simulation.scenario.at){stepIndex++;renderStage()}});
$("presentation").addEventListener("click",()=>{
 const active=document.body.classList.toggle("presentation-active");
 $("presentation").setAttribute("aria-pressed",String(active));
});
$("sample-message").addEventListener("click",()=>{
 const preview=$("journey-message");
 if(!preview.hidden){preview.hidden=true;$("sample-message").textContent="Show synthetic message ↓";return;}
 try{preview.textContent=teachingMessage(simulation.fixture);preview.hidden=false;
  $("sample-message").textContent="Hide synthetic message ↑";}catch(e){set("journey-feedback",e.message)}
});
$("run-journey-checks").addEventListener("click",renderTeachingRules);
$("download-journey").addEventListener("click",downloadJson);
$("handoff-journey").addEventListener("click",()=>{
 try{const payload=prepareHandoff(simulation.report);
  sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(payload));
  window.location.assign("../open-demo/#import-intelligence");
 }catch(error){set("journey-feedback","No browser tab storage available; export JSON instead. "+error.message);}
});
window.addEventListener("addressrail:mode",event=>{
  const target=event.detail?.mode;
  if(target&&target!==mode)selectMode(target);
 });
for(const button of document.querySelectorAll("[data-mode]"))
 button.addEventListener("click",()=>window.dispatchEvent(new CustomEvent("addressrail:select-mode",{detail:{mode:button.dataset.mode}})));
renderMap(journeyId);selectMode(mode);loadJourney(journeyId);
