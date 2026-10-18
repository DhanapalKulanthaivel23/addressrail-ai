/**
 * AR-062. Standalone, deterministic fictional watchlist and channel examples.
 * No actual sanctions determinations, financial messages, queues, files, or payments.
 */
/** @type {ReadonlyArray<{id:string,name:string,aliases:string[],category:string}>} */
export const FICTIONAL_WATCHLIST=Object.freeze([
 Object.freeze({id:'DEMO-ALERT-01',name:'SYNTHETIC RECEIVER LTD',aliases:['DEMO RECEIVER LIMITED'],category:'FICTIONAL_SANCTIONS_EXAMPLE'}),
 Object.freeze({id:'DEMO-REVIEW-02',name:'EXAMPLE TRADING COMPANY',aliases:['EXAMPLE TRADING CO'],category:'FICTIONAL_REVIEW_EXAMPLE'}),
 Object.freeze({id:'DEMO-CLEAR-03',name:'TRAINING MARITIME GROUP',aliases:[],category:'FICTIONAL_PEP_EXAMPLE'})
]);
export const CHANNELS=Object.freeze(['REST','MQ','KAFKA','FILE','SFTP']);
const MAX_MESSAGE_BYTES=18000;
export function normalizeName(value){
 if(typeof value!=='string'||value.length>120)throw Error('Fictional party name must be 1–120 characters');
 return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim().replace(/\s+/g,' ');
}
export function addFictionalEntry(name,existing=FICTIONAL_WATCHLIST){
 const norm=normalizeName(name);
 if(norm.length<4)throw Error('Enter a fictional name of at least four characters');
 if(!Array.isArray(existing)||existing.length>=25)throw Error('Temporary fictional watchlist is full');
 if(existing.some(e=>normalizeName(e.name)===norm))throw Error('Name already exists in the fictional watchlist');
 return Object.freeze({id:'TEMP-'+String(existing.length+1).padStart(3,'0'),name:name.trim(),aliases:[],category:'SESSION_FICTIONAL'});
}
function checkPayload(payload){
 if(!payload||payload.synthetic!==true||payload.educationalOnly!==true)throw Error('Explicitly synthetic educational payload required');
 if(new TextEncoder().encode(JSON.stringify(payload)).length>MAX_MESSAGE_BYTES)throw Error('Demo payload exceeds 18 KB');
 if(typeof payload.reference!=='string'||!/^[A-Za-z0-9_./-]{4,80}$/.test(payload.reference))throw Error('Invalid fictional reference');
}
function matchName(name,entry){
 const n=normalizeName(name),names=[entry.name,...(entry.aliases||[])].map(normalizeName);
 if(!n)return null;
 if(names[0]===n)return {score:100,rule:'FICTIONAL_EXACT_NAME'};
 if(names.slice(1).includes(n))return {score:96,rule:'FICTIONAL_ALIAS'};
 const set=new Set(n.split(' '));
 const overlap=Math.max(...names.map(v=>v.split(' ').filter(w=>set.has(w)).length/Math.max(set.size,v.split(' ').length)),0);
 return overlap>=0.7?{score:Math.round(overlap*80),rule:'FICTIONAL_TOKEN_OVERLAP'}:null;
}
export function screenSyntheticPayment(payload,watchlist=FICTIONAL_WATCHLIST){
 checkPayload(payload);
 if(!Array.isArray(watchlist)||watchlist.length>25)throw Error('Watchlist exceeds demo limits');
 const matches=[];
 for(const party of ['debtor','creditor']){
  const name=payload[party]?.name;
  if(typeof name!=='string')continue;
  for(const row of watchlist){
   if(typeof row?.id!=='string'||typeof row.name!=='string'||!Array.isArray(row.aliases)||row.aliases.length>10)throw Error('Invalid demo watchlist entry');
   const m=matchName(name,row);
   if(m)matches.push({party,partyName:name,listRecordId:row.id,listName:row.name,score:m.score,rule:m.rule,disposition:'REVIEW_REQUIRED'});
  }
 }
 return {reference:payload.reference,synthetic:true,engine:'DETERMINISTIC_FICTIONAL_MATCHER',
   outcome:matches.length?'POTENTIAL_MATCH':'NO_MATCH',
   matches,explanation:matches.length?'Fictional name similarity only. A person must review; no real sanctions decision.':'No matches against this temporary fictional list; this is not clearance.',
   ai:{status:'DETERMINISTIC_FALLBACK',model:null,liveAiUsed:false},networkSubmitted:false};
}
export function simulateChannel(payload,{channel='REST',attempt=1}={}){
 checkPayload(payload);
 if(!CHANNELS.includes(channel))throw Error('Unsupported simulated channel');
 if(!Number.isSafeInteger(attempt)||attempt<1||attempt>10)throw Error('Retry attempt must be 1–10');
 const token=payload.reference.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,32);
 const id='SIM-'+channel+'-'+token;
 const operations={REST:['REQUEST_RECEIVED','LOCAL_RESPONSE'],MQ:['PUT_MESSAGE','FICTIONAL_CONSUME_ACK'],
  KAFKA:['PUBLISH_EVENT','FICTIONAL_CONSUME_ACK'],FILE:['STAGE_FILE','FICTIONAL_BATCH_ACK'],
  SFTP:['STAGE_TRANSFER','FICTIONAL_DELIVERY_ACK']};
 return {channel,reference:payload.reference,correlationId:id,idempotencyKey:id,
  synthetic:true,transport:'SIMULATED_ONLY',brokerConnected:false,fileTransferred:false,
  attempt,status:'FICTIONAL_ACK',events:operations[channel].map((event,index)=>({
    index,action:event,simulatedOffsetMs:index*100,payloadReference:payload.reference
  })),note:'This is a deterministic UI simulation. No queue, broker, network or file transport is invoked.'};
}
