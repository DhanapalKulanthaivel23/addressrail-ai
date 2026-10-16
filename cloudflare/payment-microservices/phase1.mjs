// Synthetic-only durable orchestration. Gateway owns the payment ledger in D1.
// Exactly-once creation uses a unique tenant+idempotency key. Concurrent retries
// may observe PROCESSING and must poll; they must never re-send a bank message.
const response=(value,status=200)=>new Response(JSON.stringify({...value,simulated:true,settlementAttested:false}),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const reject=(error,status=400)=>response({error},status);
const uetrRx=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bicRx=/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/;
const digest=async obj=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(obj))))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function call(env,key,payload) {
  if(!env[key])return {status:503,data:{error:"missing_"+key}};
  try {
    const r=await env[key].fetch(new Request("https://internal/phase1",{method:"POST",headers:{"content-type":"application/json","x-internal-token":env.INTERNAL_TOKEN||""},body:JSON.stringify(payload)}));
    return {status:r.status,data:await r.json()};
  }catch{return {status:503,data:{error:"downstream_unavailable"}}}
}
async function event(db,id,type,detail){await db.prepare("INSERT INTO payment_events(payment_id,event_type,detail) VALUES(?,?,?)").bind(id,type,JSON.stringify(detail)).run()}
async function load(db,tenant,id){
 const row=await db.prepare("SELECT id,uetr,state,message_type,reference,receiver_bic,network_ack,bank_status,error,created_at,updated_at FROM payments WHERE tenant=? AND id=?").bind(tenant,id).first();
 if(!row)return null;
 const ev=await db.prepare("SELECT id,event_type,detail,created_at FROM payment_events WHERE payment_id=? ORDER BY id ASC LIMIT 200").bind(id).all();
 return {...row,events:(ev.results||[]).map(e=>({...e,detail:JSON.parse(e.detail)})),simulated:true,settlementAttested:false};
}
export async function phase1(request,env,tenant="demo"){
 if(!env.DB)return reject("payment_database_unavailable",503);
 const url=new URL(request.url);
 const match=url.pathname.match(/^\/v1\/payments\/([A-Za-z0-9_-]{1,90})(?:\/(events|investigation|report))?$/);
 if(request.method==="GET"){
   if(!match)return reject("not_found",404);
   const payment=await load(env.DB,tenant,match[1]);if(!payment)return reject("payment_not_found",404);
   if(match[2]==="events")return response({paymentId:payment.id,events:payment.events});
   if(match[2]==="investigation"||match[2]==="report")return response({
     paymentId:payment.id,uetr:payment.uetr,state:payment.state,
     finding:payment.error||((payment.bank_status==="RJCT")?"simulated_bank_rejection":null),
     recommendation:payment.state==="UNKNOWN"?"Investigate status before retry; outcome is uncertain.":payment.state==="REJECTED"?"Review synthetic rejection and source data.":"No actionable exception in the synthetic evidence.",
     evidence:payment.events,source:"deterministic_simulator_not_ai",reportVersion:"phase1-1"
   });
   return response(payment);
 }
 if(request.method!=="POST"||url.pathname!=="/v1/payments")return reject("not_found",404);
 let p;try{const body=await request.text();if(body.length>60000)return reject("payload_too_large",413);p=JSON.parse(body)}catch{return reject("invalid_json")}
 if(p?.synthetic!==true||!["MT103","pacs.008"].includes(p.messageType)||!uetrRx.test(p.uetr||"")||!bicRx.test(p.receiverBic||""))return reject("invalid_synthetic_payment");
 const idempotency=request.headers.get("idempotency-key");
 if(!idempotency||!/^[A-Za-z0-9_-]{8,90}$/.test(idempotency))return reject("idempotency_key_required");
 const source={messageType:p.messageType,uetr:p.uetr,receiverBic:p.receiverBic,payload:p.payload||"",reference:p.reference||"",simulateReject:!!p.simulateReject};
 const hash=await digest(source);
 const id=crypto.randomUUID();
 const insert=await env.DB.prepare("INSERT OR IGNORE INTO payments(id,tenant,idempotency_key,request_hash,uetr,state,message_type,reference,receiver_bic) VALUES(?,?,?,?,?,'PROCESSING',?,?,?)")
   .bind(id,tenant,idempotency,hash,p.uetr,p.messageType,String(p.reference||"").slice(0,80),p.receiverBic).run();
 const fresh=insert.meta?.changes===1;
 let savedId=id;
 if(!fresh){
   const prior=await env.DB.prepare("SELECT id,request_hash FROM payments WHERE tenant=? AND (idempotency_key=? OR uetr=?) LIMIT 1").bind(tenant,idempotency,p.uetr).first();
   if(!prior||prior.request_hash!==hash)return reject("idempotency_or_uetr_conflict",409);
   savedId=prior.id;
   return response({payment:await load(env.DB,tenant,savedId),replayed:true},200);
 }
 await event(env.DB,id,"CREATED",{messageType:p.messageType,uetr:p.uetr});
 const validation=await call(env,"CBPR",p);
 if(validation.status!==200||!validation.data.validSubset){
   const error=validation.data.error||"synthetic_validation_failed";
   await env.DB.prepare("UPDATE payments SET state='REJECTED',error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(error,id).run();
   await event(env.DB,id,"REJECTED",{stage:"CBPR",error});
   return response({payment:await load(env.DB,tenant,id)},422);
 }
 await event(env.DB,id,"VALIDATED",{profile:validation.data.validation});
 const result=await call(env,"GPI",p);
 if(result.status!==200){
   // Do not retry blindly: the bank could have processed an uncertain request.
   await env.DB.prepare("UPDATE payments SET state='UNKNOWN',error='network_outcome_unknown',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id).run();
   await event(env.DB,id,"UNKNOWN",{stage:"GPI",httpStatus:result.status});
   return response({payment:await load(env.DB,tenant,id)},202);
 }
 const ack=result.data.networkResponse?.networkAck||null;
 const bank=result.data.trackingStatus||"UNKNOWN";
 const state=bank==="RJCT"?"REJECTED":bank==="ACSP"?"BANK_ACCEPTED":"UNKNOWN";
 await env.DB.prepare("UPDATE payments SET state=?,network_ack=?,bank_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(state,ack,bank,id).run();
 if(ack)await event(env.DB,id,"NETWORK_ACCEPTED",{ack});
 await event(env.DB,id,state,{bankStatus:bank,simulated:true});
 return response({payment:await load(env.DB,tenant,id)},201);
}
