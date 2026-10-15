/** Shared navigation, audience preference, version, and trust/status metadata.
 * Rendered uniformly on all fourteen AddressRail AI content pages.
 * No network calls; browser storage is optional and safe to disable.
 */
(()=>{
"use strict";
const BASE="/addressrail-ai/";
const VERSION="v2.1 · 15 October 2026";
const REVIEWED="15 October 2026";
const MODE_KEY="addressrail.mode.v1";
const ROUTES=[
 ["/","Home"],["/studio/","Studio"],["/studio/start/","Start Here"],
 ["/studio/journeys/","Journeys"],["/studio/payment-intelligence/","Payment Systems"],
 ["/studio/sepa-sct/","SCT"],["/studio/sct-inst/","SCT Inst"],
 ["/studio/chaps/","CHAPS"],["/studio/ai-lab/","AI Lab"],
 ["/studio/open-demo/","Guest Cases"],
 ["/mt103-address-correction/","MT103 Guide"],
 ["/iso20022-structured-address/","ISO Addresses"],
 ["/pacs008-address-validation/","pacs.008 Guide"],
 ["/cbpr-address-guide/","CBPR+ Guide"]
];
const ROLES=new Set(["professional","ai","learner"]);
const terms={
 professional:{label:"Expert",title:"Present a payment flow",description:"Use evidence, presenter scripts and rule-version references; financial messaging is not proof of settlement.",href:"/studio/journeys/?mode=professional"},
 ai:{label:"AI",title:"Explore AI guardrails",description:"Review deterministic rule IDs and the limitations of hypothetical LLM claims. No live public model is used here.",href:"/studio/ai-lab/"},
 learner:{label:"Learner",title:"Learn and test payments",description:"Open guided tooltips, beginner explanations and questions, then use the six-rail learning quizzes.",href:"/studio/journeys/?mode=learner"}
};
const e=(tag,value,cls)=>{
 const n=document.createElement(tag);
 if(value!==undefined)n.textContent=value;
 if(cls)n.className=cls;
 return n;
};
const pageUrl=()=>{
 const path=location.pathname;
 let relative=path.startsWith(BASE)?"/"+path.slice(BASE.length):path;
 if(!relative.endsWith("/"))relative+="/";
 return ROUTES.some(x=>x[0]===relative)?relative:"/";
};
const urlFor=relative=>BASE+relative.replace(/^\//,"");
function getSaved(){
 try{return localStorage.getItem(MODE_KEY)}catch{return null}
}
function store(mode){
 try{localStorage.setItem(MODE_KEY,mode);return true}catch{return false}
}
let role="learner",persisted=true;
const uri=new URL(location.href);
let fromQuery=uri.searchParams.get("mode");
if(ROLES.has(fromQuery))role=fromQuery;
else if(ROLES.has(getSaved()))role=getSaved();
persisted=store(role);
function refAnchor(text,href){
 const a=e("a",text);a.href=href;return a;
}
function syncModeLinks(nav){
 for(const a of nav.querySelectorAll("a[data-ar-page]")){
  const url=new URL(a.href);
  if(url.searchParams.has("mode")||!a.href.includes("/studio/"))continue;
  url.searchParams.set("mode",role);
  a.href=url.pathname+url.search+url.hash;
 }
}
function showState(nav,selector,hint,rolebox){
 document.body.dataset.arMode=role;
 selector.value=role;
 const value=terms[role];
 rolebox.replaceChildren(e("strong",value.title),e("p",value.description));
 const link=refAnchor(role==="professional"?"Open presenter scripts →":
  role==="ai"?"Open AI rules and examples →":"Open quiz and beginner glossary →",urlFor(value.href));
 rolebox.append(link);
 hint.textContent=persisted?"Choice saved for your next visit.":"Browser storage unavailable; this choice is active for this page only.";
 syncModeLinks(nav);
 window.dispatchEvent(new CustomEvent("addressrail:mode",{detail:{mode:role}}));
}
function init(){
 if(document.querySelector("#ar-shared-nav"))return;
 const current=pageUrl();
 const nav=e("nav",undefined,"ar-shared-nav");
 nav.id="ar-shared-nav";nav.setAttribute("aria-label","AddressRail AI navigation");
 nav.append(refAnchor("AddressRail AI",urlFor("/")));
 const pages=e("div",undefined,"ar-nav-pages");
 for(const [path,label] of ROUTES){
  const a=refAnchor(label,urlFor(path));a.dataset.arPage=path;
  if(path===current){a.setAttribute("aria-current","page");a.classList.add("ar-current")}
  pages.append(a);
 }
 nav.append(pages);
 const roleWrap=e("div",undefined,"ar-role-control");
 const label=e("label","View as");label.htmlFor="ar-role";
 const select=e("select");select.id="ar-role";select.setAttribute("aria-label","Choose site-wide audience mode");
 for(const [value,entry] of Object.entries(terms)){
  const option=e("option",entry.label);option.value=value;select.append(option);
 }
 roleWrap.append(label,select);nav.append(roleWrap);
 document.body.prepend(nav);
 const main=document.querySelector("main");
 if(!main)return;
 const app=e("div",undefined,"ar-shared-context");
 const modeBox=e("div",undefined,"ar-mode-context");
 const hint=e("p",undefined,"ar-mode-hint");
 app.append(modeBox,hint);
 const title=e("div",undefined,"ar-site-metadata");
 const rail=current.includes("sepa")||current.includes("sct")?"EPC 2025 rulebooks v1.2 (30 September 2026)":
  current.includes("chaps")?"BoE RTGS/CHAPS: current operator guidance":
  current.includes("mt103")?"Legacy FIN MT103: ISO 20022 transition (November 2025)":
  current.includes("cbpr")?"CBPR+ SR2026: deferred; no universal new cutover date":
  "Illustrative educational ruleset; check current operator standards";
 title.append(e("strong","Reviewed "+REVIEWED+" · "+rail));
 const issue=refAnchor("Report an error ↗","https://github.com/DhanapalKulanthaivel23/addressrail-ai/issues/new?template=content-error.yml&title="+
  encodeURIComponent("Content issue: "+current)+"&page_url="+encodeURIComponent(location.origin+location.pathname));
 issue.target="_blank";issue.rel="noopener noreferrer";issue.className="ar-error-link";
 title.append(issue);
 app.append(title);
 const trust=e("div",undefined,"ar-trust-box");
 trust.setAttribute("role","note");
 trust.append(e("p","REAL: Public scheme/standards concepts and basic calculations are described with reference links; this page is not an official data feed."),
  e("p","RULE SUBSET: Demonstration checks cover selected teaching rules only, not full ISO XSD or scheme implementation guidelines."),
  e("p","SIMULATED: Payment traces, case evidence, outcomes and example model claims are fictional; no payment is sent or settled."));
 app.append(trust);
 if(["/cbpr-address-guide/","/iso20022-structured-address/","/studio/chaps/","/studio/sct-inst/"].includes(current)){
  const alert=e("section",undefined,"ar-address-status");alert.setAttribute("aria-label","Current address format standards status");
  const heading=e("h2","Address format status · "+REVIEWED);
  alert.append(heading);
  const list=e("ul");
  const events=[
   ["Swift","27 August 2026: deferred the SR2026 payments changes and extended structured-address transition. Swift promised an update by December 2026 at the latest; no replacement mandate date was announced.","https://www.swift.com/fr/node/310752"],
   ["EPC","Decision on 9 September 2026, published 10 September: postponed the end of unstructured addresses. 2025 SCT/SCT Inst v1.2 took effect 30 September; replacement date not yet announced.","https://www.europeanpaymentscouncil.eu/news-insights/news/epc-delays-address-format-migration-timeline"],
   ["Bank of England","27 August 2026: deferred the whole November 2026 RTGS standards release, including CHAPS messaging. No revised release date is asserted here.","https://www.bankofengland.co.uk/news/2026/august/delay-to-the-november-2026-rtgs-standards-release"]
  ];
  for(const [org,description,href] of events){
   const li=e("li");li.append(e("strong",org+": "),document.createTextNode(description+" "),refAnchor("Official source ↗",href));list.append(li);
  }
  alert.append(list,e("p","Status owner: AddressRail AI maintainer. Recheck on an EPC/Swift/BoE announcement and before relying on a release date."));
  app.append(alert);
 }
 main.prepend(app);
 const footer=main.querySelector("footer")||document.querySelector("footer");
 if(footer){
  const stamp=e("span"," · AddressRail "+VERSION,"ar-footer-version");
  footer.append(stamp);
 }
 if(!document.querySelector("#ar-skip")){
  const skip=refAnchor("Skip navigation",main.id?"#"+main.id:"#ar-page-top");
  skip.id="ar-skip";skip.className="ar-skip";
  if(!main.id)main.id="ar-page-top";
  nav.before(skip);
 }
 showState(nav,select,hint,modeBox);
 select.addEventListener("change",()=>{
  if(!ROLES.has(select.value))return;
  role=select.value;persisted=store(role);
  const target=new URL(location.href);
  target.searchParams.set("mode",role);
  history.pushState({arMode:role},"",target.pathname+target.search+target.hash);
  showState(nav,select,hint,modeBox);
 });
 window.addEventListener("popstate",()=>{
  const search=new URLSearchParams(location.search).get("mode");
  role=ROLES.has(search)?search:ROLES.has(getSaved())?getSaved():"learner";
  persisted=store(role);showState(nav,select,hint,modeBox);
 });
 window.addEventListener("addressrail:select-mode",event=>{
  if(!ROLES.has(event.detail?.mode))return;
  role=event.detail.mode;persisted=store(role);showState(nav,select,hint,modeBox);
 });
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();