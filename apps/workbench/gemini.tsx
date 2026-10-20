import React,{useEffect,useRef,useState} from 'react';
import type {DemoResponse} from '../../web/studio/shared/contracts';
import {PRODUCTS} from '../../web/studio/shared/product-registry.mjs';
const BACKEND='https://addressrail-ai.onrender.com';
// Every registered product may request an optional educational explanation.
// Backend rejects any ID absent from the vetted public-safe knowledge catalogue.
const SUPPORTED=PRODUCTS.map(p=>p.id);
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
type Source={id:string;topic:string;url:string;summary:string;reviewed:string;score:number};
type Advice={mode:'gemini'|'deterministic_fallback';model:string|null;advice:{summary:string;actions:string[];cautions:string[]};
 retrieval?:Source[];citationIds?:string[];framework?:string;promptVersion?:string;knowledgeVersion?:string;traceId?:string;
 fallbackReason?:string|null;toolTrace?:unknown[];evaluation?:unknown;humanReviewRequired?:boolean};
function safeSource(source:Source){
 try{const url=new URL(source.url);return url.protocol==='https:'&&!url.username&&!url.password&&['github.com','www.iso20022.org','www.europeanpaymentscouncil.eu','www.swift.com'].includes(url.hostname)
  &&[source.id,source.topic,source.summary,source.reviewed].every(v=>typeof v==='string');}catch{return false}
}
export function GeminiWorkbench({execution,rawReport=null}:{execution:DemoResponse|null;rawReport?:{format:'MT'|'MX';issues:{code:string}[]}|null}){
 const [consent,setConsent]=useState(false),[enabled,setEnabled]=useState(false),[token,setToken]=useState(''),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState('Optional: send only the rail, executed stages and finding codes to Gemini.'),[result,setResult]=useState<Advice|null>(null);
 const [reviewed,setReviewed]=useState(false);
 const element=useRef<HTMLDivElement>(null),widget=useRef<string|null>(null),generation=useRef(0);
 const supported=!!rawReport||!!execution&&SUPPORTED.includes(execution.productId);
 useEffect(()=>{
  generation.current++;setConsent(false);setEnabled(false);setToken('');setBusy(false);setResult(null);setReviewed(false);
  setMessage('Optional: send only the rail, executed stages and finding codes to Gemini.');
  return()=>{generation.current++};
 },[execution,rawReport]);
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
 },[supported,consent,execution,rawReport]);
 async function ask(){
  if((!execution&&!rawReport)||!supported||!consent||!enabled||!token||busy)return;
  const version=generation.current;setBusy(true);setResult(null);setReviewed(false);setMessage('Retrieving trusted source summaries and requesting a Gemini explanation…');
  try{
   const analysis=rawReport?{product:'AddressRail Message Validator',synthetic:true,rail:rawReport.format.toLowerCase(),stages:['RECEIVED','CHECKED'],finding_codes:rawReport.issues.map(i=>i.code)}:
    {product:'AddressRail Workbench',synthetic:true,rail:execution!.productId,stages:execution!.steps.map(s=>s.id),finding_codes:((execution!.report) as {issues:{code:string}[]}).issues.map(i=>i.code)};
   const response=await fetch(BACKEND+'/api/ai-explain',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(35000),
    body:JSON.stringify({confirm_synthetic:true,turnstile_token:token,analysis})});
   const data=await response.json();
   if(!response.ok)throw Error(typeof data.detail==='string'?data.detail:'Gemini unavailable.');
   if(!['gemini','deterministic_fallback'].includes(data.mode)||(data.mode==='gemini'&&(typeof data.model!=='string'||!data.model))||typeof data.advice?.summary!=='string'||!data.advice.summary.trim()||
    !Array.isArray(data.advice.actions)||!data.advice.actions.every((v:unknown)=>typeof v==='string')||!Array.isArray(data.advice.cautions)||!data.advice.cautions.every((v:unknown)=>typeof v==='string'))throw Error('No valid Gemini provider response was returned.');
   if(data.retrieval!==undefined&&(!Array.isArray(data.retrieval)||!data.retrieval.every(safeSource)))throw Error('Invalid retrieved source metadata.');
   if(data.citationIds!==undefined&&(!Array.isArray(data.citationIds)||!data.citationIds.every((id:unknown)=>typeof id==='string'&&data.retrieval?.some((s:Source)=>s.id===id))))throw Error('Unsupported citation returned.');
   if(generation.current===version){setResult(data);setMessage(data.mode==='gemini'?'Gemini response received. Human review required.':'Local deterministic fallback retained; Gemini output was unavailable or rejected by evidence checks.');}
  }catch(error){if(generation.current===version)setMessage((error instanceof Error&&error.name==='TimeoutError'?'Gemini request timed out. Check whether the backend is online or the provider is responding.':error instanceof Error?error.message:'Gemini unavailable.')+' Local deterministic findings remain available; this was not a successful Gemini response.');}
  finally{if(generation.current===version){setBusy(false);setToken('');if(widget.current!==null)window.turnstile?.reset(widget.current)}}
 }
 if(!supported)return <p>Run a synthetic payment in this registered context first to enable optional Gemini.</p>;
 return <div className="gemini-panel">
  <h3>Optional Gemini review</h3>
  <p>Send only the format/rail, executed review stages and finding codes. The protected service retrieves curated educational context and checks Gemini’s explanation against that evidence. Payment messages, names, accounts and addresses are excluded.</p>
  <label><input type="checkbox" checked={consent} onChange={e=>{generation.current++;setBusy(false);setResult(null);setReviewed(false);setConsent(e.target.checked)}}/> I confirm this is synthetic test data and consent to sending this limited evidence to Gemini.</label>
  <div ref={element} aria-label="Human verification"/>
  <button className="primary" disabled={!consent||!enabled||!token||busy} onClick={()=>void ask()}>{busy?'Request in progress…':'Ask Gemini'}</button>
  <p aria-live="polite">{message}</p>
  <div data-testid="gemini-provenance"><strong>{result?.mode==='gemini'?'GEMINI · provider: Google · model: '+result.model:'DETERMINISTIC_FALLBACK · model: null · no Gemini response'}</strong>
   {!result?.retrieval?.length?<p>Retrieval: [] — no retrieved sources are available; no RAG citations are shown.</p>:<>
    <h4>Retrieved educational context</h4><p>These are curated summaries, not full rulebooks or proof about this payment. Relevance ranking is not confidence in correctness.</p>
    <ul data-testid="rag-sources">{result.retrieval.map(source=><li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.topic}</a> · {source.id} · reviewed {source.reviewed}
     {result.mode==='gemini'&&result.citationIds?.includes(source.id)?' · Cited by Gemini':' · Retrieved context only'}<p>{source.summary}</p></li>)}</ul>
   </>}
   {result&&<><p>{result.advice.summary}</p><h4>Suggested review actions</h4><ul>{result.advice.actions.map((s,i)=><li key={i}>{s}</li>)}</ul><h4>Cautions</h4><ul>{result.advice.cautions.map((s,i)=><li key={i}>{s}</li>)}</ul></>}
  </div>
  {result&&<><details><summary>How this explanation was produced</summary><p>{result.framework??'Direct provider'} · {result.promptVersion??'legacy prompt'} · {result.knowledgeVersion??'no knowledge version'}</p>
   <p>Tools are selected by a fixed read-only workflow. Gemini cannot choose arbitrary tools, change a payment, or fetch a website.</p>
   <pre>{JSON.stringify({traceId:result.traceId,tools:result.toolTrace,evaluation:result.evaluation,fallbackReason:result.fallbackReason},null,2)}</pre>
   <p>Automated checks cannot guarantee factual accuracy. No protected-group or real bank accuracy evaluation is claimed.</p></details>
   <button onClick={()=>setReviewed(true)} disabled={reviewed}>{reviewed?'Explanation reviewed in this view':'Mark explanation reviewed'}</button>
   <p>{reviewed?'Review acknowledgement is local to this view; it is not payment approval.':'Awaiting human review. Verify sources and original evidence before relying on this explanation.'}</p>
  </>}
  <p>Human review required. Advisory only; this does not validate a scheme, authorise a payment, or apply any corrections. Deterministic execution evidence below remains separate.</p>
 </div>;
}
