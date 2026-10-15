const $=id=>document.getElementById(id);
const create=(tag,s)=>{const e=document.createElement(tag);e.textContent=String(s??"");return e;};
const steps=[
 ["Foundations","Learn about customers, banks, PSPs, accounts, instructions, clearing and settlement.","../journeys/?mode=learner&rail=chaps&scenario=success","Explain why an instruction is not settlement."],
 ["ISO 20022 messages","Compare customer-to-bank pain messages, interbank pacs messages and account-reporting camt families.","../sepa-sct/","Identify which party sends a pacs.008."],
 ["One UK payment system","Explore CHAPS settlement at BoE RTGS and contrast it with retail Faster Payments and Bacs.","../chaps/","Explain gross settlement versus retail processing."],
 ["One European payment scheme","Learn SCT, banks/PSPs, a possible CSM route, rejections and returns.","../journeys/?mode=learner&rail=sct&scenario=iban-reject","Identify why a rejected instruction is not a returned payment."],
 ["Instant payments","Use SCT Inst to distinguish explicit rejection from an unknown outcome after a lost response.","../sct-inst/?scenario=timeout","Explain why an automatic retry could duplicate funds movement."]
];
const terms=[
 ["PSP","Payment Service Provider: an institution that provides regulated payment services; precise legal meaning depends on jurisdiction."],
 ["Scheme","A common set of participant rules for a payment type; different from the infrastructure used to exchange or settle it."],
 ["Clearing","The processing and exchange of payment instructions or obligations before/around settlement, depending on system design."],
 ["Settlement","Discharge of financial obligations between participants; may be gross or net depending on the payment system."],
 ["RTGS","Real-Time Gross Settlement: settling qualifying transfer obligations individually in central-bank money."],
 ["CSM","Clearing and Settlement Mechanism: infrastructure route used by participating PSPs, such as STEP2 in some SCT arrangements."],
 ["SWIFT / CBPR+","Swift is a financial messaging network; CBPR+ is its ISO 20022 cross-border payment message usage profile, not a settlement rail."],
 ["UETR","Unique End-to-end Transaction Reference for correlating relevant cross-border SWIFT payment messaging/tracking."],
 ["pain / pacs / camt","ISO 20022 message families commonly associated with customer initiation, payment clearing/settlement and cash management."],
 ["Return / recall","A return is a subsequent payment-related outcome; a recall is a request to retrieve or cancel, not proof of success."],
 ["UNKNOWN","No authoritative final outcome available; neither success nor failure can be inferred."],
 ["AI guardrail","Deterministic or human controls preventing an AI suggestion from becoming an unsupported payment assertion or action."]
];
const KEY="addressrail.start.lessons.v2";
let completed=[];
try{const parsed=JSON.parse(sessionStorage.getItem(KEY)||"[]");if(Array.isArray(parsed))completed=parsed.filter(n=>Number.isInteger(n)&&n>=0&&n<steps.length);}catch{}
const store=()=>{try{sessionStorage.setItem(KEY,JSON.stringify(completed));}catch{}};
function render(){
 const box=$("lesson-grid");box.replaceChildren();
 for(let i=0;i<steps.length;i++){
  const [title,description,link,check]=steps[i],article=create("article","");
  article.className="card";article.append(create("small","LESSON "+(i+1)+" OF 5"));
  article.append(create("h3",title),create("p",description));
  const action=create("a","Open interactive exercise →");action.href=link;article.append(action);
  article.append(create("p","Can you answer? "+check));
  const label=create("label","");
  const checkbox=create("input","");checkbox.type="checkbox";checkbox.checked=completed.includes(i);
  checkbox.addEventListener("change",()=>{completed=completed.filter(v=>v!==i);if(checkbox.checked)completed.push(i);store();render()});
  label.append(checkbox,document.createTextNode(" I completed this exercise and can explain it."));
  article.append(label);box.append(article);
 }
 $("progress-message").textContent=completed.length+" of "+steps.length+
 " lessons marked complete in this browser tab. Completion is self-reported.";
}
for(const [term,definition] of terms){const box=create("article","");box.title=definition;
 const h=create("h3",term);h.tabIndex=0;h.setAttribute("aria-label",term+": "+definition);
 box.append(h,create("p",definition));$("glossary-cards").append(box);
}
$("reset-lessons").addEventListener("click",()=>{completed=[];store();render()});
render();
