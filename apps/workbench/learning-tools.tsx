import React,{useState} from 'react';
import {addFictionalEntry,FICTIONAL_WATCHLIST,screenSyntheticPayment,simulateChannel,CHANNELS} from '../../web/studio/shared/learning-tools.mjs';
const stringify=(value:unknown)=>JSON.stringify(value,null,2);
function syntheticPayload(input:string){const x=JSON.parse(input);if(x?.synthetic!==true||x?.educationalOnly!==true)throw Error('Only fictional educational payment JSON is accepted.');return x;}
export function ScreeningWorkbench({input}:{input:string}){
 const [records,setRecords]=useState<Array<{id:string;name:string;aliases:string[];category:string}>>(()=>[...FICTIONAL_WATCHLIST]);
 const [newName,setNewName]=useState('');
 const [result,setResult]=useState<unknown>(null);
 const [error,setError]=useState('');
 function screen(){try{setResult(screenSyntheticPayment(syntheticPayload(input),records));setError('')}catch(e){setError(e instanceof Error?e.message:'Screening unavailable');setResult(null)}}
 function add(){try{const entry=addFictionalEntry(newName,records);setRecords([...records,entry]);setNewName('');setResult(null);setError('')}catch(e){setError(e instanceof Error?e.message:'Cannot add fictional name')}}
 return <div className="panel">
  <h2>AML / Sanctions — fictional-name learning</h2>
  <p>Screen the current synthetic payer and beneficiary against a temporary browser-only list. This is not sanctions screening, real-world risk scoring, or a compliance decision. Do not enter real personal information.</p>
  <div className="toolbar"><label>Fictional entity name<input aria-label="Fictional watchlist name" value={newName} maxLength={120} onChange={e=>setNewName(e.target.value)} placeholder="DEMO EXAMPLE ENTITY"/></label><button onClick={add}>Add to temporary list</button><button onClick={()=>{setRecords([...FICTIONAL_WATCHLIST]);setResult(null);setError('')}}>Reset list</button></div>
  <h3>Temporary fictional records ({records.length})</h3>
  <ul className="learning-list">{records.map(record=><li key={record.id}><strong>{record.name}</strong><span>{record.category} · {record.id}</span></li>)}</ul>
  <div className="actions"><button className="primary" onClick={screen}>Screen current synthetic request</button></div>
  {error&&<p role="alert">{error}</p>}
  <h3>Deterministic screening result</h3><pre data-testid="aml-result">{result?stringify(result):'Run a synthetic payment screening example. No Gemini call is made.'}</pre>
 </div>
}
export function ChannelsWorkbench({input}:{input:string}){
 const [channel,setChannel]=useState('REST'),[attempt,setAttempt]=useState(1);
 const [result,setResult]=useState<unknown>(null),[error,setError]=useState('');
 const [previousKey,setPreviousKey]=useState('');
 function run(){
  try{
   const value=simulateChannel(syntheticPayload(input),{channel,attempt});
   const duplicate=previousKey===value.idempotencyKey;
   setResult({...value,duplicateInBrowserSession:duplicate,
    note:duplicate?'Same synthetic correlation key: repeat UI attempt, no real enqueue.':value.note});
   setPreviousKey(value.idempotencyKey);setError('');
  }catch(e){setError(e instanceof Error?e.message:'Transport demo unavailable');setResult(null)}
 }
 return <div className="panel">
  <h2>REST / MQ / Kafka / Native File / SFTP — learning flows</h2>
  <p>These are deterministic channel-shaped acknowledgements only. There is no broker, file transfer, delivery guarantee or real network execution. Your private adapters remain separate.</p>
  <div className="toolbar"><label>Channel<select aria-label="Simulated channel" value={channel} onChange={e=>{setChannel(e.target.value);setResult(null)}}>{CHANNELS.map(x=><option key={x}>{x}</option>)}</select></label>
  <label>Retry attempt<select aria-label="Retry attempt" value={attempt} onChange={e=>setAttempt(Number(e.target.value))}>{[1,2,3].map(v=><option key={v} value={v}>{v}</option>)}</select></label>
  <button className="primary" onClick={run}>Simulate channel flow</button></div>
  {error&&<p role="alert">{error}</p>}
  <h3>Simulated inbound / outbound evidence</h3><pre data-testid="channel-result">{result?stringify(result):'Choose a channel and run the fictional flow.'}</pre>
 </div>
}
