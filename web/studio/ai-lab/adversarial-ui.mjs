import {ADVERSARIAL_CASES,adversarialResults,ruleResults,EXAMPLES} from "./guardrails.mjs";
const $=id=>document.getElementById(id);
const make=(tag,value)=>{const n=document.createElement(tag);n.textContent=String(value??"");return n};
const container=$("adversarial-list");
for(const row of adversarialResults()){
 const article=make("article","");article.className="card";
 const f=row.fixture;
 article.append(make("h3",f.title),make("p","Synthetic claim: "+f.claim),
  make("p","Expected: "+f.expected+" / Actual: "+row.result.verdict),
  make("p","Rule IDs: "+row.result.violations.map(x=>x.id).join(", ")));
 const run=make("button","Try this claim in the playground");run.type="button";run.className="text-action";
 run.addEventListener("click",()=>{
  const matched=EXAMPLES.find(x=>x.rail===f.rail&&x.scenario===f.scenario);
  if(!matched)return;
  $("fixture").value=matched.id;
  $("fixture").dispatchEvent(new Event("change",{bubbles:true}));
  $("model-claim").value=f.claim;
  $("check-claim").click();
  $("guardrails").scrollIntoView({behavior:"smooth"});
 });article.append(run);container.append(article);
}
const tbody=$("ar-rule-evaluation");let sum=0;
for(const rule of ruleResults()){
 const tr=make("tr","");
 for(const value of [rule.id,rule.description,rule.examples,rule.passed]){
  tr.append(make("td",value));
 }tbody.append(tr);sum+=rule.examples;
}
$("ar-rule-summary").textContent=ADVERSARIAL_CASES.length+" adversarial cases plus "+EXAMPLES.length+
 " baseline cases; "+sum+" fired-rule occurrences across the authored corpus.";
