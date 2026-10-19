import React,{useEffect,useRef,useState} from 'react';
import type {DemoResponse} from '../../web/studio/shared/contracts';
const BACKEND='https://addressrail-ai.onrender.com';
const SUPPORTED=['cbpr','sct','sct-inst','sdd-core','sdd-b2b'];
type Turnstile={render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;reset:(id:string)=>void};
declare global {interface Window {turnstile?:Turnstile}}
let script:Promise<Turnstile>|undefined;
function challenge(){
 if(window.turnstile)return Promise.resolve(window.turnstile);
 if(!script)script=new Promise<Turnstile>((resolve,reject)=>{
  const tag=document.createElement('script');tag.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';tag.async=true;
  tag.onload=()=>window.turnstile?resolve(window.turnstile):reject(Error('Security check unavailable'));
  tag.onerror=()=>reject(Error('Security check unavailable'));document.head.append(tag);
 }).catch(error=>{script=undefined;throw error});
 return script;
}
type Advice={mode:'gemini';model:string;advice:{summary:string;actions:string[];cautions:string[]}};
export function GeminiWorkbench({execution}:{execution:DemoResponse|null}){
 const [consent,setConsent]=useState(false),[enabled,setEnabled]=useState(false),[token,setToken]=useState(''),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Optional: send only the rail, executed stages and finding codes to Gemini.'),[result,setResult]=useState<Advice|null>(null);
 const element=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null),generation=useRef(0);
 const supported=!!execution&&SUPPORTED.includes(execution.productId);
 useEffect(()=>{
  generation.current++;setConsent(false);setEnabled(false);setToken('');setBusy(false);setResult(null);
  setMessage('Optional: send only the rail, executed stages and finding codes to Gemini.');
  return()=>{generation.current++};
 },[execution]);
 useEffect(()=>{
  if(!supported||!consent)return;
  let active=true;const controller=new AbortController();
  setMessage('Checking protected Gemini availability…');
  void(async()=>{
   try{
    const response=await fetch(BACKEND+'/api/config',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('Backend unavailable');const config=await response.json();
    if(!config.aiEnabled||!config.turnstileSiteKey)throw Error('Gemini is disabled or security protection is unavailable.');
    const api=await challenge();if(!active||!element.current)return;
    widget.current=api.render(element.current,{sitekey:config.turnstileSiteKey,action:'addressrail_ai',
     callback:(value:string)=>{if(active)setToken(value)},'expired-callback':()=>{if(active)setToken('')},'error-callback':()=>{if(active)setToken('')}});
    setEnabled(true);setMessage('Complete the security check, then select Ask Gemini.');
   }catch{if(active)setMessage('Gemini unavailable. Local deterministic results remain available; no live AI was used.');}
  })();
  return()=>{active=false;controller.abort();setToken('');setEnabled(false);if(widget.current!==null){window.turnstile?.remove(widget.current);widget.current=null}};
 },[supported,consent,execution]);
 async function ask(){
  if(!execution||!supported||!consent||!enabled||!token||busy)return;
  const version=generation.current;setBusy(true);setResult(null);setMessage('Asking Gemini…');
  try{
   const report=execution.report as {issues:{code:string}[]};
   const response=await fetch(BACKEND+'/api/ai-explain',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(35000),
    body:JSON.stringify({confirm_synthetic:true,turnstile_token:token,analysis:{product:'AddressRail Workbench',synthetic:true,rail:execution.productId,
     stages:execution.steps.map(s=>s.id),finding_codes:report.issues.map(i=>i.code)}})});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Gemini unavailable.');
   if(data.mode!=='gemini'||typeof data.model!=='string'||!data.model||typeof data.advice?.summary!=='string'||!data.advice.summary.trim()||
    !Array.isArray(data.advice.actions)||!data.advice.actions.every((v:unknown)=>typeof v==='string')||!Array.isArray(data.advice.cautions)||!data.advice.cautions.every((v:unknown)=>typeof v==='string'))throw Error('No valid Gemini provider response was returned.');
   if(generation.current===version){setResult(data);setMessage('Gemini response received. Human review required.');}
  }catch(error){if(generation.current===version)setMessage((error instanceof Error?error.message:'Gemini unavailable.')+' Local deterministic fallback retained; no Gemini explanation is available.');}
  finally{if(generation.current===version){setBusy(false);setToken('');if(widget.current!==null)window.turnstile?.reset(widget.current)}}
 }
 if(!supported)return <p>Run a synthetic CBPR+ or SEPA payment first to enable optional Gemini.</p>;
 return <div className="gemini-panel">
  <h3>Optional Gemini review</h3>
  <p>Only the rail, executed stages and finding codes are sent to the protected Render service. Payment messages, names, accounts and addresses are excluded.</p>
  <label><input type="checkbox" checked={consent} onChange={e=>{generation.current++;setBusy(false);setResult(null);setConsent(e.target.checked)}}/> I confirm this is synthetic test data and consent to sending this limited evidence to Gemini.</label>
  <div ref={element} aria-label="Human verification"/>
  <button className="primary" disabled={!consent||!enabled||!token||busy} onClick={()=>void ask()}>{busy?'Asking Gemini…':'Ask Gemini'}</button>
  <p aria-live="polite">{message}</p>
  <div data-testid="gemini-provenance"><strong>{result?'GEMINI · provider: Google · model: '+result.model:'DETERMINISTIC_FALLBACK · model: null · no Gemini response'}</strong>
   <p>Retrieval: [] — no knowledge retrieval was performed; no RAG citations are available.</p>
   {result&&<><p>{result.advice.summary}</p><h4>Suggested review actions</h4><ul>{result.advice.actions.map((s,i)=><li key={i}>{s}</li>)}</ul><h4>Cautions</h4><ul>{result.advice.cautions.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
  </div>
  <p>Human review required. Advisory only; this does not validate a scheme, authorise a payment, or apply any corrections. Deterministic execution evidence below remains separate.</p>
 </div>;
}
