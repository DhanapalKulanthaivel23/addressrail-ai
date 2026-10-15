import {COMPARISON,compareRails} from "./compare.mjs";
const $=id=>document.getElementById(id);
const e=(tag,content)=>{const n=document.createElement(tag);if(content!==undefined)n.textContent=String(content);return n};
const box=$("compare-pick"),table=$("compare-results"),notice=$("compare-message");
const ids=COMPARISON.map(x=>x.id);
const raw=(new URLSearchParams(location.search).get("compare")||"").split(",");
let selected=(raw.length>=2&&raw.length<=4&&new Set(raw).size===raw.length&&raw.every(x=>ids.includes(x)))?raw:["chaps","sct-inst"];
function render(){
 const check=[...box.querySelectorAll("input[type=checkbox]")];
 for(const entry of check)entry.checked=selected.includes(entry.value);
 table.replaceChildren();
 let chosen;
 try{chosen=compareRails(selected)}catch(error){notice.textContent=error.message;return}
 notice.textContent="Conceptual educational comparison only. Consult scheme operator rules and versions.";
 const thead=e("thead"),row=e("tr");row.append(e("th","Topic"));
 for(const rail of chosen)row.append(e("th",rail.title));thead.append(row);
 table.append(thead);
 const body=e("tbody");
 const fields=[["Actors","actors"],["Timing","when"],["Settlement infrastructure","settlement"],["Finality and evidence","finality"],["Messages","messages"],["Failure modes","exceptions"]];
 for(const [name,key] of fields){
  const tr=e("tr");tr.append(e("th",name));
  for(const rail of chosen)tr.append(e("td",rail[key]));
  body.append(tr);
 }
 const sourceRow=e("tr");sourceRow.append(e("th","Operator reference"));
 for(const rail of chosen){
  const td=e("td"),a=e("a","Official reference ↗");a.href=rail.reference;
  a.rel="noopener noreferrer";a.target="_blank";td.append(a);sourceRow.append(td);
 }
 body.append(sourceRow);table.append(body);
 const url=new URL(location.href);url.searchParams.set("compare",selected.join(","));
 history.replaceState(null,"",url.pathname+url.search+url.hash);
}
for(const rail of COMPARISON){
 const label=e("label"),checkbox=e("input");
 checkbox.type="checkbox";checkbox.value=rail.id;checkbox.checked=selected.includes(rail.id);
 checkbox.addEventListener("change",()=>{
  const tentative=checkbox.checked?[...selected,rail.id]:selected.filter(x=>x!==rail.id);
  if(tentative.length<2||tentative.length>4){
   checkbox.checked=!checkbox.checked;notice.textContent="Choose between 2 and 4 rails.";return;
  }
  selected=tentative;render();
 });
 label.append(checkbox,document.createTextNode(" "+rail.title));box.append(label);
}
$("compare-copy").addEventListener("click",async()=>{
 const url=location.href;
 try{await navigator.clipboard.writeText(url);notice.textContent="Shareable comparison link copied."}
 catch{notice.textContent="Copy this URL to share: "+url}
});
$("compare-print").addEventListener("click",()=>window.print());
render();
