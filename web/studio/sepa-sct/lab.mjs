import {FIXTURE, SCENARIOS, simulate} from "./core.mjs";
const ids=["debtorName","creditorName","debtorIban","creditorIban","debtorBic","creditorBic","amount","reference"];
const el=id=>document.getElementById(id);
const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node};
let current=null,active=null;
for(const id of ids) el(id).value=FIXTURE[id];
function view(){
 const inputs=Object.fromEntries(ids.map(id=>[id,el(id).value]));
 current=simulate(inputs,el("sct-scenario").value);
 const feedback=el("lab-feedback"),events=el("lab-events"),tabs=el("message-tabs");
 feedback.replaceChildren();events.replaceChildren();tabs.replaceChildren();
 feedback.append(make("strong","Outcome: "+current.status+" / settlement: "+current.settlement));
 if(current.note)feedback.append(make("p",current.note));
 for(const error of current.errors || []) feedback.append(make("p","Input check: "+error));
 for(const e of current.events){
  const item=make("article","");item.append(make("b",e.stage+". "+e.actor),make("p",e.description),make("small",e.status+" · "+e.evidenceRef));events.append(item);
 }
 const keys=Object.keys(current.messages);
 active=keys[0]||null;
 for(const key of keys){
  const btn=make("button",key);btn.type="button";
  btn.addEventListener("click",()=>{active=key;showXml()});tabs.append(btn);
 }
 showXml();
}
function showXml(){
 const xml=current?.messages[active]||"No XML generated: correct the input fields before proceeding.";
 el("generated-xml").textContent=xml;
 for(const b of el("message-tabs").children)b.setAttribute("aria-pressed",String(b.textContent===active));
 el("copy-xml").disabled=!active;el("download-xml").disabled=!active;
 el("copy-state").textContent="";
}
el("sct-form").addEventListener("submit",event=>{event.preventDefault();view()});
el("copy-xml").addEventListener("click",async()=>{if(!active)return;try{await navigator.clipboard.writeText(current.messages[active]);el("copy-state").textContent="Synthetic XML copied."}catch{el("copy-state").textContent="Clipboard is unavailable; select and copy the XML manually."}});
el("download-xml").addEventListener("click",()=>{
 if(!active)return;
 const blob=new Blob([current.messages[active]],{type:"application/xml"});
 const url=URL.createObjectURL(blob);
 const link=make("a","");link.href=url;link.download="addressrail-sct-"+active.replace(".","-")+".xml";link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
});
view();
