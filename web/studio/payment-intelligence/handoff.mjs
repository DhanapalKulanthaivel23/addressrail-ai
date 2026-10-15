/** Transient, browser-tab-local handoff from cross-rail teaching checks to guest cases. */
import {getRail} from "./catalog.mjs";
import {safeText} from "./engine.mjs";

export const HANDOFF_KEY="addressrail.intelligence.handoff.v1";
export const IMPORT_SCENARIO_ID="intelligence-import";
export const ALLOWED_OUTCOMES=Object.freeze([
 "RJCT","PENDING","UNKNOWN","ACTC","ACSC","SIMULATED"
]);
const clip=(value,max)=>safeText(value).slice(0,max);
export function prepareHandoff(report){
 if(!report || report.synthetic!==true || report.educationalOnly!==true)
   throw Error("Only synthetic educational reports can be imported.");
 const rail=getRail(report.rail?.id);
 const status=ALLOWED_OUTCOMES.includes(report.paymentStatus)?report.paymentStatus:"UNKNOWN";
 const handoff={
  version:1,synthetic:true,kind:"CROSS_RAIL_EDUCATIONAL_CASE",
  railId:rail.id,rail:rail.name,caseReference:clip(report.reference,80),
  messageType:clip(report.messageType,40),currency:clip(report.currency,3),
  amount:clip(report.amount,20),paymentStatus:status,
  assessment:clip(report.assessment,35),
  finding:clip((report.issues||[]).filter(i=>i.severity==="ERROR").map(i=>i.explanation).join(" ")||
    (report.issues||[]).map(i=>i.explanation).join(" ")||
    "No injected basic-rule exception detected; not official scheme verification.",650),
  recommendation:clip(report.nextAction,400),
  issues:(report.issues||[]).slice(0,12).map(i=>({
    code:clip(i.code,45),severity:clip(i.severity,10),
    path:clip(i.path,70),explanation:clip(i.explanation,220)})),
  events:(report.evidence||[]).slice(0,20).map(e=>({
    type:clip(e.type,45),description:clip(e.description,240),
    evidenceRef:clip(e.evidenceRef,95)}))
 };
 if(!validateHandoff(handoff))throw Error("Teaching report is incomplete for case handoff.");
 return handoff;
}
export function validateHandoff(value){
 try {
  if(!value||typeof value!=="object"||value.version!==1||value.synthetic!==true||
     value.kind!=="CROSS_RAIL_EDUCATIONAL_CASE" ||
     !ALLOWED_OUTCOMES.includes(value.paymentStatus))return false;
  getRail(value.railId);
  if(typeof value.rail!=="string"||value.rail!==getRail(value.railId).name||
     typeof value.caseReference!=="string"||value.caseReference.length>80||
     typeof value.messageType!=="string"||value.messageType.length>40||
     !["EUR","GBP"].includes(value.currency)||
     typeof value.amount!=="string"||value.amount.length>20||
     typeof value.finding!=="string"||value.finding.length>650||
     typeof value.recommendation!=="string"||value.recommendation.length>400 ||
     !Array.isArray(value.events)||value.events.length>20||
     !Array.isArray(value.issues)||value.issues.length>12)return false;
  if(value.events.some(e=>typeof e.type!=="string"||e.type.length>45||
      typeof e.description!=="string"||e.description.length>240||
      typeof e.evidenceRef!=="string"||e.evidenceRef.length>95))return false;
  return JSON.stringify(value).length<=8500;
 }catch{return false;}
}
