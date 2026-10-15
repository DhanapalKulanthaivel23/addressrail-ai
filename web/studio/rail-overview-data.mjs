/** Separate educational rail profiles. Synthetic lifecycle sketches only. */
const step=(sender,receiver,message,meaning)=>({sender,receiver,message,meaning});
const scenario=(id,title,status,at,evidence,next)=>({id,title,status,at,evidence,next});
export const OVERVIEWS=Object.freeze({
 sdd:{
 title:"SEPA Direct Debit — Core & B2B",intro:"Mandate-driven euro collection: distinguish the EPC schemes, Core versus B2B payer protections, clearing, return and refund.",
 actors:["Creditor / biller","Creditor PSP","Selected SDD CSM","Debtor PSP","Payer"],
 steps:[
  step("Biller","Creditor PSP","Mandate + pain.008 (where used)","Mandate authority must exist; this step is a conceptual customer collection."),
  step("Creditor PSP","Selected CSM","pacs.003","Interbank direct-debit collection instruction."),
  step("Selected CSM","Debtor PSP","Interbank collection / pacs.002 responses","CSM processes according to the scheme and infrastructure arrangements."),
  step("Debtor PSP","Payer account","Debit and account entry","Posting can trigger return or refund workflows."),
  step("Participant PSPs","Biller and payer","pacs.004 / reports or refund workflow","A later R-transaction requires scheme-specific rights and reconciliation.")
 ],
 scenarios:[
  scenario("success","Illustrative collection processed","SIMULATED",4,"Fictional collection and account entry; no actual direct-debit processing.","Reconcile records with authorised scheme/PSP evidence."),
  scenario("mandate","Mandate missing or disputed","RJCT",0,"Synthetic mandate/reference missing.","Check and authenticate the mandate; never invent customer authority."),
  scenario("reject","Collection rejected","RJCT",2,"Synthetic negative pacs.002-type processing outcome.","Read scheme rejection reason and correct under PSP controls."),
  scenario("return","Subsequent collection return","SIMULATED",4,"Synthetic post-processing return / pacs.004 concept.","Verify original and returned transactions; this is not pre-submission rejection."),
  scenario("refund","Payer refund request","PENDING",4,"Synthetic refund request; entitlement depends on scheme and authorisation.","For Core, evaluate applicable refund rights; B2B has different restrictions for authorised collections. Consult current rulebook."),
  scenario("reversal","Creditor reversal request","PENDING",4,"Conceptual reversal request, not proof funds were recovered.","Review the corresponding scheme process and actual recipient response.")
 ],
 distinction:"SDD Core and B2B have different payer/refund protections. Core may provide refunds for authorised collections under defined conditions; B2B generally does not grant the same right for an authorised collection. Verify current rules; no claim of recovery.",
 ai:["Summarise which mandate evidence is missing","Separate rejection, return and refund evidence","Assist case triage subject to PSP approval"],
 caution:"An AI cannot create mandate authorisation, grant refunds, or debit a customer.",
 sample:"pain.008 initiation → pacs.003 collection → pacs.002 status / pacs.004 return (as applicable)"
 },
 fps:{
 title:"UK Faster Payments (FPS)",intro:"Near-real-time sterling retail transfers, with separate customer response and interbank settlement.",
 actors:["Payer","Sending PSP","FPS system","Receiving PSP","Beneficiary"],
 steps:[step("Payer","Sending PSP","Customer retail instruction","Bank authenticates payment intent."),
 step("Sending PSP","FPS","FPS-specific message (conceptual)","Not an invented pacs.008 route."),
 step("FPS","Receiving PSP","Payment instruction","Receiving PSP processes under applicable scheme conditions."),
 step("Receiving PSP","Sending PSP","Positive/negative scheme response","An unanswered request does not prove failure."),
 step("Sending PSP","Payer","Customer confirmation and reconciliation","Customer-level success differs from central-bank gross settlement.")],
 scenarios:[scenario("success","Fictional retail completion","SIMULATED",4,"Synthetic positive customer-level outcome.","Seek PSP account and processing records."),
 scenario("timeout","Missing response / unknown outcome","UNKNOWN",3,"No confirmed scheme response.","Reconcile before a duplicate-risk retry."),
 scenario("reject","Receiving PSP rejects","RJCT",3,"Synthetic explicit scheme rejection.","Use authorised rejection reason before correction."),
 scenario("duplicate","Possible repeated request","PENDING",2,"Synthetic duplicate reference candidate.","Inspect previous status and IDs.")],
 distinction:"FPS near-real-time customer experience is not a CHAPS-style individual RTGS gross settlement claim.",
 ai:["Explain an uncertain response without inventing completion","Detect duplicate candidates","Summarise authorised PSP evidence"],
 caution:"AI must not resend unknown payments automatically.",sample:"FPS scheme-specific retail messages (conceptual)"
 },
 bacs:{
 title:"Bacs — Direct Credit & Direct Debit",intro:"UK batch credit payments and mandate-based debit collections are separate flows.",
 actors:["Originator","Bureau / sponsoring bank","Bacs","Receiving / paying bank","Customer"],
 steps:[step("Originator","Sponsoring bank","Bacs batch / Standard 18 (conceptual)","Different Bacs payment types carry different authority."),
 step("Sponsoring bank","Bacs","Submission and input checks","Files are processed through the multi-day cycle."),
 step("Bacs","Receiving / paying PSP","Batch collection/credit events","Processing stage is separate from settlement."),
 step("Participants","Accounts","Posting and net settlement arrangements","Net settlement differs from file acceptance."),
 step("Banks","Originator","Unpaid/return/reporting","Exceptions may arrive after processing.")],
 scenarios:[scenario("success","Illustrative Bacs batch result","SIMULATED",4,"Fictional batch outcome.","Reconcile actual account and batch reports."),
 scenario("file-reject","Batch submission rejected","RJCT",1,"Synthetic invalid file report.","Correct source file under authorised submission schedule."),
 scenario("unpaid","Direct Debit unpaid","SIMULATED",4,"Synthetic unpaid collection report.","Investigate reason, mandate and original reference."),
 scenario("mandate","Missing Direct Debit mandate","RJCT",0,"No fictional authorised collection mandate.","Confirm mandate at source.")],
 distinction:"Bacs Direct Credit is not Bacs Direct Debit; Direct Debit authority and exceptions require mandate-specific workflows.",
 ai:["Explain rejected Bacs reports","Summarise unpaid items","Highlight missing mandate evidence"],
 caution:"AI cannot create a missing mandate or release funds.",sample:"Bacs Standard 18 teaching record / unpaid reports (not ISO 20022)"
 },
 t2:{
 title:"T2 — Eurosystem RTGS",intro:"Euro central-bank-money gross settlement for large-value interbank obligations. T2 is distinct from TIPS.",
 actors:["Sending participant","T2 settlement service","Receiving participant","Treasury operations"],
 steps:[step("Sending bank","T2","Participant payment instruction","T2 processing is central-bank RTGS."),
 step("T2","Settlement account","Liquidity and eligibility check","Funds and queue constraints are material."),
 step("T2","Receiving account","Gross settlement event","Individual central-bank-money obligation may settle."),
 step("Settlement system","Participants","Settlement confirmation","Actual finality needs authoritative records."),
 step("Participants","Operations","Reconciliation","Bank-level accounting follows system confirmation.")],
 scenarios:[scenario("success","Synthetic T2 gross settlement","SIMULATED",4,"Fictional settlement teaching trace; no Eurosystem link.","Verify actual authoritative T2 confirmation."),
 scenario("liquidity","T2 liquidity hold","PENDING",1,"Fictional insufficient liquidity / queue.","Treasury reconciles queue before claiming settlement."),
 scenario("reject","Instruction rejected","RJCT",1,"Synthetic participant format/eligibility rejection.","Review authorised system rejection details.")],
 distinction:"T2 is a Eurosystem real-time gross settlement service. It is not the retired TARGET2 platform, not the SCT scheme and not TIPS.",
 ai:["Summarise queue reasons","Correlate rejected messages","Explain settlement evidence boundaries"],
 caution:"AI cannot control T2 liquidity or assert central-bank settlement.",sample:"ISO 20022 settlement / camt.* teaching concepts"
 },
 cbpr:{
 title:"SWIFT CBPR+ — Cross-border ISO 20022",intro:"Cross-border payment messages may traverse correspondent banks. Swift gpi provides tracking, not a new settlement system.",
 actors:["Sending FI","Correspondent FI","Beneficiary FI","gpi tracker (overlay)"],
 steps:[step("Customer / bank","Sending FI","Payment initiation / review","Bank validates source instruction and applicable policies."),
 step("Sending FI","Correspondent FI","CBPR+ pacs.008 / pacs.009","Messaging instructs processing; no settlement attestation."),
 step("Correspondent FI","Next participant","Correspondent processing","Accounts, liquidity and cover depend on route."),
 step("Participant banks","Tracker / source systems","UETR / bank statuses","gpi tracking is not central-bank settlement."),
 step("Beneficiary FI","Originator FI","Customer-credit confirmation / reports","Only authorised evidence can confirm actual credit.")],
 scenarios:[scenario("success","Fictional CBPR+ completion","SIMULATED",4,"Fictional outcome with incomplete tracker evidence.","Seek real beneficiary-credit evidence."),
 scenario("address","Beneficiary address review","PENDING",0,"Missing town or country in synthetic debtor/creditor profile.","Verify customer's source records; never invent an address."),
 scenario("reject","Correspondent rejection","RJCT",2,"Synthetic participant negative processing response.","Interpret authoritative rejection before repair."),
 scenario("tracking-gap","Tracker evidence missing","UNKNOWN",3,"No final bank-sourced status available.","Reconcile with chain participants before retry.")],
 distinction:"CBPR+ is a Swift usage profile, not clearing or settlement; UETR supports correlation but cannot independently prove beneficiary credit.",
 ai:["Explain mapping failures","Find missing UETR evidence","Summarise correspondent rejection details"],
 caution:"AI must not infer credit from a tracking gap or trigger an automatic retry.",sample:"CBPR+ pacs.008 / pacs.009 / pacs.002 / camt.056 (as relevant)"
 },
 cls:{
 title:"CLS — FX Payment-versus-Payment (PvP)",intro:"CLS Settlement can reduce FX principal risk using simultaneous PvP settlement across eligible currencies/participants.",
 actors:["Settlement member","CLS services","Pay-in / pay-out arrangements","Member treasury"],
 steps:[step("Member","CLS","FX settlement instruction","Matching and eligibility controls apply."),
 step("CLS","Counterparty member","Trade match and validation","Unmatched or invalid instructions require review."),
 step("Members","Funding arrangements","Pay-in schedule/settlement resources","Liquidity/funding timing matters."),
 step("CLS","Members","PvP settlement outcome","Actual PvP depends on live participant/scheme evidence."),
 step("Members","Operations","Pay-out and reconciliation","Funding and payout reporting follow applicable procedures.")],
 scenarios:[scenario("success","Synthetic FX PvP settlement","SIMULATED",4,"No live CLS account access or settlement.","Obtain actual CLS/member confirmation."),
 scenario("unmatched","Unmatched settlement instruction","RJCT",1,"Synthetic mismatch in eligible settlement terms.","Match source instructions under member controls."),
 scenario("funding","Insufficient pay-in funding","PENDING",2,"Synthetic missed funding requirement.","Member treasury addresses actual funding state.")],
 distinction:"CLS FX PvP is not a cross-border credit-transfer scheme or Swift gpi tracker; currency/service eligibility and timing must be checked.",
 ai:["Explain unmatched FX instructions","Summarise funding exceptions","Organise reconciliation evidence"],
 caution:"AI cannot initiate FX settlement or assert CLS finality.",sample:"CLS settlement instruction and reporting (conceptual)"
 }
});
export function getOverview(id){if(!Object.hasOwn(OVERVIEWS,id))throw Error("Unknown overview");return OVERVIEWS[id];}
export function sampleOverview(id,scenarioId){
 const rail=getOverview(id),sc=rail.scenarios.find(x=>x.id===scenarioId);
 if(!sc)throw Error("Unknown synthetic scenario");
 return {synthetic:true,rail:id,scenario:sc,status:sc.status,
  stages:rail.steps.slice(0,sc.at+1),
  evidenceRef:"AR-SIM-"+id.toUpperCase()+"-"+scenarioId.toUpperCase(),
  disclaimer:"Illustrative fictional simulation; no scheme validation or settlement."};
}
