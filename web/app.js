(() => {
'use strict';
const $=id=>document.getElementById(id);
const mx=structured=>`<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf><GrpHdr><MsgId>DEMO-001</MsgId></GrpHdr><CdtTrfTxInf>
<Dbtr><Nm>SAMPLE TRADING</Nm><PstlAdr>${structured?'<TwnNm>London</TwnNm><Ctry>GB</Ctry><AdrLine>10 High Street</AdrLine>':'<AdrLine>10 High Street, London, GB</AdrLine>'}</PstlAdr></Dbtr>
<Cdtr><Nm>DEMO EXPORTERS</Nm><PstlAdr><TwnNm>Berlin</TwnNm><Ctry>DE</Ctry><AdrLine>12 Friedrichstrasse</AdrLine></PstlAdr></Cdtr>
</CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`;
const mt=`{1:F01AAAAGB2LAXXX0000000000}{2:I103BBBBDEFFXXXXN}{4:
:20:DEMO-TEST-01
:23B:CRED
:32A:261012EUR1000,00
:50K:/GB00000001
SAMPLE TRADING
10 High Street, London, GB
:59:/DE00000001
DEMO EXPORTERS
12 Friedrichstrasse, Berlin, DE
:71A:SHA
-}`;
const samples={unstructured:mx(false),structured:mx(true),mt103:mt};
let result=null;
const countries=new Set(['GB','DE','FR','NL','US','IN','IT','ES','BE','CH','IE','SG']);
const local=n=>n.localName||n.nodeName.split(':').pop();
const child=(n,s)=>Array.from(n?.children||[]).find(x=>local(x)===s);
const value=(n,s)=>child(n,s)?.textContent.trim()||'';
function suggest(lines){
 for(const line of lines){
 const parts=line.split(',').map(x=>x.trim()), last=parts.at(-1)?.toUpperCase();
 if(parts.length>=3 && countries.has(last) && /^[\p{L}\w .'-]{2,80}$/u.test(parts.at(-2)))
 return {town:parts.at(-2),country:last,addressLine:parts.slice(0,-2).join(', '),basis:'Explicit comma-separated town and ISO country',action:'REVIEW_ONLY',autoApplied:false};
 }
 return null;
}
function party(label,lines,town,country) {
 const findings=[];
 if(!town)findings.push({code:'TOWN_MISSING',message:'Town name is not a structured field.'});
 if(!country)findings.push({code:'COUNTRY_MISSING',message:'Country is not a structured field.'});
 if(country&&!countries.has(country))findings.push({code:'COUNTRY_REVIEW',message:'Country code needs independent verification.'});
 const s=(!town||!country)?suggest(lines):null;
 return {party:label,address:{town,country,lines},findings,suggestion:s?{...s,town:town||s.town,country:country||s.country}:null,status:findings.length?'needs_review':'structured_fields_present'};
}
function analyze(body){
 if(!body.trim()||body.length>80000)throw Error('Provide 1–80,000 characters of synthetic message content.');
 let parties=[],type;
 if(body.trimStart().startsWith('<')){
 type='pacs.008';
 const doc=new DOMParser().parseFromString(body,'text/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('Invalid XML document.');
 const nodes=Array.from(doc.getElementsByTagName('*'));
 if(!nodes.some(x=>local(x)==='FIToFICstmrCdtTrf'))throw Error('Only pacs.008 XML is supported in this demo.');
 const labels={Dbtr:'Debtor',Cdtr:'Creditor',UltmtDbtr:'Ultimate debtor',UltmtCdtr:'Ultimate creditor',DbtrAgt:'Debtor agent',CdtrAgt:'Creditor agent'};
 for(const n of nodes){
 if(!labels[local(n)])continue;
 const addr=child(n,'PstlAdr')||child(child(n,'FinInstnId'),'PstlAdr');
 if(!addr)continue;
 const lines=Array.from(addr.children).filter(x=>local(x)==='AdrLine').map(x=>x.textContent.trim()).filter(Boolean);
 parties.push(party(labels[local(n)],lines,value(addr,'TwnNm'),value(addr,'Ctry')));
 }
 }else{
 type='MT103';
 if(!body.includes(':20:')&&!body.includes(':50'))throw Error('Not a recognised MT103 example.');
 const re=/^:(50[AFK]|59[AF]?):([\s\S]*?)(?=^:[0-9]{2}[A-Z]?:|$(?![\s\S]))/gm;
 let m;while((m=re.exec(body))){
 let rows=m[2].split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(rows[0]?.startsWith('/'))rows=rows.slice(1);
 parties.push(party(m[1].startsWith('50')?'Ordering customer':'Beneficiary customer',rows.slice(1),'',''));
 }
 }
 const review=parties.filter(x=>x.findings.length).length;
 return {product:'AddressRail AI',messageType:type,ruleset:'addressrail-demo-0.1',status:review||!parties.length?'REVIEW_REQUIRED':'PRELIMINARY_CHECK_PASSED',summary:{partiesInspected:parties.length,partiesNeedingReview:review,repairCandidates:parties.filter(x=>x.suggestion).length},parties,warnings:parties.length?[]:['No postal address elements were found.'],disclaimer:'Educational quality check only. Not a payment, regulatory or CBPR+ conformance certificate.'};
}
function add(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e}
function render(r){
 result=r;
 renderComparison();
 $('parties').textContent=r.summary.partiesInspected;
 $('reviews').textContent=r.summary.partiesNeedingReview;
 $('candidates').textContent=r.summary.repairCandidates;
 $('export').disabled=false;
 $('state').className='summary'+(r.summary.partiesNeedingReview?' alert':'');
 $('state').textContent=r.summary.partiesNeedingReview?'Review required: '+r.summary.partiesNeedingReview+' address record(s).':'Structured fields present — this is not full payment-message validation.';
 $('findings').replaceChildren();
 for(const p of r.parties){
 const block=add('article','','finding');
 block.append(add('b',p.party));
 for(const issue of p.findings)block.append(add('p','• '+issue.message));
 if(!p.findings.length)block.append(add('p','Structured town and country present.'));
 if(p.suggestion)block.append(add('div','REVIEW-ONLY CANDIDATE\nTown: '+p.suggestion.town+'\nCountry: '+p.suggestion.country+'\nAddress line: '+p.suggestion.addressLine,'repair'));
 $('findings').append(block);
 }
 if(!r.parties.length)$('findings').append(add('p','No postal addresses found. This does not establish compliance.'));
}
function load(){
 $('message').value=samples[$('sample').value];
 $('count').textContent=$('message').value.length+' characters';
}
$('sample').onchange=load;
$('message').oninput=()=>{$('count').textContent=$('message').value.length+' characters'};
$('run').onclick=()=>{
 try{render(analyze($('message').value));$('error').hidden=true;$('report').scrollIntoView({behavior:'smooth'})}
 catch(e){$('error').textContent=e.message;$('error').hidden=false}
};
$('file').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 if(f.size>80000){$('error').textContent='File exceeds 80 KB';$('error').hidden=false;return}
 $('message').value=await f.text();$('count').textContent=$('message').value.length+' characters';
};
$('export').onclick=()=>{
 if(!result)return;
 const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='addressrail-report.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
// Gemini is opt-in. No API key is ever used in the browser.
const geminiBackend=String(window.ADDRESSRAIL_API_URL||'').trim().replace(/\/$/,'');
const aiOutput=$('ai-output');
function message(value){aiOutput.replaceChildren(document.createTextNode(value))}
function fieldLine(label, value){
 const line=add('div','','address-field');
 line.append(add('strong',label+': '));
 line.append(document.createTextNode(value||'Not provided'));
 return line;
}
function renderComparison(){
 aiOutput.replaceChildren();
 const parties=result?.parties||[];
 if(!parties.length){aiOutput.append(add('p','No postal addresses were found for comparison.'));return}
 let proposed=0;
 for(const p of parties){
  const section=add('section','','compare-section');
  section.append(add('h3',p.party+' address'));
  const grid=add('div','','compare-grid');
  const before=add('div','','compare-card');
  before.append(add('h4','Before · Current address'));
  before.append(fieldLine('Address lines',p.address.lines.join(' | ')||'Not provided'));
  before.append(fieldLine('Town',p.address.town));
  before.append(fieldLine('Country',p.address.country));
  grid.append(before);
  const after=add('div','','compare-card proposed');
  const suggestion=p.suggestion;
  after.append(add('h4',suggestion?'After · Suggested correction':'After · No proposed change'));
  if(suggestion){
   proposed++;
   after.append(fieldLine('Address lines',suggestion.addressLine));
   after.append(fieldLine('Town',suggestion.town));
   after.append(fieldLine('Country',suggestion.country));
   after.append(add('p','Extracted from the original address text — review before using.','compare-note'));
  }else{
   after.append(fieldLine('Address lines',p.address.lines.join(' | ')||'Not provided'));
   after.append(fieldLine('Town',p.address.town));
   after.append(fieldLine('Country',p.address.country));
   after.append(add('p',p.findings.length?'Unable to propose a reliable correction. Manual review is needed.':'No missing town or country fields detected.','compare-note'));
  }
  grid.append(after);
  section.append(grid);
  aiOutput.append(section);
 }
 aiOutput.append(add('p',proposed?'Suggested changes are not applied to the payment message.':'No automatic changes have been made.','ai-caution'));
}
function renderAdvice(advice){
 if(!advice||typeof advice!=='object'){message('Gemini returned an unexpected response. Please retry.');return}
 renderComparison();
 const explanation=add('section','','ai-explanation');
 explanation.append(add('h3','Gemini explanation'));
 explanation.append(add('p',String(advice.summary||'No explanation provided.')));
 if(Array.isArray(advice.cautions)&&advice.cautions.length){
  explanation.append(add('h4','What to check'));
  const list=add('ul');
  for(const caution of advice.cautions.filter(x=>typeof x==='string'&&x.trim()).slice(0,4))list.append(add('li',caution));
  explanation.append(list);
 }
 aiOutput.append(explanation);
}
let challengeToken='';
let challengeWidget=null;
let challengeHost='';
let loadChallengeScript=null;

function turnstileLoader(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!loadChallengeScript){
   loadChallengeScript=new Promise((resolve,reject)=>{
     const script=document.createElement('script');
     script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
     script.async=true;
     script.onload=()=>window.turnstile?resolve(window.turnstile):reject(Error('Turnstile unavailable'));
     script.onerror=()=>reject(Error('Turnstile script failed'));
     document.head.append(script);
   });
 }
 return loadChallengeScript;
}

function resetChallenge(){
 challengeToken='';
 if(window.turnstile&&challengeWidget!==null){
   window.turnstile.remove(challengeWidget);
   challengeWidget=null;
 }
 $('turnstile-challenge').replaceChildren();
}

async function configureGemini(){
 resetChallenge();
 challengeHost='';
 const base=geminiBackend;
 if(!/^https:\/\//.test(base)){
   $('ai-availability').textContent='The Gemini backend is not yet hosted. Local address validation is available.';
   return;
 }
 $('ai-availability').textContent='Checking Gemini backend…';
 try{
   const resp=await fetch(base+'/api/config',{cache:'no-store'});
   if(!resp.ok)throw Error('Backend is unavailable ('+resp.status+')');
   const config=await resp.json();
   if(!config.aiEnabled||!config.turnstileSiteKey){
     $('ai-availability').textContent='Gemini is disabled on this backend. Its API key and anti-bot settings must be configured.';
     return;
   }
   const turnstile=await turnstileLoader();
   challengeHost=base;
   challengeWidget=turnstile.render('#turnstile-challenge',{
     sitekey:config.turnstileSiteKey,
     action:'addressrail_ai',
     callback:token=>{challengeToken=token;},
     'expired-callback':()=>{challengeToken='';},
     'error-callback':()=>{challengeToken='';}
   });
   $('ai-availability').textContent='Gemini is ready. Complete the security check, then select Ask Gemini.';
 }catch{
   $('ai-availability').textContent='Gemini backend is unreachable. The local address analyzer still works.';
 }
}


$('ask').onclick=async()=>{
 if(!result){message('Run address checks first.');return}
 if(!$('consent').checked){message('Please confirm you are using synthetic or fully anonymised test data.');return}
 const host=geminiBackend;
 if(!/^https:\/\//.test(host)){
   message('Gemini is not connected. Address checks still work.');
   return;
 }
 if(challengeHost!==host){
   await configureGemini();
   message('Complete the security check before asking Gemini.');
   return;
 }
 if(!challengeToken){
   message('Complete the security check before asking Gemini.');
   return;
 }
 $('ask').disabled=true;
 renderComparison();
 $('ask').textContent='Asking Gemini…';
 try{
   const resp=await fetch(host+'/api/ai-explain',{
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({analysis:result,confirm_synthetic:true,turnstile_token:challengeToken})
   });
   const data=await resp.json();
   if(resp.ok)renderAdvice(data.advice);else message(typeof data.detail==='string'?data.detail:'AI explanation unavailable.');
 }catch{
   message('Gemini is temporarily unavailable. Address checks still work.');
 }finally{
   $('ask').disabled=false;
   $('ask').textContent='Ask Gemini ↗';
   challengeToken='';
   if(window.turnstile&&challengeWidget!==null)window.turnstile.reset(challengeWidget);
 }
};
load();
if(geminiBackend)configureGemini();
})();
