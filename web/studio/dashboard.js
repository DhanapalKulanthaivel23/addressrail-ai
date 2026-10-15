import{RAILS,getRail}from"./payment-intelligence/catalog.mjs";
import{connectionsFor,JOURNEY_IDS}from"./journeys/core.mjs";
import{EXAMPLES,evaluateExample,evaluationSummary}from"./ai-lab/guardrails.mjs";
const $=id=>document.getElementById(id),el=(tag,s)=>{const x=document.createElement(tag);x.textContent=String(s??"");return x;};
const essentials=new Set(["chaps","fps","bacs-credit","bacs-debit","sct","sct-inst","cbpr","t2"]);
const paths={chaps:["Sending bank","CHAPS instruction","BoE RTGS","Receiving bank"],fps:["Payer / PSP","Faster Payments","Receiving PSP","Customer"],"sct-inst":["Debtor PSP","RT1 OR TIPS","Creditor PSP","Response"],sct:["Debtor PSP","SCT via CSM","Creditor PSP","Reporting"],cbpr:["Sending bank","CBPR+ message","Correspondent","Receiving bank"],"bacs-debit":["Originator","Bacs batch","Paying bank","Unpaid report"],"bacs-credit":["Originator","Bacs batch","Payee bank","Credit report"],t2:["Participant","T2 settlement","RTGS account","Confirmation"],gpi:["Participating bank","gpi Tracker","Status sources","UETR evidence"],cls:["Settlement member","CLS funding","FX PvP service","Reporting"]};
const filterButtons=[...document.querySelectorAll("#dashboard-filters button")];
let filter="all",selected="chaps";
const matches=(r)=>filter==="all"||filter==="beginner"&&essentials.has(r.id)||filter==="uk"&&r.region==="UK"||filter==="eu"&&r.region.startsWith("EU")||filter==="global"&&(r.region==="Global"||r.region==="Cross-border");
function drawMap(){
 const r=getRail(selected),rel=connectionsFor(selected);
 $("dashboard-map-title").textContent=r.name;$("dashboard-map-type").textContent=r.kind;
 $("dashboard-map-region").textContent=r.region;
 $("dashboard-map-description").textContent=r.description;
 $("dashboard-map-reference").href=r.reference;
 $("dashboard-map-related").textContent=rel.length?"Related concepts: "+rel.slice(0,3).map(x=>x.related.name).join(" · ")+". Not live routing.":"No curated relation for this introductory context.";
 const isDeep=JOURNEY_IDS.includes(selected);
 $("dashboard-map-open").href=isDeep?"journeys/?mode=professional&rail="+encodeURIComponent(selected):"payment-intelligence/?rail="+encodeURIComponent(selected);
 $("dashboard-map-open").textContent=isDeep?"Open detailed journey →":"Explore introductory context →";
 const flow=$("dashboard-map-flow");flow.replaceChildren();
 const arr=paths[selected]||["Payment actors",r.name,"Related concept","Status evidence"];
 arr.forEach((x,i)=>{const box=el("div",x);box.className="flow-node"+(i===1?" selected":"");flow.append(box);if(i<arr.length-1){const a=el("span","→");a.className="flow-arrow";a.setAttribute("aria-hidden","true");flow.append(a)}});
 for(const b of $("dashboard-rail-list").children)b.setAttribute("aria-pressed",String(b.dataset.rail===selected));
}
function drawList(){
 const items=RAILS.filter(matches);if(!items.some(x=>x.id===selected))selected=items[0]?.id||"chaps";
 const list=$("dashboard-rail-list");list.replaceChildren();
 for(const r of items){const b=el("button",r.name);b.type="button";b.dataset.rail=r.id;b.title=r.description;
  b.addEventListener("click",()=>{selected=r.id;drawList()});list.append(b)}
 drawMap();
}
for(const b of filterButtons)b.addEventListener("click",()=>{filter=b.dataset.filter;for(const x of filterButtons)x.setAttribute("aria-pressed",String(x===b));drawList()});
drawList();
const cases=$("dashboard-ai-case");
for(const f of EXAMPLES){const o=el("option",f.title);o.value=f.id;cases.append(o)}
function drawAI(){
 const f=EXAMPLES.find(x=>x.id===cases.value)||EXAMPLES[0];
 const {result,simulation}=evaluateExample(f);
 $("dashboard-ai-context").textContent=simulation.journey.title+" · "+simulation.scenario.label+" · FICTIONAL "+simulation.status;
 $("dashboard-ai-claim").textContent="“"+f.claim+"”";
 const verdict=$("dashboard-ai-verdict");
 verdict.textContent=(result.verdict==="REJECT"?"✕ Unsupported claim rejected":"✓ No listed rule fired")+" · "+result.verdict;
 verdict.classList.toggle("allowed",result.verdict==="ALLOW");
 $("dashboard-ai-reason").textContent=f.why;
 const box=$("dashboard-ai-rules");box.replaceChildren();
 for(const issue of result.violations.slice(0,4))box.append(el("span",issue.id+" · "+issue.explanation));
 if(!result.violations.length)box.append(el("span","ALLOW does not verify truth. Evidence: "+result.evidenceRef));
}
cases.addEventListener("change",drawAI);cases.value="INSTANT_UNKNOWN";drawAI();
const stats=evaluationSummary();
$("dashboard-ai-summary").textContent=stats.passed+"/"+stats.cases+" authored tests matched expected outcomes";
const lessons=[
 ["Banking Foundations","Learn banks, PSPs, payment instructions, clearing and settlement.",["Who participates?","What does an instruction mean?","Clearing versus settlement"],"start/"],
 ["Payment Messages","Understand ISO 20022 pain, pacs and camt families.",["Customer-to-bank messages","Interbank instructions","Status and reporting"],"sepa-sct/"],
 ["UK Payment Systems","Compare CHAPS, Faster Payments and Bacs.",["BoE RTGS for CHAPS","Retail versus high-value","Liquidity hold investigations"],"chaps/?scenario=liquidity-hold#case-lab"],
 ["European Payments","Investigate SCT transfers, CSMs, rejections and returns.",["EPC scheme versus infrastructure","pacs.008 concepts","Post-processing return"],"journeys/?mode=learner&rail=sct&scenario=post-clearing-return"],
 ["Instant Payments","Examine SCT Inst unknown outcomes and retry risk.",["RT1 versus TIPS","Reject versus timeout","Reconcile before retry"],"sct-inst/?scenario=timeout"]
];
let chosen=0;const choices=$("dashboard-lesson-list");
for(let i=0;i<lessons.length;i++){const b=el("button",(i+1)+". "+lessons[i][0]);b.type="button";b.dataset.lesson=i;b.addEventListener("click",()=>{chosen=i;drawLesson()});choices.append(b)}
function drawLesson(){
 const [title,description,points,url]=lessons[chosen];
 $("dashboard-lesson-title").textContent=title;$("dashboard-lesson-summary").textContent=description;
 $("dashboard-lesson-number").textContent="LESSON "+(chosen+1)+" / 5";
 $("dashboard-lesson-open").href=url;
 const ul=$("dashboard-lesson-points");ul.replaceChildren();for(const p of points)ul.append(el("li",p));
 for(const b of choices.children)b.setAttribute("aria-pressed",String(Number(b.dataset.lesson)===chosen));
 document.querySelectorAll(".lesson-progress-dots span").forEach((d,i)=>d.style.background=i===chosen?"#0b447d":"");
}
drawLesson();
