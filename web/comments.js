/** Shared AddressRail AI comment section for all 14 content pages.
 * Uses moderated Cloudflare D1; never claim local-only comments are shared.
 * Text always rendered via textContent (not HTML).
 */
(()=>{"use strict";
const ROOT="/addressrail-ai/";
const allowed=new Set([
 "/","/studio/","/studio/start/","/studio/journeys/",
 "/studio/payment-intelligence/","/studio/sepa-sct/","/studio/sct-inst/",
 "/studio/chaps/","/studio/ai-lab/","/studio/open-demo/",
 "/mt103-address-correction/","/iso20022-structured-address/",
 "/pacs008-address-validation/","/cbpr-address-guide/"
]);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const api=(window.ADDRESSRAIL_COMMENTS_URL||"").trim().replace(/\/$/,"");
const deployed=location.hostname==="dhanapalkulanthaivel23.github.io";
const path=decodeURI(location.pathname);
const page=path.startsWith(ROOT)?"/"+path.slice(ROOT.length):"";
const key=page.endsWith("/")?page:page+"/";
function init(){
 const root=document.querySelector(".ra-comments[data-comments-page]");
 if(!root||!allowed.has(key))return;
 const target=root.querySelector(".ra-comments-app");
 if(!target)return;
 target.replaceChildren();
 const status=el("p","Loading community comments…","ra-comment-status");
 status.setAttribute("role","status");status.setAttribute("aria-live","polite");
 const actions=el("div",undefined,"ra-comment-actions");
 const refresh=el("button","Refresh comments ↻","ra-comment-refresh");refresh.type="button";
 actions.append(refresh);
 const list=el("div",undefined,"ra-comment-list");
 const form=el("form",undefined,"ra-comment-form");form.noValidate=false;
 const title=el("h3","Leave a comment");
 const expl=el("p","Comments are public after review. No account needed. Do not include confidential banking, payment or personal information.","ra-comment-hint");
 const nameLabel=el("label","Display name");nameLabel.htmlFor="ra-comment-name";
 const name=el("input");name.id="ra-comment-name";name.name="displayName";name.type="text";
 name.required=true;name.minLength=2;name.maxLength=50;name.autocomplete="nickname";
 name.placeholder="Your name";
 const messageLabel=el("label","Comment");messageLabel.htmlFor="ra-comment-message";
 const message=el("textarea");message.id="ra-comment-message";message.name="message";
 message.required=true;message.minLength=10;message.maxLength=1000;
 message.rows=4;message.placeholder="Share feedback or ask a question about this page (10–1000 characters).";
 const honeypotLabel=el("label","Website (leave blank)","ra-comments-honeypot");
 const honey=el("input");honey.name="website";honey.type="text";honey.autocomplete="off";honey.tabIndex=-1;honeypotLabel.append(honey);
 const consentLabel=el("label",undefined,"ra-comment-consent");
 const consent=el("input");consent.type="checkbox";consent.required=true;
 consentLabel.append(consent,document.createTextNode(" I understand this comment may be published after moderation."));
 const captcha=el("div",undefined,"ra-comment-captcha");
 const submit=el("button","Submit comment for review →","ra-comment-submit");
 submit.type="submit";submit.disabled=true;
 const feedback=el("p","Comments require a configured shared service.","ra-comment-feedback");
 feedback.setAttribute("role","status");feedback.setAttribute("aria-live","polite");
 form.append(title,expl,nameLabel,name,messageLabel,message,honeypotLabel,consentLabel,captcha,submit,feedback);
 target.append(actions,status,list,form);
 let widgetId=null,turnstileReady=false,enabled=false;
 async function fetchJSON(url,options){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
   const response=await fetch(url,{mode:"cors",cache:"no-store",signal:controller.signal,...options});
   let data={};try{data=await response.json()}catch{}
   if(!response.ok)throw Error(data.error||"Comments service unavailable");
   return data;
  }finally{clearTimeout(timer);}
 }
 async function readComments(){
  if(!deployed||!/^https:\/\//i.test(api)){
   status.textContent="Community comments are available on the published site after setup.";
   list.replaceChildren();return;
  }
  try{
   const results=await fetchJSON(api+"/api/comments?page="+encodeURIComponent(key));
   const posts=Array.isArray(results.comments)?results.comments:[];
   status.textContent=posts.length?posts.length+" approved comment"+(posts.length===1?"":"s")+" on this page.":"No approved comments yet. Be the first to contribute.";
   list.replaceChildren();
   for(const row of posts){
    if(!row||typeof row.name!=="string"||typeof row.message!=="string")continue;
    const article=el("article",undefined,"ra-comment-item");
    const head=el("div",undefined,"ra-comment-byline");
    const nameText=el("strong",row.name.slice(0,50));
    const time=el("time",undefined);
    const date=Date.parse(row.created_at);
    time.textContent=Number.isFinite(date)?new Date(date).toLocaleDateString("en-GB",{year:"numeric",month:"short",day:"numeric"}):"";
    if(Number.isFinite(date))time.dateTime=row.created_at;
    head.append(nameText,time);
    article.append(head,el("p",row.message.slice(0,1000)));
    list.append(article);
   }
  }catch{
   status.textContent="Public comments are not available yet. The owner must activate shared comment storage.";
   list.replaceChildren();
  }
 }
 async function setupCaptcha(siteKey){
  try{
   await new Promise((resolve,reject)=>{
    if(window.turnstile?.render)return resolve();
    const tag=document.createElement("script");
    tag.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    tag.async=true;tag.defer=true;tag.onload=resolve;tag.onerror=reject;
    document.head.append(tag);
   });
   if(!window.turnstile?.render)throw Error("Challenge unavailable");
   widgetId=window.turnstile.render(captcha,{
    sitekey:siteKey,action:"addressrail_comment",theme:"light",
    callback:()=>{turnstileReady=true;submit.disabled=false;},
    "expired-callback":()=>{turnstileReady=false;submit.disabled=true;},
    "error-callback":()=>{turnstileReady=false;submit.disabled=true;}
   });
   feedback.textContent="Complete the human-verification check before submitting.";
  }catch{
   feedback.textContent="Human verification could not load. Comments cannot be submitted.";
  }
 }
 async function configure(){
  if(!deployed||!/^https:\/\//i.test(api)){
   feedback.textContent="Shared comments are only available on the deployed site with the service configured.";
   return;
  }
  try{
   const config=await fetchJSON(api+"/api/comments/config");
   if(config.enabled!==true||typeof config.siteKey!=="string"||!config.siteKey){
    feedback.textContent="Comment submissions are not enabled yet. The site owner needs to finish backend setup.";
    return;
   }
   enabled=true;
   await setupCaptcha(config.siteKey);
  }catch{
   feedback.textContent="Comment submissions are not enabled yet. Please check again later.";
  }
 }
 refresh.addEventListener("click",readComments);
 form.addEventListener("submit",async event=>{
  event.preventDefault();
  if(!enabled||!turnstileReady||!window.turnstile||widgetId===null){
   feedback.textContent="Complete human verification before posting.";return;
  }
  if(!form.reportValidity())return;
  submit.disabled=true;
  feedback.textContent="Submitting for moderation…";
  try{
   const token=window.turnstile.getResponse(widgetId);
   const result=await fetchJSON(api+"/api/comments",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({page:key,name:name.value,message:message.value,
     website:honey.value,agree:consent.checked,turnstileToken:token})
   });
   feedback.textContent=result.message||"Comment submitted for approval.";
   message.value="";consent.checked=false;
  }catch(error){
   feedback.textContent=error.message||"Submission failed. Please try again.";
  }finally{
   turnstileReady=false;
   try{window.turnstile.reset(widgetId)}catch{}
  }
 });
 void Promise.all([readComments(),configure()]);
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
else init();
})();