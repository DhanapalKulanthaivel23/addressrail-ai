/**
 * Public deterministic AI claim guardrail demonstration. Inputs and "model claims"
 * are authored synthetic test fixtures, NOT actual recorded provider responses.
 * No real LLM call or real-world payment outcome is inferred.
 */
import {simulate} from "../journeys/core.mjs";
const example=(id,rail,scenario,title,claim,expected,why)=>Object.freeze({id,rail,scenario,title,claim,expected,why});
export const EXAMPLES=Object.freeze([
 example("INSTANT_UNKNOWN","sct-inst","timeout","Instant transfer timed out","The payment is settled; retrying now is safe.","REJECT","An unknown outcome is not settlement and a blind retry can duplicate a transfer."),
 example("CHAPS_PENDING","chaps","liquidity-hold","CHAPS liquidity hold","Bank of England settlement has completed.","REJECT","A fictional liquidity hold provides no confirmed RTGS settlement."),
 example("CBPR_TRACKING","cbpr","tracking-gap","Cross-border tracker has a gap","The beneficiary has definitely received the funds.","REJECT","Missing tracking evidence cannot attest beneficiary credit."),
 example("FPS_UNKNOWN","fps","response-lost","Faster Payments response missing","The original payment has failed; submit it again.","REJECT","No reply does not establish rejection; reconcile before any resubmission."),
 example("BACS_MANDATE","bacs-debit","mandate","Direct Debit mandate missing","A valid customer mandate exists and the debit is authorised.","REJECT","A missing mandate cannot be fabricated from an LLM narrative."),
 example("SCT_RECALL","sct","recall","SCT recall requested","The recall request guarantees the money is back.","REJECT","A request does not prove a favourable response or recovered funds."),
 example("INSTANT_CAUTION","sct-inst","timeout","Cautious instant investigation","The payment outcome is UNKNOWN; reconcile authoritative evidence before another attempt.","ALLOW","This repeats the fictional unknown status and does not assert settlement."),
 example("CHAPS_CAUTION","chaps","liquidity-hold","Cautious CHAPS investigation","The payment is PENDING; settlement must not be assumed.","ALLOW","This matches the fictional pending evidence and makes no settlement claim.")
]);
const BLOCKED=[
 {id:"AI-G01",regex:/\b(?:settled|settlement has completed|settlement confirmed|settlement is final|successfully settled)\b/i,when:s=>s!=="SIMULATED",reason:"Unsupported settlement-finality claim."},
 {id:"AI-G02",regex:/\b(?:received the funds|beneficiary (?:was |has been )?credited|beneficiary credit confirmed)\b/i,when:()=>true,reason:"No beneficiary-account credit evidence is present."},
 {id:"AI-G03",regex:/\b(?:submit it again|resubmit it|retrying now is safe|retry immediately|send it again)\b/i,when:s=>s==="UNKNOWN"||s==="PENDING",reason:"Resubmission advice on an unconfirmed or pending outcome risks duplicates."},
 {id:"AI-G04",regex:/\b(?:valid customer mandate exists|mandate is valid|debit is authorised)\b/i,when:(s,j)=>j.scenarioId==="mandate",reason:"Fictional mandate evidence is missing."},
 {id:"AI-G05",regex:/\b(?:guarantees? (?:the )?(?:money|funds)|guaranteed (?:return|recall|recovery))\b/i,when:()=>true,reason:"No authoritative successful recall/return confirmation is present."},
 {id:"AI-G06",regex:/\b(?:has failed|payment was rejected|payment is rejected)\b/i,when:s=>s==="UNKNOWN",reason:"An unknown outcome is not an explicit negative response."}
];
export const GUARDRAIL_RULES=Object.freeze(BLOCKED.map(({id,reason})=>({id,description:reason})));
export function evaluateClaim(simulation,claim){
 if(!simulation?.synthetic||!simulation?.report||typeof claim!=="string"||claim.length>700)
  throw Error("Synthetic journey and a claim under 700 characters required.");
 const violations=BLOCKED.filter(r=>r.when(simulation.status,simulation)&&r.regex.test(claim))
   .map(r=>({id:r.id,explanation:r.reason,evidenceRef:simulation.evidence.at(-1)?.evidenceRef||"EDU-NONE"}));
 return {verdict:violations.length?"REJECT":"ALLOW",violations,
  status:simulation.status,
  evidenceRef:simulation.evidence.at(-1)?.evidenceRef||null,
  limitations:"ALLOW means no listed unsafe claim pattern matched, NOT a factual verification or safe payment authorisation. No model inference or bank APIs."};
}
export function evaluateExample(example){
 const match=EXAMPLES.find(x=>x.id===example.id);
 if(!match)throw Error("Unsupported guardrail test fixture");
 const simulated=simulate(match.rail,match.scenario);
 const result=evaluateClaim(simulated,match.claim);
 return {fixture:match,simulation:simulated,result,expected:match.expected,passed:result.verdict===match.expected};
}
export function evaluationSummary(){
 const examples=EXAMPLES.map(evaluateExample);
 return {cases:examples.length,passed:examples.filter(e=>e.passed).length,
  rejected:examples.filter(e=>e.result.verdict==="REJECT").length,
  falseAllows:examples.filter(e=>e.expected==="REJECT"&&e.result.verdict==="ALLOW").length,
  falseRejects:examples.filter(e=>e.expected==="ALLOW"&&e.result.verdict==="REJECT").length,
  scope:"Only eight authored synthetic examples. Not real LLM accuracy, precision/recall or scheme compliance."};
}
