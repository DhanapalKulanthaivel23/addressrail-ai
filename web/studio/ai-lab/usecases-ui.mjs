import {USE_CASES,filterUseCases} from "./usecases.mjs";
const select=document.getElementById("ar-usecase-risk"),table=document.getElementById("ar-usecase-body");
const base="../";
function make(tag,content){const n=document.createElement(tag);n.textContent=String(content??"");return n}
function render(){
 if(!table)return;
 table.replaceChildren();
 for(const uc of filterUseCases(select.value)){
  const row=make("tr"),fields=[uc.id,uc.rail,uc.task,uc.data,uc.risk,uc.human,uc.metric,uc.status];
  for(const cell of fields)row.append(make("td",cell));
  const td=make("td"),a=make("a","View demo →");
  a.href=(uc.link.startsWith("../")?uc.link:base+uc.link);
  td.append(a);row.append(td);table.append(row);
 }
 document.getElementById("ar-usecase-count").textContent=table.children.length+" use cases";
}
select?.addEventListener("change",render);if(select)render();
