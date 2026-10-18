import type {DemoRequest,DemoResponse} from './contracts.js';
import {getProduct} from './product-registry.mjs';
import {validateFixture} from '../payment-intelligence/engine.mjs';
const MAX_BYTES=65536;
/** Same bounded, reproducible JSON contract for browser and Worker adapters.
 * Input timelines are asserted scenario evidence, never proof of execution.
 * Only the two stages actually run here appear in steps.
 * @param {import('./contracts').DemoRequest} request
 * @returns {import('./contracts').DemoResponse}
 */
export function executeDemo(request:DemoRequest):DemoResponse{
 if(new TextEncoder().encode(JSON.stringify(request)).length>MAX_BYTES)throw Error('Request exceeds 64 KiB');
 if(request?.contractVersion!==1||request.synthetic!==true)throw Error('Synthetic version-1 contract required');
 const product=getProduct(request.productId);
 if(!product.scenarios.some(s=>s.id===request.scenarioId))throw Error('Unknown scenario');
 const epoch=Date.parse(request.syntheticEpoch);
 if(!Number.isFinite(epoch)||new Date(epoch).toISOString()!==request.syntheticEpoch)throw Error('Explicit canonical synthetic epoch required');
 const payload=structuredClone(request.payload);
 if(payload?.railId!==product.id||payload.scenario!==request.scenarioId||payload.synthetic!==true)throw Error('Product/scenario payload mismatch');
 const report=validateFixture(payload);
 const correlationReference=String(payload.reference);
 const stage=(id:string,input:unknown,output:unknown,result:string,index:number)=>({id,input,output,messageType:String(payload.messageType),result,
 findings:report.issues,syntheticTimestamp:new Date(epoch+index*1000).toISOString(),correlationReference});
 return {contractVersion:1,synthetic:true,productId:product.id,correlationReference,
 steps:[stage('RECEIVED',payload,payload,'RECEIVED',0),stage('CHECKED',payload,report,report.assessment,1)],report,
 ai:{status:'DETERMINISTIC_FALLBACK',model:null,retrieval:[],suggestedCorrections:report.proposals,
 revalidation:'NOT_REQUESTED',explanation:report.nextAction+' No knowledge retrieval or live model was invoked.'}};
}
