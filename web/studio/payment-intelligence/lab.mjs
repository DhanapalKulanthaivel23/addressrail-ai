import {RAILS,FORMATS,getRail,listRails,currencyOptionsForRail,defaultCurrencyForRail} from "./catalog.mjs";
import {
 SCENARIOS,generateFixture,validateFixture,applyEvidenceRepair,isUetr
} from "./engine.mjs";
import {
 MESSAGE_FAMILIES,teachingMessage,traceByUetr,serializeReport
} from "./messages.mjs";
import {HANDOFF_KEY,prepareHandoff} from "./handoff.mjs";

const $=id=>document.getElementById(id);
const text=(tag,value)=>{const element=document.createElement(tag);element.textContent=String(value??"");return element};
const button=(label,click,style="rail-item")=>{
 const item=text("button",label);item.type="button";item.className=style;
 item.addEventListener("click",click);return item;
};
let currentRail="cbpr";
const BEGINNER_RAILS=new Set(["cbpr","chaps","fps","bacs-credit","bacs-debit","sct","sct-inst","t2"]);
let currentMessage=null;
let currentReport=null;
let currentOutput="";
let currentProposal=null;
function feedback(msg){$("run-status").textContent=msg}
function disableExports(){
 currentReport=null;currentOutput="";currentProposal=null;
 $("download-report").disabled=true;$("send-case").disabled=true;
 $("download-message").disabled=true;
 $("repair-panel").hidden=true;
}
function replaceRailList(){
 const region=$("region").value,query=$("search-rails").value;
 const beginner=$("beginner-mode").value==="essentials";
 const matching=listRails({region,query}).filter(r=>!beginner||BEGINNER_RAILS.has(r.id));
 const selected=$("rail");
 selected.replaceChildren();
 for(const rail of matching){
  const opt=text("option",rail.name);opt.value=rail.id;selected.append(opt);
 }
 const list=$("rail-list");list.replaceChildren();
 $("rail-count").textContent=matching.length+" of "+RAILS.length+" contexts";
 if(!matching.length){
  $("rail-name").textContent="No matching payment context";
  $("rail-description").textContent="Try a different term or region.";
  $("rail-messages").textContent="—";
  $("rail-reference").hidden=true;
  $("rail-tags").replaceChildren();
  $("load-fixture").disabled=true;$("validate").disabled=true;
  $("build-message").disabled=true;
  $("currency").replaceChildren();
  $("currency-context").textContent="No matching payment context.";
  $("json-editor").value="";
  $("issues").replaceChildren();
  $("message-preview").textContent="Choose a matching service to generate a synthetic example.";
  $("trace-result").replaceChildren();
  disableExports();
  feedback("No matching service. Change your search or region.");
  return false;
 }
 if(!matching.some(r=>r.id===currentRail)) currentRail=matching[0].id;
 selected.value=currentRail;
  $("load-fixture").disabled=false;$("validate").disabled=false;
  $("build-message").disabled=false;
 for(const rail of matching){
  const b=button(rail.name,()=>chooseRail(rail.id));
  b.setAttribute("aria-current",String(rail.id===currentRail));
  b.append(text("span",rail.kind));
  list.append(b);
 }
 renderRailFacts();
 return true;
}
function renderRailFacts(){
 const rail=getRail(currentRail);
 $("rail-name").textContent=rail.name;
 $("rail-description").textContent=rail.description;
 $("rail-messages").textContent=rail.messages;
 const tags=$("rail-tags");tags.replaceChildren();
 for(const label of [rail.region,rail.kind,FORMATS[rail.format]]){
  tags.append(text("span",label));
 }
 $("rail-reference").hidden=false;
 $("rail-reference").href=rail.reference;
 const option=$("rail").querySelector('option[value="'+rail.id+'"]');
 if(option)$("rail").value=rail.id;
 for(const b of $("rail-list").children)b.setAttribute("aria-current",String(b.firstChild?.textContent===rail.name));
}
function chooseRail(id){
 getRail(id);
 currentRail=id;
 renderRailFacts();
 loadSynthetic();
}
function readModel(){
 const raw=$("json-editor").value;
 if(raw.length>18000)throw Error("Example too long. Limit the JSON draft to 18 KB.");
 try{
  const data=JSON.parse(raw);
  if(data?.synthetic!==true||data.educationalOnly!==true)
   throw Error("Only explicit synthetic teaching records are accepted.");
  if(data.railId!==currentRail)
   throw Error("The edited railId differs from the selected context. Choose its rail in the catalogue.");
  return data;
 }catch(error){
  if(error instanceof SyntaxError)throw Error("Invalid JSON draft. Correct the syntax and try again.");
  throw error;
 }
}
function refreshCurrencyControl(value){
 const options=currencyOptionsForRail(currentRail);
 const selector=$("currency");selector.replaceChildren();
 for(const currency of options){
  const option=text("option",currency);option.value=currency;selector.append(option);
 }
 selector.value=options.includes(value)?value:defaultCurrencyForRail(currentRail);
 $("currency-context").textContent=options.length===1?
  "Illustrative domestic currency: "+options[0]+" only. No FX conversion.":
  "Choose EUR, GBP, SEK, PLN or DKK for this global teaching context; this does not model FX, eligibility or settlement.";
}
function loadSynthetic(){
 if(!$("rail").options.length)return;
 currentMessage=generateFixture(currentRail,$("scenario").value);
 refreshCurrencyControl(currentMessage.currency);
 $("json-editor").value=JSON.stringify(currentMessage,null,2);
 $("trace-uetr").value=currentMessage.uetr||"";
 disableExports();
 $("issues").replaceChildren();
 $("evidence-timeline").replaceChildren();
 $("trace-result").replaceChildren();
 $("message-preview").textContent="Run the deterministic checks, or generate an educational message.";
 $("assessment-label").textContent="NOT RUN";
 $("result-title").textContent="Synthetic "+getRail(currentRail).name+" draft";
 $("errors-count").textContent="0";
 $("warnings-count").textContent="0";
 $("repair-count").textContent="0";
 $("next-action").textContent="Review the generated fictional payment fields before using them.";
 feedback("Loaded a synthetic "+$("scenario").selectedOptions[0]?.textContent+" example. No network calls.");
}
function timeline(container,items,refLabel="evidenceRef"){
 container.replaceChildren();
 if(!items?.length){
  container.append(text("p","No fictional events match."));
  return;
 }
 for(const item of items){
  const article=text("article","");
  article.append(text("strong",item.type));
  article.append(text("p",item.description));
  article.append(text("small",item[refLabel]||"Synthetic event"));
  container.append(article);
 }
}
function renderIssues(report){
 const issues=$("issues");
 issues.replaceChildren();
 if(!report.issues.length)issues.append(text("p","No injected error detected in this limited teaching rule set. This does not establish scheme conformance."));
 for(const issue of report.issues){
  const card=text("article","");card.className="finding-card "+issue.severity.toLowerCase();
  card.append(text("small",issue.severity+" / "+issue.code+" / "+issue.path));
  card.append(text("h4",issue.explanation));
  card.append(text("p","Next step: "+issue.recommendation));
  issues.append(card);
 }
 const errors=report.issues.filter(i=>i.severity==="ERROR").length;
 const warnings=report.issues.filter(i=>i.severity==="WARNING").length;
 $("errors-count").textContent=String(errors);
 $("warnings-count").textContent=String(warnings);
 $("repair-count").textContent=String(report.proposals.length);
 $("assessment-label").textContent=report.assessment;
 $("result-title").textContent=report.rail.name+" · "+report.paymentStatus;
 $("result-scope").textContent=report.messageType+" · "+report.rail.kind+" · educational-only analysis";
 $("next-action").textContent=report.nextAction;
 const proposals=report.proposals;
 $("repair-panel").hidden=proposals.length===0;
 currentProposal=proposals[0]??null;
 const content=$("proposal-body");content.replaceChildren();
 if(currentProposal){
  content.append(text("p","Field: "+currentProposal.path));
  content.append(text("p","Proposed town: "+currentProposal.proposed));
  content.append(text("p","Verbatim input evidence: "+currentProposal.evidence));
  content.append(text("p",currentProposal.explanation));
 }
 timeline($("evidence-timeline"),report.evidence);
}
function validate(){
 try{
  const model=readModel();
  const report=validateFixture(model);
  currentMessage=model;
  currentReport=report;
  renderIssues(report);
  $("trace-uetr").value=report.uetr||"";
  $("download-report").disabled=false;
  $("send-case").disabled=false;
  feedback("Educational checks completed. "+report.issues.length+
   " finding(s). Settlement and scheme conformance are NOT verified.");
  buildMessage();
  return report;
 }catch(error){
  disableExports();
  $("assessment-label").textContent="INPUT ERROR";
  $("issues").replaceChildren(text("p",error.message));
  feedback(error.message);
  return null;
 }
}
function buildMessage(){
 try{
  const model=readModel();
  const family=$("message-family").value;
  const result=teachingMessage(model,family);
  currentOutput=result;
  $("message-preview").textContent=result;
  $("download-message").disabled=false;
  $("message-title").textContent=family==="auto"?
    "Selected-rail teaching record":"Teaching "+family+" sketch";
 }catch(error){
  currentOutput="";
  $("message-preview").textContent=error.message;
  $("download-message").disabled=true;
 }
}
function runTrace(){
 const report=currentReport;
 if(!report){
  $("trace-result").replaceChildren(text("p","Run the checks first to generate fictional evidence."));
  return;
 }
 if(!isUetr($("trace-uetr").value)){
  $("trace-result").replaceChildren(text("p","Enter the generated version-4 UETR for this SWIFT-style example."));
  return;
 }
 const matches=traceByUetr(report,$("trace-uetr").value);
 timeline($("trace-result"),matches);
}
function download(source,name,mime){
 const blob=new Blob([source],{type:mime});
 const url=URL.createObjectURL(blob);
 const anchor=document.createElement("a");
 anchor.href=url;anchor.download=name;anchor.click();
 setTimeout(()=>URL.revokeObjectURL(url),1200);
}
for(const scenario of SCENARIOS){
 const option=text("option",scenario.label);option.value=scenario.id;
 $("scenario").append(option);
}
for(const message of MESSAGE_FAMILIES){
 const option=text("option",message.label);option.value=message.id;
 $("message-family").append(option);
}
const incoming=new URLSearchParams(window.location.search);
const requestedRail=incoming.get("rail");
if(RAILS.some(r=>r.id===requestedRail))currentRail=requestedRail;
const requestedScenario=incoming.get("scenario");
$("scenario").value=SCENARIOS.some(s=>s.id===requestedScenario)?requestedScenario:"missing-town";
$("beginner-mode").addEventListener("change",()=>{if(replaceRailList())loadSynthetic()});
$("region").addEventListener("change",()=>{if(replaceRailList())loadSynthetic()});
$("search-rails").addEventListener("input",()=>{if(replaceRailList())loadSynthetic()});
$("rail").addEventListener("change",()=>chooseRail($("rail").value));
$("currency").addEventListener("change",()=>{
 try{
  const draft=readModel();
  if(!currencyOptionsForRail(currentRail).includes($("currency").value))
   throw Error("Currency unavailable for this educational payment context.");
  draft.currency=$("currency").value;
  $("json-editor").value=JSON.stringify(draft,null,2);
  disableExports();
  $("trace-result").replaceChildren();
  feedback("Sample currency changed to "+draft.currency+". Run checks again to refresh reports and case handoff.");
 }catch(error){feedback(error.message);}
});
$("scenario").addEventListener("change",loadSynthetic);
$("load-fixture").addEventListener("click",loadSynthetic);
$("reset-editor").addEventListener("click",loadSynthetic);
$("json-editor").addEventListener("input",()=>{
 disableExports();
 $("trace-result").replaceChildren();
 try{
  const draft=JSON.parse($("json-editor").value);
  if(currencyOptionsForRail(currentRail).includes(draft.currency))$("currency").value=draft.currency;
 }catch{/* Incomplete JSON is checked when submitted. */}
 feedback("Draft modified. Run checks again before exporting or opening a case.");
});
$("validate").addEventListener("click",validate);
$("build-message").addEventListener("click",buildMessage);
$("message-family").addEventListener("change",buildMessage);
$("run-trace").addEventListener("click",runTrace);
$("apply-repair").addEventListener("click",()=>{
 try{
  if(!currentProposal)throw Error("No evidenced proposal available.");
  const model=readModel();
  const next=applyEvidenceRepair(model,currentProposal);
  $("json-editor").value=JSON.stringify(next,null,2);
  currentProposal=null;
  const report=validate();
  if(report)feedback("Reviewed town copied from original synthetic address. Other issues still require review.");
 }catch(error){feedback(error.message);}
});
$("download-message").addEventListener("click",()=>{
 if(!currentOutput)return;
 const family=$("message-family").value;
 download(currentOutput,"addressrail-"+currentRail+"-"+family.replace(/\W/g,"-")+
  (currentOutput.startsWith("<?xml")?".xml":".txt"),
  currentOutput.startsWith("<?xml")?"application/xml":"text/plain");
});
$("download-report").addEventListener("click",()=>{
 if(!currentReport||!currentMessage)return;
 download(serializeReport(currentReport,currentMessage),
  "addressrail-"+currentRail+"-synthetic-investigation.json","application/json");
});
$("send-case").addEventListener("click",()=>{
 if(!currentReport)return;
 try{
  const handoff=prepareHandoff(currentReport);
  sessionStorage.setItem(HANDOFF_KEY,JSON.stringify(handoff));
  $("handoff-status").textContent="Handoff stored privately for this tab; opening guest case management.";
  window.location.assign("../open-demo/#import-intelligence");
 }catch(error){
  $("handoff-status").textContent="Browser session storage unavailable or invalid report; download JSON instead. "+error.message;
 }
});
if(new URLSearchParams(window.location.search).get("beginner")==="1")$("beginner-mode").value="essentials";
replaceRailList();
loadSynthetic();
