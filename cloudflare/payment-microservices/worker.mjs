import {phase1} from "./phase1.mjs";
import {support,PROFILE_VERSION} from "./registry.mjs";
// Independently deployable, synthetic-only payment simulators for Cloudflare Workers.
// Each deployment uses SERVICE_ROLE. There is NO live network connectivity.
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
const err=(code,status=400)=>json({error:code,simulated:true},status);
const roles=new Set(["gateway","cbpr","gpi","swift-network","bank","sepa","sepa-clearing","rtgs","chaps","t2"]);
const family=/^(MT(103|202|202COV|199)|(?:pain|pacs|camt)\.\d{3}(?:\.\d{3}\.\d{2})?)$/i;
const schemeTypes={
 cbpr:["MT103","MT202","MT202COV","MT199","pacs.008","pacs.009","pacs.002","pacs.004","camt.056","camt.029"],
 gpi:["pacs.008","pacs.009","pacs.002","MT103","MT202"],
 sepa:["pain.001","pain.002","pain.008","pacs.003","pacs.008","pacs.002","pacs.004","camt.056","camt.029"],
 chaps:["pacs.008","pacs.009","pacs.002"],
 t2:["pacs.008","pacs.009","pacs.002","camt.053"]
};
const allowed=(kind,type)=>schemeTypes[kind]?.some(x=>type===x||type.startsWith(x+"."))??false;
const safeRef=p=>String(p.reference??p.uetr??"").slice(0,80);
async function forward(env,binding,path,payload){
 if(!env[binding])return {status:503,result:{error:"service_binding_missing",binding}};
 const response=await env[binding].fetch(new Request("https://internal"+path,{method:"POST",headers:{"content-type":"application/json","x-internal-token":env.INTERNAL_TOKEN||""},body:JSON.stringify(payload)}));
 return {status:response.status,result:await response.json()};
}
async function quota(db,tenant,limit){
 if(!db) return false; // fail closed
 const day=new Date().toISOString().slice(0,10);
 await db.prepare("INSERT OR IGNORE INTO api_usage (tenant,day,count) VALUES (?,?,0)").bind(tenant,day).run();
 const res=await db.prepare("UPDATE api_usage SET count=count+1 WHERE tenant=? AND day=? AND count<?").bind(tenant,day,limit).run();
 return res.meta?.changes===1;
}
export default {async fetch(request,env){
 const role=env.SERVICE_ROLE||"gateway";
 if(!roles.has(role))return err("invalid_role",500);
 const url=new URL(request.url);
 if(url.pathname==="/health")return json({service:role,status:"up",simulated:true});
 if(role==="gateway" && (url.pathname==="/v1/payments" || url.pathname.startsWith("/v1/payments/"))){
   if(!env.API_KEY||request.headers.get("x-api-key")!==env.API_KEY)return err("unauthorized",401);
   return phase1(request,env);
 }
 if(request.method!=="POST")return err("method_not_allowed",405);
 if((role!=="gateway")&&(!env.INTERNAL_TOKEN||request.headers.get("x-internal-token")!==env.INTERNAL_TOKEN))return err("internal_only",403);
 let data;try{if(Number(request.headers.get("content-length"))>65536)return err("payload_too_large",413);const raw=await request.text();if(raw.length>65536)return err("payload_too_large",413);data=JSON.parse(raw)}catch{return err("invalid_json")}
 if(data?.synthetic!==true)return err("synthetic_true_required");
 if(role==="gateway"){
   if(!env.API_KEY||request.headers.get("x-api-key")!==env.API_KEY)return err("unauthorized",401);
   const tenant="demo"; // single configured demo tenant; never trust arbitrary caller tenant IDs
   if(!await quota(env.DB,tenant,Number(env.DAILY_LIMIT||25)))return err("quota_exceeded_or_database_unavailable",429);
   const service=url.pathname.split("/")[2];
   const bind={"cbpr":"CBPR","gpi":"GPI","swift-network":"SWIFT","sepa":"SEPA","rtgs":"RTGS","chaps":"CHAPS","t2":"T2"}[service];
   if(!bind)return err("unknown_service",404);
   const r=await forward(env,bind,url.pathname,data);return json(r.result,r.status);
 }
 const typ=String(data.messageType||"");
 if(["cbpr","gpi","sepa","chaps","t2"].includes(role)&&(!family.test(typ)||!allowed(role,typ)))return err("unsupported_message_type");
 const base={simulated:true,network:role,messageType:typ,reference:safeRef(data),settlementAttested:false,profileVersion:PROFILE_VERSION};
 if(role==="cbpr"){
   if(!support("CBPR",typ).workflow)return err("unsupported_cbpr_workflow");
   const payload=String(data.payload||"");
   if(payload.length>60000)return err("payload_too_large",413);
   const recognised=typ.startsWith("MT")?payload.includes(":20:"):payload.includes("<")&&payload.includes(">");
   return json({...base,validSubset:recognised,validation:"educational_structure_only_not_xsd_or_cbpr_conformance",
     findings:recognised?[]:[{code:"INCOMPLETE_SAMPLE",message:"No recognisable message structure"}]});
 }
 if(role==="swift-network"){
   if(!data.receiverBic||!(/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(data.receiverBic)))return err("receiver_bic_invalid");
   const bank=await forward(env,"BANK","/internal/receive",data);
   if(bank.status!==200)return json({...base,error:"bank_service_unavailable",bankResponse:bank.result},502);
   return json({...base,networkAck:"SIMULATED_ACCEPTED",bankResponse:bank.result});
 }
 if(role==="bank")return json({...base,bankStatus:data.simulateReject?"RJCT":"ACSP",reason:data.simulateReject?"SIMULATED_BANK_REJECTION":null});
 if(role==="gpi"){
   if(!data.uetr||!/^[0-9a-fA-F-]{36}$/.test(data.uetr))return err("uetr_required");
   const upstream=await forward(env,"SWIFT","/internal/send",data);
   if(upstream.status!==200)return json({...base,error:"swift_network_unavailable",networkResponse:upstream.result},502);
   return json({...base,uetr:data.uetr,trackingStatus:upstream.result.bankResponse?.bankStatus||"UNKNOWN",networkResponse:upstream.result});
 }
 if(role==="sepa"){
   if(!support(data.scheme,typ).workflow && !["RECALL","RETURN","REFUND"].includes(data.scheme))return err("unsupported_scheme_message_combination");
   if(!["SCT","SCT_INST","SDD_CORE","SDD_B2B","RECALL","RETURN","REFUND"].includes(data.scheme))return err("unsupported_sepa_scheme");
   const clear=await forward(env,"CLEARING","/internal/clear",data);
   if(clear.status!==200)return json({...base,error:"clearing_service_unavailable",clearing:clear.result},502);
   return json({...base,scheme:data.scheme,clearing:clear.result});
 }
 if(role==="sepa-clearing")return json({...base,clearingStatus:data.simulateReject?"SIMULATED_REJECTED":"SIMULATED_ACCEPTED",settlementStatus:"NOT_ATTESTED"});
 if(role==="rtgs"){
   if(!["GBP","EUR"].includes(data.currency))return err("unsupported_currency");
   return json({...base,settlementStatus:data.simulateReject?"SIMULATED_REJECTED":"SIMULATED_SETTLED",realFundsMoved:false});
 }
 if(role==="chaps"||role==="t2"){
   const required=role==="chaps"?"GBP":"EUR";
   if(data.currency!==required)return err("currency_mismatch");
   const settled=await forward(env,"RTGS","/internal/settle",data);
   if(settled.status!==200)return json({...base,error:"settlement_service_unavailable",settlement:settled.result},502);
   return json({...base,scheme:role.toUpperCase(),settlement:settled.result});
 }
 return err("not_implemented",501);
}};