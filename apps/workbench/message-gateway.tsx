import React,{useMemo,useState} from 'react';
import {FileCode2,FileText,ArrowLeft,ShieldCheck,Play,CheckCircle2,AlertTriangle} from 'lucide-react';
import {GeminiWorkbench} from './gemini';
import {reviewRawMessage,MT_EXAMPLE,MX_EXAMPLE} from './raw-review.mjs';

type Format='MT'|'MX';
type Issue={code:string;path:string;detail:string};
type Report={format:Format;identifier:string;issues:Issue[];proposal:{description:string;corrected:string}|null;validated:boolean;scope:string;schemaValidated:boolean;schemeValidated:boolean};

export function MessageGateway({openSandbox}:{openSandbox:()=>void}){
 const [format,setFormat]=useState<Format|null>(null);
 const [message,setMessage]=useState('');
 const [report,setReport]=useState<Report|null>(null);
 const [approved,setApproved]=useState(false);
 const [note,setNote]=useState('Your input is checked locally in the browser; raw messages are not sent to Gemini.');
 const rawReport=useMemo(()=>report?{format:report.format,issues:report.issues}:null,[report]);
 function choose(next:Format){setFormat(next);setMessage('');setReport(null);setApproved(false);setNote('Paste synthetic '+next+' content or load the example.');}
 function edit(value:string){setMessage(value);setReport(null);setApproved(false);setNote('Message changed. Run checks again.');}
 function run(text=message){if(!format)return;const result=reviewRawMessage(format,text) as Report;setReport(result);setNote(result.issues.length?result.issues.length+' finding(s). Inspect before applying a proposed correction.':'No issues detected by the limited local checks. NOT XSD or scheme validated.');}
 function fix(){if(!format||!report?.proposal)return;const corrected=report.proposal.corrected;setMessage(corrected);setReport(reviewRawMessage(format,corrected) as Report);setApproved(true);setNote('Reviewed text-only correction applied and local checks re-run. Verify every business field independently.');}
 return <div className="message-gateway">
  <header className="gateway-header"><a href="../">AddressRail AI</a><span>MT / MX MESSAGE INTELLIGENCE</span><button onClick={openSandbox}>Open existing payment workbench</button></header>
  <main className="gateway-main">
   <p className="eyebrow">VALIDATE · INVESTIGATE · REVIEW CORRECTIONS</p>
   <h1>Payment message validator &amp; AI explanation</h1>
   <p className="gateway-intro">Choose a message format. Paste a synthetic SWIFT FIN MT or ISO 20022 MX message, inspect errors, review deterministic corrections, then optionally ask Gemini for a RAG-grounded explanation.</p>
   <div className="gateway-choices" role="group" aria-label="Choose message type">
    <button className={'gateway-choice '+(format==='MT'?'chosen':'')} onClick={()=>choose('MT')} aria-pressed={format==='MT'}>
     <FileText size={29}/><strong>SWIFT MT messages</strong><span>FIN blocks, tagged fields and safe format fixes</span><em>MT103 · MT202 · other three-digit MT identifiers</em>
    </button>
    <button className={'gateway-choice '+(format==='MX'?'chosen':'')} onClick={()=>choose('MX')} aria-pressed={format==='MX'}>
     <FileCode2 size={29}/><strong>ISO 20022 MX messages</strong><span>XML structure, message namespace and selected BIC checks</span><em>pain.* · pacs.* · camt.* · fxtr.* · other ISO families</em>
    </button>
   </div>
   <div className="boundary"><ShieldCheck size={20}/>Only synthetic data. Basic syntax checks are available; full SWIFT FIN rules, version-specific XSDs and payment-scheme validation are not yet connected to this screen. No payment is transmitted or corrected automatically.</div>
   {format&&<div className="gateway-review">
    <div className="gateway-review-title"><button onClick={()=>{setFormat(null);setReport(null);setMessage('')}}><ArrowLeft size={16}/> Choose format</button><h2>{format==='MT'?'MT error correction & AI review':'MX error correction & AI review'}</h2></div>
    <div className="gateway-editor">
     <label className="panel" htmlFor="raw-message-input">{format} message input
      <textarea id="raw-message-input" aria-label={format+' message input'} value={message} onChange={e=>edit(e.target.value)} placeholder={format==='MT'?'Paste complete FIN MT blocks...':'Paste ISO 20022 Document XML (pain, pacs, camt, fxtr...)...'} spellCheck={false} maxLength={65536}/>
     </label>
     <div className="panel gateway-results">
      <h3>Validation results</h3>
      {!report?<p>Run checks to see precise findings and any safe correction proposals.</p>:<>
       <p data-testid="raw-validation-status"><strong>{report.identifier}</strong> · {report.issues.length?'Review required':'No local syntax finding'}</p>
       <p className="hint">Evidence level: LOCAL_SYNTAX_SUBSET_ONLY. XSD: not assessed. Scheme validity: not assessed.</p>
       {report.issues.length?<ul data-testid="raw-issues">{report.issues.map((issue,i)=><li key={i}><strong>{issue.code}</strong> · {issue.path}<p>{issue.detail}</p></li>)}</ul>:<p><CheckCircle2 size={16}/> Limited checks found no issue. This is not a valid payment certification.</p>}
       {report.proposal?<><h3>Reviewable correction</h3><p>{report.proposal.description}</p><pre data-testid="correction-preview">{report.proposal.corrected}</pre><button className="primary" onClick={fix}>Apply reviewed correction & recheck</button></>:<p><AlertTriangle size={16}/> No safe automatic correction available. Missing trade/payment details, schema mismatches and unsupported fields require manual review.</p>}
       {approved&&<p role="status">Correction applied and rechecked locally.</p>}
      </>}
     </div>
    </div>
    <div className="actions gateway-actions">
     <button onClick={()=>edit(format==='MT'?MT_EXAMPLE:MX_EXAMPLE)}>Load {format} synthetic sample</button>
     <button className="primary" onClick={()=>run()} disabled={!message.trim()}><Play size={16}/> Run {format} checks</button>
    </div>
    <p role="status" className="status">{note}</p>
    {report&&<section className="panel" aria-label="RAG and Gemini explanation"><h2>Explain errors with RAG + Gemini</h2>
      <p>Gemini sees only the message family, executed review stages and allowlisted finding codes—not the original message text. Versioned educational sources are retrieved server-side where available. A model response never changes your message.</p>
      <GeminiWorkbench execution={null} rawReport={rawReport}/>
     </section>}
   </div>}
   <footer><span>Browser-only structural review · human-approved changes</span><span>No live SWIFT connection · no certified payment decision</span></footer>
  </main>
 </div>;
}
