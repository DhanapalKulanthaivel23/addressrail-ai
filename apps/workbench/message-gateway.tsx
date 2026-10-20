import React,{useMemo,useState} from 'react';
import {FileCode2,FileText,ArrowLeft,Play,CheckCircle2} from 'lucide-react';
import {GeminiWorkbench} from './gemini';
import {reviewRawMessage,MT_EXAMPLE,MX_EXAMPLE} from './raw-review.mjs';
import {summarizeMessage} from './message-summary.mjs';

type Format='MT'|'MX';
type Issue={code:string;path:string;detail:string};
type Report={format:Format;identifier:string;issues:Issue[];proposal:{description:string;corrected:string}|null;validated:boolean;scope:string;schemaValidated:boolean;schemeValidated:boolean};

/** Clear, actionable copy: never present a successful subset check as ISO/FIN certification. */
function issueTitle(issue:Issue):string{
 if(issue.code==='DEMO_BIC_FORMAT')return 'Invalid bank identifier (BIC)';
 if(issue.code==='DEMO_REQUIRED_FIELD')return 'Required field is missing or incorrect';
 if(issue.code==='DEMO_UNSUPPORTED_MESSAGE')return 'Message rules not available';
 if(issue.code==='DEMO_MT_ENVELOPE')return 'FIN message structure error';
 if(issue.code==='DEMO_AMOUNT')return 'Invalid amount format';
 if(issue.code==='DEMO_MISSING_REFERENCE')return 'Missing required information';
 if(issue.detail.startsWith('Required FX V05 section'))return 'Missing FX trade section';
 if(issue.detail.startsWith('Unexpected FX V05'))return 'Unexpected FX trade section';
 if(issue.detail.includes('DOCTYPE')||issue.detail.includes('ENTITY'))return 'Unsafe XML declaration';
 if(issue.detail.includes('not well formed'))return 'Malformed XML';
 if(issue.detail.includes('namespace'))return 'Incorrect message namespace';
 return 'Message structure error';
}
function fixAdvice(issue:Issue,proposal:Report['proposal']):string{
 if(issue.code==='DEMO_REQUIRED_FIELD')return 'Add or correct the field using the original transaction evidence; never generate payment details.';
 if(issue.code==='DEMO_UNSUPPORTED_MESSAGE')return 'Select the exact version and authorised schema or rules before treating this message as valid.';
 if(issue.code==='DEMO_BIC_FORMAT')return proposal?'Convert the existing BIC to uppercase and recheck.':'Verify the BIC against the source; it should contain 8 or 11 valid characters.';
 if(issue.detail.startsWith('Required FX V05 section'))return 'Supply this section from the original trade instructions using the exact FX message definition.';
 if(issue.detail.startsWith('Unexpected FX V05'))return 'Reorganise the trade message according to the exact FX schema; retain the original trade data.';
 if(issue.code==='DEMO_MT_ENVELOPE')return proposal?'Append the missing FIN message terminator.':'Check the FIN headers, tagged fields and text-block terminator.';
 if(issue.code==='DEMO_AMOUNT')return 'Check the date, three-letter currency and comma-decimal amount against the source.';
 if(issue.code==='DEMO_MISSING_REFERENCE')return 'Fill the missing field using the original transaction record.';
 if(issue.detail.includes('DOCTYPE')||issue.detail.includes('ENTITY'))return 'Remove the unsupported declaration and review the XML securely.';
 if(issue.detail.includes('not well formed'))return 'Fix broken or mismatched XML tags and escaping.';
 return 'Check this location against the exact message definition and correct the original values.';
}
export function MessageGateway({openSandbox,embedded=false}:{openSandbox:()=>void;embedded?:boolean}){
 const [format,setFormat]=useState<Format|null>(null);
 const [message,setMessage]=useState('');
 const [report,setReport]=useState<Report|null>(null);
 const [approved,setApproved]=useState(false);
 const rawReport=useMemo(()=>report&&report.issues.length?{format:report.format,issues:report.issues}:null,[report]);
 function choose(next:Format){setFormat(next);setMessage('');setReport(null);setApproved(false);}
 function edit(value:string){setMessage(value);setReport(null);setApproved(false);}
 function run(text=message){if(!format)return;setReport(reviewRawMessage(format,text) as Report);setApproved(false);}
 function fix(){if(!format||!report?.proposal)return;const corrected=report.proposal.corrected;setMessage(corrected);setReport(reviewRawMessage(format,corrected) as Report);setApproved(true);}
 const body=<>
   <p className="eyebrow">PAYMENT MESSAGE REVIEW</p>
   <h1>MT / MX Validator</h1>
   <div className="gateway-choices" role="group" aria-label="Choose message type">
    <button className={'gateway-choice '+(format==='MT'?'chosen':'')} onClick={()=>choose('MT')} aria-pressed={format==='MT'}>
     <FileText size={29}/><strong>SWIFT MT messages</strong><span>Validate messages and review corrections</span><em>MT103 · MT202 · other MT identifiers</em>
    </button>
    <button className={'gateway-choice '+(format==='MX'?'chosen':'')} onClick={()=>choose('MX')} aria-pressed={format==='MX'}>
     <FileCode2 size={29}/><strong>ISO 20022 MX messages</strong><span>Find errors and suggested fixes</span><em>pain.* · pacs.* · camt.* · fxtr.*</em>
    </button>
   </div>
   {format&&<div className="gateway-review">
    <div className="gateway-review-title"><button onClick={()=>{setFormat(null);setReport(null);setMessage('')}}><ArrowLeft size={16}/> Choose format</button><h2>{format} message review</h2></div>
    <div className="gateway-editor">
     <label className="panel" htmlFor="raw-message-input">{format} message
      <textarea id="raw-message-input" aria-label={format+' message input'} value={message} onChange={e=>edit(e.target.value)} placeholder="Paste a test message here" spellCheck={false} maxLength={65536}/>
     </label>
     <div className="panel gateway-results" aria-live="polite">
      <h3>Errors &amp; suggested fixes</h3>
      {!report?<p>Run checks to review the message.</p>:<>
       <p data-testid="raw-validation-status"><strong>{report.identifier==='UNKNOWN'?'Message type not identified':report.identifier}</strong> · {report.issues.length?report.issues.length+' error'+(report.issues.length===1?'':'s'):'Checks passed'}</p>
       {report.issues.length?<ul className="review-issues" data-testid="raw-issues">{report.issues.map((issue,i)=><li key={i} className="review-issue">
         <strong>{issueTitle(issue)}</strong>
         <div><b>Where:</b> <code>{issue.path}</code></div>
         <div><b>Why:</b> {issue.detail}</div>
         <div><b>Suggested fix:</b> {fixAdvice(issue,report.proposal)}</div>
       </li>)}</ul>:<div className="review-success" role="status"><CheckCircle2 size={18}/> Success — checks passed</div>}}
       {!report.issues.length&&<dl className="message-summary" data-testid="message-summary">
        {summarizeMessage(format,message,report.identifier).map(field=><div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
       </dl>}
       {report.proposal&&<div className="review-proposal"><details><summary>Preview correction</summary><p>{report.proposal.description}</p><pre data-testid="correction-preview">{report.proposal.corrected}</pre></details><button className="primary" onClick={fix}>Apply fix &amp; recheck</button></div>}
       {approved&&<p role="status">Correction applied and checked again.</p>}
      </>}
     </div>
    </div>
    <div className="actions gateway-actions">
     <button onClick={()=>edit(format==='MT'?MT_EXAMPLE:MX_EXAMPLE)}>Load {format} example</button>
     <button onClick={()=>edit(format==='MT'?MT_EXAMPLE.replace(/^:71A:.*$/m,'').replace(/^:23B:.*$/m,''):MX_EXAMPLE.replace('<PmtId>','<BadPaymentId>').replace('</PmtId>','</BadPaymentId>'))}>Try example with errors</button>
     <button className="primary" onClick={()=>run()} disabled={!message.trim()}><Play size={16}/> Check {format} message</button>
    </div>
    {rawReport&&<section className="panel" aria-label="AI error explanation"><h2>AI explanation &amp; recommendations</h2>
      <GeminiWorkbench execution={null} rawReport={rawReport}/>
     </section>}
   </div>}
 </>;
 if(embedded)return <section className="message-gateway embedded" aria-label="MT / MX message validator"><div className="gateway-main">{body}</div></section>;
 return <div className="message-gateway"><header className="gateway-header"><a href="../">AddressRail AI</a><button onClick={openSandbox}>Payment testing</button></header><main className="gateway-main">{body}</main></div>;
}
