/* Optional free Cloudflare Worker/D1 analytics. No cookies, IP collection or private message content. */
(()=>{'use strict';
const worker=(window.ADDRESSRAIL_STATS_URL||'').trim().replace(/\/$/,'');
if(!/^https:\/\//.test(worker))return;
const classify=()=>{
  const query=new URLSearchParams(window.location.search);
  const utm=(query.get('utm_source')||'').toLowerCase();
  let host='';
  try{host=new URL(document.referrer).hostname.toLowerCase()}catch{}
  const value=utm||host;
  if(!value)return 'Direct / Unknown';
  if(/(^|\.)bing\.com$/.test(value)||value==='bing')return 'Bing';
  if(/(^|\.)github\.com$/.test(value)||value==='github')return 'GitHub';
  if(/(^|\.)(chatgpt\.com|chat\.openai\.com)$/.test(value)||value==='chatgpt'||value==='openai')return 'ChatGPT';
  if(/(^|\.)perplexity\.ai$/.test(value)||value==='perplexity')return 'Perplexity';
  if(/(^|\.)gemini\.google\.com$/.test(value)||value==='gemini')return 'Gemini';
  if(/(^|\.)google\./.test(value)||value==='google')return 'Google';
  if(/(^|\.)claude\.ai$/.test(value)||value==='claude')return 'Claude';
  if(/(^|\.)(copilot\.microsoft\.com|copilot\.com)$/.test(value)||value==='copilot')return 'Copilot';
  if(/(^|\.)(duckduckgo\.com|yahoo\.com|baidu\.com|yandex\.)/.test(value))return 'Other search';
  if(/(^|\.)(poe\.com|you\.com|phind\.com)$/.test(value))return 'Other AI';
  if(host&&host===location.hostname)return 'Direct / Unknown';
  return 'Other websites';
};
async function show(){
 const total=document.getElementById('visitor-total');
 const detail=document.getElementById('visitor-source-breakdown');
 try{
  const r=await fetch(worker+'/api/stats',{mode:'cors',cache:'no-store'});
  if(!r.ok)throw Error('Stats unavailable');
  const s=await r.json();
  if(!Number.isFinite(s.totalVisits))throw Error('Invalid visitor stats');
  if(total)total.textContent=Number(s.totalVisits).toLocaleString('en-GB');
  if(detail)detail.textContent='Last 30 days: '+Number(s.last30Days||0).toLocaleString('en-GB')+
     ' · Sources: '+Object.entries(s.bySource||{}).sort((a,b)=>b[1]-a[1])
          .map(([name,count])=>name+' '+count).join(' · ');
 }catch{
  if(total)total.textContent='Unavailable';
  if(detail)detail.textContent='Free visitor statistics temporarily unavailable.';
 }
}
async function registerVisit(){
 try{
  // Once per tab session across pages. New tabs and browser refresh behavior vary.
  if(sessionStorage.getItem('addressrail_visit_counted'))return;
  const response=await fetch(worker+'/api/visit',{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({source:classify()})});
  if(response.ok)sessionStorage.setItem('addressrail_visit_counted','1');
 }catch{}
}
registerVisit().then(show);
})();

