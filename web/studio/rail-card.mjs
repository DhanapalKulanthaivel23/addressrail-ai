/** Three curated beginner rail cards; fictional timelines, not settlement confirmations. */
const q=(question,answers,correct,explanation)=>Object.freeze({question,answers,correct,explanation});
export const RAIL_CARDS=Object.freeze({
 "sct-inst":{
  title:"SEPA Instant Credit Transfer (SCT Inst)",
  actors:["Payer","Debtor PSP","RT1 OR TIPS","Creditor PSP","Payee"],
  messageSuccess:["Customer instruction","pacs.008 sent using one supported instant route","Illustrative creditor processing","pacs.002 positive response (as applicable)","Verified customer notification — in a real case evidence required"],
  messageFailure:["Customer instruction","pacs.008 transmitted","No authoritative response received (timeout)","Outcome UNKNOWN; do not infer RJCT or settled","Investigate and reconcile before any retry"],
  settlement:"SCT Inst is the EPC scheme; TIPS and RT1 are alternative infrastructures. Finality and PSP customer credit evidence depend on actual participant processing; the demo does not attest either.",
  ai:["Summarise missing reply and correlation references","Detect duplicate-risk statements without a status source","Recommend authorised PSP reconciliation"],
  caution:"AI may not declare a timed-out transfer settled, rejected or safely repeatable.",
  link:"../sct-inst/?scenario=timeout",
  quizzes:[
   q("SCT Inst is primarily what?",["A payment scheme","A bank's private API","One specific central bank ledger"],0,"The EPC SCT Inst scheme defines common instant euro transfer rules."),
   q("Which is the accurate routing statement?",["Each payment must use RT1 then TIPS","RT1 and TIPS can be different alternatives","Every transfer uses CHAPS"],1,"A specific transfer uses an eligible route; RT1 and TIPS are not one mandatory chain."),
   q("A timeout without a confirmed reply means…",["Settled","Rejected","Unknown outcome"],2,"No authoritative response cannot establish success or failure."),
   q("Which message may convey interbank status?",["pacs.002","MT940 only","pain.008"],0,"pacs.002 can be used for payment processing status under applicable guidelines."),
   q("What happens before retrying an unknown payment?",["Immediately resend","Reconcile authorised evidence","Trust a generative answer"],1,"Unknown outcomes require reconciliation to avoid duplicate risk.")
  ]
 },
 sct:{
  title:"SEPA Credit Transfer (SCT)",
  actors:["Customer","Debtor PSP","Eligible CSM","Creditor PSP","Payee"],
  messageSuccess:["Customer pain.001 instruction where used","Debtor PSP validates and sends pacs.008","CSM processes the fictional interbank instruction","Creditor PSP processes and posts to payee","PSPs reconcile reports and posting evidence"],
  messageFailure:["Customer pain.001 where used","pacs.008 to eligible CSM","pacs.002 RJCT-type response (illustrative)","Processing stops; no beneficiary posting asserted","Correct data under PSP control before any resubmission"],
  settlement:"An EPC scheme is different from its clearing-and-settlement mechanism (CSM). STEP2 is one possible CSM. A return (pacs.004) after processing differs from a pre-processing rejection.",
  ai:["Explain a deterministic IBAN-format finding","Summarise authentic rejection/return reasons","Identify whether a recall is still pending"],
  caution:"AI cannot invent PSP approval, recover funds from a recall request or assert final beneficiary posting.",
  link:"../journeys/?mode=learner&rail=sct&scenario=iban-reject",
  quizzes:[
   q("SCT primarily defines…",["An EPC credit transfer scheme","Only a central-bank ledger","A SWIFT tracker"],0,"The EPC SCT scheme provides common SEPA credit-transfer requirements."),
   q("What is STEP2 in this context?",["A possible CSM","The only EPC scheme","A bank's retail app"],0,"STEP2 is one available mechanism, not the EPC scheme itself."),
   q("A pacs.002 RJCT generally signals…",["An explicit negative processing outcome","A completed beneficiary credit","A SEPA recall recovery"],0,"Reject and success have different evidence."),
   q("Which may be used for a subsequent return?",["pacs.004","pacs.008 always","Bacs Standard 18"],0,"pacs.004 is an ISO payment-return message family under applicable conditions."),
   q("Does a recall request guarantee returned funds?",["Yes","No","Only if an LLM recommends it"],1,"Requests need an affirmative authorised response and reconciliation.")
  ]
 },
 chaps:{
  title:"CHAPS / Bank of England RTGS",
  actors:["Customer","Sending participant","BoE RTGS","Receiving participant","Beneficiary"],
  messageSuccess:["Customer instruction approved by sending bank","CHAPS pacs.008 or pacs.009 as applicable","Illustrative BoE RTGS gross settlement event","Receiving participant processes the credit","Separate beneficiary posting evidence"],
  messageFailure:["Customer request approved","CHAPS instruction submitted","Liquidity queue / pending RTGS settlement","No settlement confirmation — stop the fictional trace","Participant treasury investigates and manages liquidity"],
  settlement:"CHAPS is the GBP high-value payment system. The Bank of England RTGS service settles obligations gross. Sending a CHAPS ISO message and crediting a beneficiary are separate from interbank settlement.",
  ai:["Group liquidity and queue evidence","Explain pacs.008 versus pacs.009 CORE","Summarise missing RTGS settlement proof"],
  caution:"AI may not release a held payment, claim RTGS finality or bypass participant controls.",
  link:"../chaps/?scenario=liquidity-hold#case-lab",
  quizzes:[
   q("CHAPS interbank settlement occurs in…",["Bacs","Bank of England RTGS","Swift gpi"],1,"BoE RTGS settles CHAPS obligations individually."),
   q("Which is an interbank FI transfer example?",["pacs.009 CORE","pain.008 mandate","Bacs unpaid report"],0,"pacs.009 CORE can be used for FI-to-FI transfers within the applicable CHAPS usage."),
   q("A payment held in liquidity queue is…",["Settled","Pending","Beneficiary credited"],1,"Pending cannot be called settled without RTGS evidence."),
   q("Does submitting pacs.008 itself move RTGS balances?",["No","Always","Only in instant euro"],0,"Messaging and settlement are distinct."),
   q("Who can confirm actual settlement?",["A scripted LLM replay","Authoritative participant/RTGS records","An unsupported timestamp"],1,"Authoritative RTGS/participant evidence is needed for genuine settlement.")
  ]
 }
});
export function getCard(id){if(!Object.hasOwn(RAIL_CARDS,id))throw Error("Unsupported learning rail");return RAIL_CARDS[id];}
export function gradeCard(id,index,answer){
 const card=getCard(id),quiz=card.quizzes[index];
 if(!quiz||!Number.isInteger(answer)||answer<0||answer>=quiz.answers.length)throw Error("Invalid answer");
 return {correct:answer===quiz.correct,explanation:quiz.explanation};
}
