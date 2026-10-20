import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow,Background,Controls,MarkerType,type Node,type Edge} from '@xyflow/react';
import {Landmark,Globe2,Euro,PoundSterling,Layers,ChevronRight,Play,Download,ShieldCheck,Trash2,ArrowRightLeft,Activity} from 'lucide-react';
import '@xyflow/react/dist/style.css';
import './style.css';
import {PRODUCT_GROUPS,getProduct} from '../../web/studio/shared/product-registry.mjs';
import {executeDemo} from '../../web/studio/shared/demo-engine.mjs';
import {generateFixture,applyEvidenceRepair} from '../../web/studio/payment-intelligence/engine.mjs';
import type {DemoResponse,ExecutionStep} from '../../web/studio/shared/contracts';
import {GeminiWorkbench} from './gemini';
import {MessageGateway} from './message-gateway';
import {sessionData} from './storage';
import {ScreeningWorkbench,ChannelsWorkbench} from './learning-tools';
const PLATFORM_TABS=['AddressTune / Correction','AML / Compliance','MQ & File transport'];
const EPOCH='2026-10-18T00:00:00.000Z';
const pretty=(v:unknown)=>JSON.stringify(v,null,2);
const icons={swift:Globe2,sepa:Euro,uk:PoundSterling,other:Layers};
function download(value:string,name:string){const url=URL.createObjectURL(new Blob([value],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function App(){
 const [entry,setEntry]=useState<'gateway'|'sandbox'>('gateway');
 const [productId,setProduct]=useState('cbpr'),[scenario,setScenario]=useState('baseline');
 const [input,setInput]=useState(()=>pretty(generateFixture('cbpr'))),[execution,setExecution]=useState<DemoResponse|null>(null);
 const [tab,setTab]=useState('Payment testing'),[selected,setSelected]=useState<ExecutionStep|null>(null);
 const [notice,setNotice]=useState('Ready. Synthetic records only.'),[storage,setStorage]=useState('Local session not saved');
 const [output,setOutput]=useState(''),[ready,setReady]=useState(false);
 const product=getProduct(productId);
 useEffect(()=>{let active=true;sessionData('read').then(value=>{
  if(!active)return;
  if(value&&typeof value==='object'){
   const saved=value as {productId:string;scenario:string;input:string};
   getProduct(saved.productId);
   if(saved.input.length>65536)throw Error('Oversized saved session');
   const payload=JSON.parse(saved.input);
   executeDemo({contractVersion:1,synthetic:true,productId:saved.productId,scenarioId:saved.scenario,syntheticEpoch:EPOCH,payload});
   setProduct(saved.productId);setScenario(saved.scenario);setInput(saved.input);setStorage('Recovered synthetic draft from IndexedDB');
  }
 }).catch(()=>{if(active)setStorage('Storage unavailable or invalid; in-memory testing available')}).finally(()=>{if(active)setReady(true)});return()=>{active=false}},[]);
 function reset(id=productId,sc='baseline'){
  setProduct(id);setScenario(sc);setTab('Payment testing');setInput(pretty(generateFixture(id,sc)));setExecution(null);setSelected(null);setOutput('');setNotice('Synthetic fixture loaded. Run checks to inspect execution.');
 }
 function edit(value:string){setInput(value);setExecution(null);setSelected(null);setOutput('');setNotice('Draft changed. Run checks again.')}
 async function run(candidate=input,correctionApproved=false){
  try{
   const result=executeDemo({contractVersion:1,synthetic:true,productId,scenarioId:scenario,syntheticEpoch:EPOCH,payload:JSON.parse(candidate)});
   if(correctionApproved)result.ai.revalidation={status:'REVALIDATED_INTERNAL_RULES',findings:(result.report as {issues:unknown[]}).issues};
   setExecution(result);setSelected(result.steps.at(-1)??null);setOutput(pretty(result.report));
   setNotice('Deterministic execution complete. Scheme validity and settlement are unverified.');
   try{await sessionData('save',{productId,scenario,input:candidate});setStorage('Synthetic draft saved locally in IndexedDB')}catch{setStorage('Storage unavailable; execution retained in memory')}
  }catch(error){setExecution(null);setSelected(null);setOutput('');setNotice(error instanceof Error?error.message:'Execution failed')}
 }
 function convert(direction:string){setOutput(pretty({outcome:'BLOCKED',direction,unmapped:['No verified mapping is configured for this public workbench.'],outputMessage:null}));setNotice('BLOCKED — no missing payment facts were inferred.')}
 function correct(){
  try{
   const report=execution?.report as {proposals?:unknown[]}|undefined;
   const proposal=report?.proposals?.[0];if(!proposal)throw Error('Run checks and review a supported correction first.');
   const corrected=pretty(applyEvidenceRepair(JSON.parse(input),proposal));setInput(corrected);void run(corrected,true);
  }catch(e){setNotice(e instanceof Error?e.message:'Correction failed')}
 }
 const nodes:Node[]=execution?.steps.map((step,i)=>({id:step.id,position:{x:40+i*310,y:70},data:{label:step.id+' · '+step.result},style:{width:240,borderColor:'#06b6d4'}}))??[];
 const edges:Edge[]=execution?.steps.slice(1).map((step,i)=>({id:'edge-'+i,source:execution.steps[i].id,target:step.id,label:step.messageType,markerEnd:{type:MarkerType.ArrowClosed},data:{step},animated:false}))??[];
 const report=execution?.report as {issues?:unknown[];proposals?:unknown[]}|undefined;
 if(entry==='gateway')return <MessageGateway openSandbox={()=>setEntry('sandbox')}/>;
 return <div className="shell">
  <aside><a className="brand" href="../"><Landmark size={28}/><span>AddressRail <b>AI</b><small>PAYMENT LEARNING PLATFORM</small></span></a>
   <div className="side-label">PRODUCTS</div>
   {PRODUCT_GROUPS.map(group=>{const Icon=icons[group.id as keyof typeof icons];return <details key={group.id} open={group.children.includes(productId)||undefined}><summary><Icon size={18}/>{group.name}<ChevronRight size={15}/></summary><div className="subproducts">{group.children.map(id=><button key={id} aria-current={id===productId?'page':undefined} onClick={()=>reset(id)}>{getProduct(id).name}</button>)}</div></details>})}
   <div className="tool-nav"><div className="side-label">PLATFORM TOOLS</div><button onClick={()=>setTab('AddressTune / Correction')}>AddressTune / Correction</button><button onClick={()=>setTab('AML / Compliance')}>AML / Sanctions / Compliance</button><button onClick={()=>setTab('MQ & File transport')}>REST / MQ / Kafka / Files / SFTP</button></div>
   <div className="side-links"><a href="../../">AddressTune · existing lab ↗</a><a href="../open-demo/">Investigation and guest cases ↗</a><a href="../payment-intelligence/">Cross-rail intelligence ↗</a><a href="../ai-lab/">AI learning lab ↗</a></div>
   <p className="side-note">Fictional payments. Optional protected Gemini explanations. No funds movement or account required.</p>
  </aside>
  <div className="workspace"><header><button onClick={()=>setEntry('gateway')}>MT / MX message validator</button><span><span className="dot"/> PUBLIC SYNTHETIC SANDBOX</span><a href="../">Banking Studio ↗</a></header>
   <main><div className="heading"><div><p className="eyebrow">PAYMENT WORKBENCH / {product.parentProduct.toUpperCase()}</p><h1>{product.name}</h1><p>Inspect a fictional payment, follow the execution, and review its evidence.</p></div><span className="badge">{product.implementation.status}</span></div>
    <div className="boundary"><ShieldCheck size={19}/><span>Internal educational checks only. Official schema and scheme validation are not configured. Enter synthetic data only.</span></div>
    <nav className="tabs" aria-label="Product views">{[...product.tabs,...PLATFORM_TABS].map(name=><button key={name} aria-pressed={tab===name} onClick={()=>setTab(name)}>{name}</button>)}</nav>
    <section hidden={tab!=='Payment testing'}>
     <div className="toolbar"><label>Scenario<select aria-label="Scenario" value={scenario} onChange={e=>reset(productId,e.target.value)}>{product.scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><button onClick={()=>reset(productId,'baseline')}>Load valid demo fixture</button><button onClick={()=>reset(productId,'invalid-bic')}>Load error fixture</button></div>
     <p className="hint">“Valid” means a baseline for this limited internal rule set. Fixture JSON is not a complete MT/MX banking message.</p>
     <div className="editors"><label className="panel">Input · synthetic JSON<textarea aria-label="Input message" value={input} onChange={e=>edit(e.target.value)} spellCheck={false}/></label><label className="panel">Output · execution response<textarea aria-label="Output message" value={output} readOnly spellCheck={false} placeholder="Run checks to inspect the response"/></label></div>
     <div className="actions"><button disabled={!execution} onClick={()=>setTab('AI explanation')}>Review / Ask Gemini</button><button className="primary" disabled={!ready} onClick={()=>void run()}><Play size={16}/>Validate / simulate checks</button><button onClick={()=>convert('MT_TO_MX')}><ArrowRightLeft size={16}/>MT → MX</button><button onClick={()=>convert('MX_TO_MT')}>MX → MT</button><button disabled={!report?.proposals?.length} onClick={correct}>Approve correction & revalidate</button><button onClick={()=>download(input,'synthetic-input.json')}><Download size={16}/>Message</button><button disabled={!execution} onClick={()=>download(pretty(execution),'synthetic-execution-report.json')}>Report</button></div>
    </section>
    <section hidden={tab!=='Validation'} className="panel"><h2>Deterministic findings</h2>{!execution?<p>Run checks on the payment testing tab.</p>:<><pre>{pretty(report?.issues)}</pre><h3>Review-only correction proposals</h3><pre>{pretty(report?.proposals)}</pre><p>Approval copies only evidence from the original synthetic address and runs the validator again. No official verified status is awarded.</p></>}</section>
    <section hidden={tab!=='Execution evidence'}><div className="panel"><h2><Activity size={20}/>Executed payment checks</h2><p>Nodes and arrows come from the last actual execution. Click either to inspect input/output and correlation.</p><div className="graph">{tab==='Execution evidence'&&<ReactFlow nodes={nodes} edges={edges} onNodeClick={(_,node)=>setSelected(execution?.steps.find(s=>s.id===node.id)??null)} onEdgeClick={(_,edge)=>setSelected(edge.data?.step as ExecutionStep)} fitView minZoom={0.4}><Background/><Controls/></ReactFlow>}</div></div><div className="panel"><h3>Selected execution evidence</h3><pre data-testid="step-detail">{selected?pretty(selected):'Run checks, then select a node or arrow.'}</pre></div></section>
    <section hidden={tab!=='AI explanation'} className="panel"><h2>How the last payment was processed</h2><GeminiWorkbench execution={execution}/>{execution?<><p>{execution.ai.explanation}</p><h3>Findings, model status, retrieval and correction evidence</h3><pre>{pretty({deterministicFindings:report?.issues,...execution.ai})}</pre><p>The execution record above describes local deterministic checks. Optional Gemini retrieval and citations are shown separately. Gemini availability does not affect local checks.</p></>:<p>Run a synthetic payment first.</p>}</section>
    <section hidden={tab!=='Capabilities'} className="panel"><h2>Declared product scope</h2><pre>{pretty(product)}</pre><p>REST API definitions and Postman entries are empty until an anonymous endpoint is implemented and tested. No private-engine execution or live broker is asserted.</p></section>
    <section hidden={tab!=='AddressTune / Correction'} className="panel"><h2>AddressTune — synthetic address review</h2>
     <p>Uses the existing evidence-constrained review engine. No address, bank identifier or payment details are invented. Proposals must be approved and rechecked.</p>
     {!execution?<p>Run a fictional payment in Payment testing to inspect address findings.</p>:<><h3>Current review proposals</h3><pre>{pretty(report?.proposals)}</pre><div className="actions"><button disabled={!report?.proposals?.length} onClick={correct}>Approve evidence-based correction & revalidate</button></div></>}
    </section>
    <section hidden={tab!=='AML / Compliance'}><ScreeningWorkbench input={input}/></section>
    <section hidden={tab!=='MQ & File transport'}><ChannelsWorkbench input={input}/></section>
    <p className="status" role="status">{notice}</p><footer><span>{storage}</span><button onClick={()=>{void sessionData('clear').then(()=>setStorage('Saved synthetic session cleared')).catch(()=>setStorage('Storage unavailable'))}}><Trash2 size={14}/>Clear saved session</button><span>No secrets or provider keys in the browser.</span></footer>
   </main>
  </div>
 </div>
}
createRoot(document.getElementById('root')!).render(<App/>);
