import {JOURNEYS} from "./core.mjs";
import {getRail} from "../payment-intelligence/catalog.mjs";
/** Educational summaries only; not scheme participant SLAs. */
const info={
 cbpr:["Correspondents / FI participants","No universal end-to-end clock; route dependent","Correspondent account arrangements outside Swift messaging","Tracker evidence ≠ final settlement","CBPR+ pacs.008 / pacs.009; gpi UETR","Rejection, missing address, tracking gap"],
 sct:["SEPA PSPs via an eligible CSM","Non-instant, rulebook and bank cut-offs apply","Selected CSM/PSP settlement mechanisms","Creditor account posting must be verified","pain.001, pacs.008, pacs.002, pacs.004","Invalid IBAN, return, recall"],
 "sct-inst":["Debtor and creditor PSPs, instant infrastructure","Scheme target below 10 seconds where applicable","RT1 OR TIPS depending on chosen route","Unknown reply ≠ failed or settled","pacs.008, pacs.002 (conceptual)","Timeout, duplicate risk, rejection"],
 chaps:["Direct/indirect CHAPS participants","During CHAPS business operating window","BoE RTGS gross settlement","Participant settlement and beneficiary posting differ","pacs.008 / pacs.009 CORE","Liquidity queue, rejection, unknown RTGS outcome"],
 fps:["Sending and receiving UK PSPs","Near-real-time customer processing","Distinct retail interbank arrangements","Customer notification ≠ individual RTGS gross settlement","FPS scheme-specific messages (conceptual)","Missing reply, receiving PSP unavailable, duplicate"],
 "bacs-debit":["Originator, bureau and sponsoring/paying banks","Bacs batch multi-day cycle","Bacs retail net settlement arrangements","Payment and unpaid reporting are separate","Bacs submission and unpaid files (conceptual)","Mandate absence, file reject, unpaid collection"]
};
export const COMPARISON=Object.freeze(Object.entries(info).map(([id,values])=>{
 const [actors,when,settlement,finality,messages,exceptions]=values;
 return Object.freeze({id,title:JOURNEYS.find(j=>j.id===id).title,actors,when,settlement,finality,messages,exceptions,reference:getRail(id).reference});
}));
export function compareRails(ids){
 if(!Array.isArray(ids)||ids.length<2||ids.length>4||new Set(ids).size!==ids.length)
  throw Error("Select 2–4 different payment journeys");
 return ids.map(id=>{const c=COMPARISON.find(x=>x.id===id);if(!c)throw Error("Unknown rail");return c});
}
