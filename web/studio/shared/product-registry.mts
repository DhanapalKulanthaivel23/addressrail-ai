import type {ProductDefinition,CapabilityStatus} from './contracts.js';
import {RAILS} from '../payment-intelligence/catalog.mjs';
import {SCENARIOS, generateFixture} from '../payment-intelligence/engine.mjs';
const evidence=['tests/product-registry.test.mjs','tests/payment-intelligence.test.mjs'];
const capability=(status:CapabilityStatus,limitations:string[])=>({status,evidence:status==='PENDING'?[]:[...evidence],limitations});
export const PRODUCT_GROUPS=Object.freeze([
 {id:'swift',name:'SWIFT',icon:'◎',children:['cbpr','gpi','g4c','swift-fin','swift-go','swift-fileact']},
 {id:'sepa',name:'SEPA',icon:'€',children:['sct','sct-inst','sdd-core','sdd-b2b']},
 {id:'uk',name:'UK Payments',icon:'£',children:['chaps','boe-rtgs','fps','bacs-credit','bacs-debit']},
 {id:'other',name:'Other payment contexts',icon:'◇',children:RAILS.filter(r=>!['cbpr','gpi','g4c','swift-fin','swift-go','swift-fileact','sct','sct-inst','sdd-core','sdd-b2b','chaps','boe-rtgs','fps','bacs-credit','bacs-debit'].includes(r.id)).map(r=>r.id)}
]);
export const PRODUCTS:ProductDefinition[]=RAILS.map(rail=>{
 const fixture=generateFixture(rail.id);
 const group=PRODUCT_GROUPS.find(g=>g.children.includes(rail.id));
 if(!group)throw Error('Product group missing');
 return {
 id:rail.id,name:rail.name,icon:group.icon,
 parentProduct:group.id,subProducts:[],
 messageTypes:[fixture.messageType],messageVersions:[],standardsReleases:[],
 transformations:(['MT_TO_MX','MX_TO_MT'] as const).map(direction=>({direction,capability:capability('PENDING',['No transformation is implemented by this registry. Recognition is not conversion.'])})),
 validationRules:['DEMO_CURRENCY','DEMO_AMOUNT','DEMO_TIMELINE','DEMO_STATUS_CONFLICT'],
 validSamples:['baseline'],invalidSamples:['invalid-bic'],scenarios:SCENARIOS.map(s=>({...s})),
 stateMachine:{RECEIVED:['CHECKED'],CHECKED:['TRAINING_EXCEPTION','TRAINING_REVIEW','ILLUSTRATIVE_ONLY']},
 flow:['RECEIVED','CHECKED'],restApis:[],postmanEntries:[],knowledgeReferences:[rail.reference],
 implementation:capability('PARTIAL',['Educational metadata checks only; no official schema or scheme validation.','No deployed anonymous API is asserted.']),
 tabs:['Payment testing','Validation','Execution evidence','AI explanation','Capabilities']
 };
});
function freeze(value:unknown){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
freeze(PRODUCTS);freeze(PRODUCT_GROUPS);
export function getProduct(id:string){const product=PRODUCTS.find(p=>p.id===id);if(!product)throw Error('Unsupported product');return product}
export function postmanCollection(){return {info:{name:'AddressRail registry-backed anonymous endpoints',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:PRODUCTS.flatMap(p=>p.restApis.filter(a=>a.status==='DONE').map(a=>({name:p.name,request:{method:a.method,url:'{{baseUrl}}'+a.path}})))}}
