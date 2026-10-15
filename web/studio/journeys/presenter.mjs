/** Stable educational demonstration identifiers, NOT EPC, Swift, CHAPS or scheme rule identifiers. */
import {getRail} from "../payment-intelligence/catalog.mjs";
const SPEECH={
 cbpr:["This is a cross-border messaging journey; the CBPR+ message does not settle money.","Point to UETR correlation and the correspondent chain; a tracking update is not guaranteed beneficiary credit."],
 sct:["SCT defines scheme obligations and an example route may use STEP2.","A pacs.008 instruction, a pacs.002 outcome and a later pacs.004 return mean different things."],
 "sct-inst":["SCT Inst is the scheme. RT1 and TIPS are distinct *alternative* infrastructure routes.","A response timeout creates an unknown outcome, not an implicit rejection or settlement."],
 chaps:["CHAPS is the sterling system and Bank of England RTGS is its gross settlement infrastructure.","A liquidity queue or message acceptance must not be mistaken for a confirmed RTGS settlement."],
 fps:["Faster Payments provides near-real-time retail exchange; customer processing is not individual RTGS settlement.","Missing a response is not evidence that retrying a payment is safe."],
 "bacs-debit":["Bacs is a multi-day batch system; this journey follows Direct Debit collection.","Mandate validation, unpaid collections and indemnity issues have different causes and control paths."]
};
export function presenterScript(simulation){
 if(!simulation?.synthetic||!SPEECH[simulation.journeyId])throw Error("Known synthetic journey required");
 const {journey,scenario}=simulation;
 const [intro,distinction]=SPEECH[simulation.journeyId];
 return [
  {minute:"0:00–0:35",action:"Introduce "+journey.title,say:intro},
  {minute:"0:35–1:20",action:"Point at senders, receivers and messages",say:distinction},
  {minute:"1:20–2:15",action:"Demonstrate "+scenario.label,say:scenario.what+" The evidence is synthetic, and no downstream outcome is inferred."},
  {minute:"2:15–3:00",action:"Review evidence and controls",say:scenario.next+" Ask which authorised system would prove the actual outcome."}
 ];
}
export function educationalRules(simulation){
 if(!simulation?.synthetic||!simulation.report||!simulation.scenario)throw Error("Synthetic simulation required");
 const scenario=simulation.scenario;
 const code="SIM-"+simulation.journeyId.toUpperCase().replace(/-/g,"_")+"-"+scenario.id.toUpperCase().replace(/-/g,"_");
 const rules=[{id:code,severity:"INJECTED_SCENARIO",description:scenario.what,
  evidenceRef:simulation.evidence.at(-1)?.evidenceRef||"EDU-NONE",kind:"SCENARIO (not scheme validation)"}];
 for(const issue of simulation.report.issues)rules.push({id:issue.code,severity:issue.severity,description:issue.explanation,
   evidenceRef:issue.evidenceRef||"EDU-LOCAL-CHECK",kind:"BASIC TEACHING RULE"});
 if(simulation.report.issues.length===0)rules.push({id:"DEMO_NO_BASIC_FINDING",severity:"NOTICE",
  description:"No failure in this limited field-check subset; scenario outcomes are not validated against real infrastructure.",
  evidenceRef:"EDU-LOCAL-CHECK",kind:"BASIC TEACHING RULE"});
 return rules;
}
export const guideMetadata=id=>{
 const rail=getRail(id);
 if(["sct","sct-inst"].includes(id))return {
  reviewed:"15 October 2026",ruleVersion:"EPC 2025 "+(id==="sct"?"SCT":"SCT Inst")+" scheme rulebook v1.2 (effective 30 September 2026)",
  reference:rail.reference};
 return {reviewed:"15 October 2026",ruleVersion:"Illustrative educational profile — check current operator/Swift guidance",reference:rail.reference};
};
