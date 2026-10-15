"use strict";
// No browser storage, cookies, logging or eval. Token is ephemeral in this tab.
const $=id=>document.getElementById(id);
const node=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??"");return el};
let token=null,identity=null,selected=null,requestGeneration=0;
const say=s=>{$("feedback").textContent=s};
async function request(path,method="GET",body=null,authorized=true){
 const headers={};
 if(authorized){if(!token)throw Error("Sign in first");headers.Authorization="Bearer "+token;}
 if(body!==null)headers["Content-Type"]="application/json";
 const response=await fetch(path,{method,headers,body:body===null?undefined:JSON.stringify(body),
  cache:"no-store",credentials:"omit",redirect:"error"});
 if(response.status===401&&authorized){clearSession();throw Error("Session expired. Sign in again.");}
 if(!response.ok)throw Error("Request rejected (HTTP "+response.status+").");
 return response.json();
}
function clearSession(){
 token=null;identity=null;selected=null;requestGeneration++;
 $("workspace").hidden=true;$("login-panel").hidden=false;
 $("case-list").replaceChildren();$("detail").replaceChildren();$("review-panel").hidden=true;
 $("password").value="";$("new-password").value="";$("review-note").value="";$("evidence").value="";
}
async function login(event){
 event.preventDefault();
 const tenant=$("tenant").value.trim(),username=$("username").value.trim(),password=$("password").value;
 try{
  const loginResult=await request("/v1/login","POST",{tenant,username,password},false);
  token=loginResult.access_token;
  identity=await request("/v1/me");
  $("password").value="";
  $("identity").textContent=identity.tenant+" / "+identity.username;
  $("role").textContent=identity.role;
  $("login-panel").hidden=true;$("workspace").hidden=false;
  $("create-panel").hidden=!["ADMIN","INVESTIGATOR"].includes(identity.role);
  $("admin-panel").hidden=identity.role!=="ADMIN";
  say("Signed in to synthetic tenant "+identity.tenant+".");
  await refresh();
 }catch(error){clearSession();$("login-error").textContent=error.message;}
}
async function refresh(){
 if(!token)return;
 const generation=++requestGeneration;
 say("Loading tenant cases…");
 try{
  const cases=await request("/v1/cases");
  if(generation!==requestGeneration)return;
  $("case-list").replaceChildren();
  for(const item of cases){
   const button=node("button",item.payment_id);
   button.type="button";button.className="case";
   button.append(node("span",item.status+" · "+item.creator));
   button.setAttribute("aria-current",String(selected===item.id));
   button.addEventListener("click",()=>openCase(item.id));
   $("case-list").append(button);
  }
  say(cases.length+" synthetic case(s) in this tenant.");
 }catch(error){say(error.message);}
}
async function openCase(id){
 if(!token)return;
 const generation=++requestGeneration;
 selected=null;$("review-panel").hidden=true;$("detail").textContent="Loading case…";
 try{
  const detail=await request("/v1/cases/"+encodeURIComponent(id));
  if(generation!==requestGeneration)return;
  selected=id;$("detail-title").textContent=detail.id;
  const target=$("detail");target.replaceChildren();
  for(const [label,value] of [
   ["Payment",detail.payment_id],["Recorded state",detail.status],
   ["Opened by",detail.creator],["Reviewer",detail.reviewer||"not assigned"],
   ["Synthetic",detail.synthetic===true?"Yes":"No"]
  ])target.append(node("p",label+": "+value));
  if(detail.evidence)target.append(node("p","Synthetic evidence: "+detail.evidence));
  if(detail.decision_note)target.append(node("p","Review note: "+detail.decision_note));
  $("review-panel").hidden=identity.role!=="REVIEWER";
  $("submit-review").disabled=identity.role!=="REVIEWER"||detail.status!=="OPEN"||detail.creator===identity.username;
  for(const b of $("case-list").children)b.setAttribute("aria-current",String(b.textContent.includes(detail.payment_id)));
 }catch(error){$("detail").textContent=error.message;say(error.message);}
}
async function create(event){
 event.preventDefault();
 try{
  await request("/v1/cases","POST",{payment_id:$("payment-id").value.trim(),
   evidence:$("evidence").value.trim(),synthetic:true});
  $("evidence").value="";say("Synthetic case opened.");await refresh();
 }catch(error){say(error.message);}
}
async function createUser(event){
 event.preventDefault();
 try{
  const result=await request("/v1/users","POST",{
   username:$("new-username").value.trim(),password:$("new-password").value,role:$("new-role").value});
  $("new-password").value="";
  say("Training user created: "+result.username+" ("+result.role+").");
 }catch(error){$("new-password").value="";say(error.message);}
}
async function review(event){
 event.preventDefault();if(!selected)return;
 const caseId=selected;$("submit-review").disabled=true;
 try{
  await request("/v1/cases/"+encodeURIComponent(caseId)+"/review","POST",{
   decision:$("decision").value,note:$("review-note").value.trim()});
  $("review-note").value="";
  say("Training review recorded; payment status unchanged.");
  await refresh();await openCase(caseId);
 }catch(error){say(error.message);if(selected===caseId)$("submit-review").disabled=false;}
}
async function verify(){
 try{
  const outcome=await request("/v1/audit/verify");
  $("audit-result").textContent="Audit HMAC chain: "+(outcome.valid?"valid":"MISMATCH")+
   " · checked "+outcome.checked+". Not immutable or externally attested.";
 }catch(error){$("audit-result").textContent=error.message;}
}
async function logout(){
 if(token){try{await request("/v1/logout","POST");}catch{/* Local session cleared regardless of connectivity. */}}
 clearSession();
}
$("login-form").addEventListener("submit",login);
$("logout").addEventListener("click",logout);
$("refresh").addEventListener("click",refresh);
$("create-form").addEventListener("submit",create);
$("user-form").addEventListener("submit",createUser);
$("review-form").addEventListener("submit",review);
$("verify").addEventListener("click",verify);
window.addEventListener("pagehide",()=>{token=null;});
window.addEventListener("pageshow",event=>{if(event.persisted)clearSession();});
