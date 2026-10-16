// Versioned educational message registry. A listed message is NOT certified or fully validated.
export const PROFILE_VERSION="addressrail-synthetic-2026.10";
const mt=["101","102","103","103 STP","103 REMIT","104","107","110","111","112","190","191","192","195","196","198","199","200","201","202","202 COV","203","204","205","205 COV","210","292","295","296","299","900","910","920","935","940","941","942","950"];
const mx={
 pain:["001","002","007","008","009","010","011","012","013","014","017","018"],
 pacs:["002","003","004","007","008","009","010","028"],
 camt:["025","026","027","028","029","030","031","032","033","034","035","036","037","038","039","040","041","042","043","044","045","046","047","048","049","050","051","052","053","054","055","056","057","058","059","060","061","062","063","064","065","066","067","068","069","070","071","072","073","074","075","076","077","078","079","080","081","082","083","084","085","086","087","088","089","090","091","092","093","094","095","096","097","098","099"]
};
export const catalogue=[
 ...mt.map(code=>({id:"MT"+code.replaceAll(" ",""),family:"MT",scope:"recognised-only"})),
 ...Object.entries(mx).flatMap(([family,numbers])=>numbers.map(number=>({id:family+"."+number,family,scope:"recognised-only"})))
];
const supportedFlow={
 CBPR:["MT103","MT202","MT202COV","pacs.008","pacs.009","pacs.002","pacs.004","camt.056","camt.029"],
 GPI:["MT103","pacs.008","pacs.009","pacs.002"],
 G4C:["pain.001","pain.002","pacs.008","pacs.002"],
 SCT:["pain.001","pain.002","pacs.008","pacs.002","pacs.004","camt.056","camt.029"],
 SCT_INST:["pain.001","pain.002","pacs.008","pacs.002","pacs.004","camt.056","camt.029"],
 SDD_CORE:["pain.008","pacs.003","pacs.002","pacs.004","camt.056","camt.029"],
 SDD_B2B:["pain.008","pacs.003","pacs.002","pacs.004","camt.056","camt.029"],
 CHAPS:["pacs.008","pacs.009","pacs.002"],
 T2:["pacs.008","pacs.009","pacs.002","camt.053","camt.054"]
};
export const flows=Object.freeze(supportedFlow);
export function canonicalType(raw){
 const s=String(raw||"").trim().toUpperCase().replaceAll(/\s+/g,"");
 if(/^MT\d{3}(?:STP|REMIT|COV)?$/.test(s))return s;
 const m=s.match(/^(PAIN|PACS|CAMT)\.(\d{3})(?:\.\d{3}\.\d{2})?$/);
 return m?m[1].toLowerCase()+"."+m[2]:null;
}
export function support(scheme,raw){
 const type=canonicalType(raw);
 if(!type)return {recognised:false,workflow:false,reason:"unrecognised_message"};
 const known=catalogue.some(x=>x.id===type);
 const workflow=!!flows[String(scheme).toUpperCase()]?.includes(type);
 return {recognised:known,workflow,scheme:String(scheme).toUpperCase(),type,profile:PROFILE_VERSION,
  reason:workflow?"synthetic_workflow_only":known?"schema_or_business_rules_not_implemented":"unrecognised_message"};
}
export const transitions={
 CREATED:["VALIDATED","REJECTED"],VALIDATED:["SUBMITTED","REJECTED"],
 SUBMITTED:["NETWORK_ACCEPTED","REJECTED","UNKNOWN"],NETWORK_ACCEPTED:["BANK_ACCEPTED","REJECTED","UNKNOWN"],
 BANK_ACCEPTED:["SETTLEMENT_PENDING","RETURN_REQUESTED","UNKNOWN"],
 SETTLEMENT_PENDING:["SIMULATED_SETTLED","REJECTED","UNKNOWN"],
 SIMULATED_SETTLED:["RETURN_REQUESTED","RECALL_REQUESTED"],
 RECALL_REQUESTED:["RECALLED","RECALL_REJECTED"],
 RETURN_REQUESTED:["SIMULATED_RETURNED","RETURN_REJECTED"],
 REJECTED:[],UNKNOWN:["BANK_ACCEPTED","REJECTED","SETTLEMENT_PENDING"],
 RECALLED:[],RECALL_REJECTED:[],SIMULATED_RETURNED:[],RETURN_REJECTED:[]
};
export function transition(current,next){return (transitions[current]||[]).includes(next)}
