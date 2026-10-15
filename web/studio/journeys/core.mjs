/** AddressRail AI public learning engine: illustrative, browser-only and not bank/scheme conformance. */
import {RAILS,getRail} from "../payment-intelligence/catalog.mjs";
import {generateFixture,validateFixture} from "../payment-intelligence/engine.mjs";
export const AUDIENCES=Object.freeze({
 professional:{title:"Explain & present",description:"Lead a stakeholder walkthrough; compare counterparties, evidence and settlement boundaries.",prompt:"Ask: Who sends the message, who confirms processing, and what would constitute authoritative evidence?"},
 ai:{title:"Explore banking AI",description:"Compare rules with an explainable hypothetical LLM assistant. No model is actually called.",prompt:"Ask: What can AI explain, and which facts must remain grounded in bank or scheme evidence?"},
 learner:{title:"Learn by doing",description:"Start with definitions, move step by step, inject a failure and check your understanding.",prompt:"Ask: What is the difference between an instruction, a message, clearing and final settlement?"}
});
const step=(title,sender,receiver,message,meaning)=>Object.freeze({title,sender,receiver,message,meaning});
const fault=(id,label,at,status,what,evidence,next,ai)=>Object.freeze({
 id,label,at,status,what,evidence,next,ai
});
const define=(id,title,intro,distinction,stages,scenarios,quiz)=>Object.freeze({
 id,title,intro,distinction,stages:Object.freeze(stages),scenarios:Object.freeze(scenarios),quiz
});
export const JOURNEYS=Object.freeze([
 define("cbpr","SWIFT CBPR+ / gpi",
 "Cross-border payment messaging with an illustrative correspondent-bank route and an optional tracking overlay.",
 "CBPR+ is a messaging usage profile, not a settlement system. Swift gpi adds tracking; status is not proof of beneficiary credit without suitable evidence.",
 [
 step("Customer instructs bank","Corporate customer","Originating bank","Customer instruction (channel-dependent)","The debtor asks its bank to make a cross-border transfer."),
 step("Validate and review","Originating bank","Bank control systems","Payment and party fields","Bank checks payment data, permissions and relevant compliance controls."),
 step("Transmit cross-border instruction","Sending bank","Correspondent / beneficiary bank","CBPR+ pacs.008; pacs.009 where relevant","The instruction is exchanged; the message itself does not move central-bank money."),
 step("Process correspondent arrangements","Correspondent bank","Next bank / beneficiary bank","Correspondent account and payment-processing evidence","Correspondent accounts, cover and liquidity arrangements depend on the route."),
 step("Track and reconcile","Participating banks","Originating bank / customer","gpi UETR tracking / confirmations","Reconcile statuses, fees and beneficiary-credit evidence with authorised sources.")
 ],[
 fault("success","Illustrative completed journey",4,"SIMULATED","All fictional stages reached; completion is not attested settlement.","Synthetic tracker confirmation only","Seek authorised beneficiary-credit evidence before declaring a real payment complete.","Explain why a tracker label must not become invented settlement proof."),
 fault("address-review","Missing beneficiary address",1,"PENDING","Address information needs clarification; fictional bank holds the instruction.","Incomplete creditor address","Verify original customer records and applicable CBPR+ usage rules.","Summarise missing elements but never fabricate a town or party."),
 fault("correspondent-reject","Correspondent rejection",3,"RJCT","A fictional correspondent rejects the instruction.","Illustrative negative processing response","Check the genuine rejection reason before correction or resubmission.","Group rejection evidence and point to a human-controlled correction."),
 fault("tracking-gap","UETR tracking gap / unknown outcome",4,"UNKNOWN","Expected tracking evidence is missing; funds must not be assumed returned or received.","No authoritative final confirmation","Reconcile with participants before any duplicate-prone retry.","Identify the missing evidence, not predict settlement as a fact.")
 ],["Why does a CBPR+ pacs.008 not itself prove settlement?",["It is a payment messaging instruction","It moves central-bank balances automatically","It is the same as a gpi settlement system"],0,"Messaging and the underlying settlement arrangements are separate."]),
 define("sct","SEPA Credit Transfer (SCT)",
 "A non-instant euro credit transfer scheme operated by participating PSPs using a clearing and settlement mechanism (CSM).",
 "SCT is the EPC scheme. STEP2 is one possible clearing and settlement mechanism, not the scheme rulebook.",
 [
 step("Initiate credit transfer","Customer","Debtor PSP","pain.001 (where used)","A customer or corporate asks its PSP to execute a euro credit transfer."),
 step("Authorise and validate","Debtor PSP","Internal controls","Customer instruction and account fields","PSP checks account, mandate or customer authority and applicable scheme conditions."),
 step("Send interbank transfer","Debtor PSP","Selected CSM (for example STEP2)","pacs.008 (illustrative interbank message)","The CSM processes the interbank instruction according to its own design."),
 step("Receive and credit","CSM / creditor PSP","Beneficiary account","Interbank processing and posting evidence","The creditor PSP handles the received instruction; processing evidence is distinct from credit."),
 step("Reconcile and report","Creditor / debtor PSP","Customers / operations","pacs.002 or customer status/account reports as applicable","Relevant participants reconcile final processing and customer notifications.")
 ],[
 fault("success","Illustrative completed journey",4,"SIMULATED","All fictional stages reached; not an EPC scheme or settlement confirmation.","Synthetic processing receipt","Verify real PSP confirmation and account posting for actual payments.","Compare customer and interbank statuses without making up finality."),
 fault("iban-reject","Invalid beneficiary account",1,"RJCT","Basic IBAN/check-digit training failure stops submission.","Synthetic input validation finding","Obtain corrected account details through authorised channels.","Explain the deterministic IBAN check and its limits."),
 fault("post-clearing-return","Payment returned after processing",4,"SIMULATED","Fictional return after prior interbank processing, not a pre-submission rejection.","Illustrative pacs.004 return reference","Investigate original transaction and return reason; reconcile funds.","Distinguish return evidence from a rejected instruction."),
 fault("recall","Recall requested",4,"PENDING","A recall is requested; there is no assumed agreement or recovery.","Illustrative camt.056 request","Track response and recovery; do not treat request as success.","Draft a cautious recall summary without promising recovery.")
 ],["What distinguishes a return from a rejection?",["A return follows earlier processing; a rejection declines processing","They always occur at the same stage","A return is always a sanctions alert"],0,"Return and rejection reflect different processing histories."]),
 define("sct-inst","SEPA Instant Credit Transfer (SCT Inst)",
 "An EPC instant euro credit transfer scheme, with distinct settlement infrastructure routes such as RT1 or TIPS.",
 "The scheme sets requirements; RT1 and TIPS are different systems. A missing reply is not proof the transfer failed.",
 [
 step("Request instant euro transfer","Payer","Debtor PSP","Instant customer instruction","Customer requests an instant transfer."),
 step("Validate and route","Debtor PSP","Selected instant route","Instruction and eligibility checks","Sending PSP checks the request and routes to an applicable available destination."),
 step("Process instant instruction","Debtor PSP / selected route","Creditor PSP","pacs.008 through RT1 OR TIPS, as applicable","This fictional trace uses one route; RT1 and TIPS are not one combined mandatory hop."),
 step("Return processing outcome","Creditor PSP / infrastructure","Debtor PSP","pacs.002-type interbank outcome where applicable","An explicit response must be distinguished from a timer expiring."),
 step("Notify and reconcile","Debtor PSP","Payer / operations","Customer confirmation and reconciliation events","Customer-facing notifications reflect verified processing information.")
 ],[
 fault("success","Illustrative instant journey",4,"SIMULATED","Fictional instant success without a live SCT Inst confirmation.","Synthetic positive outcome","Verify receiving-PSP evidence for real transactions.","Explain scheme and route; do not conflate RT1 and TIPS."),
 fault("reject","Beneficiary PSP rejects",3,"RJCT","Fictional explicit negative response from receiving PSP.","Illustrative negative pacs.002-type result","Use authorised rejection reasons and customer communication.","Explain why a rejection differs from a missing reply."),
 fault("timeout","Unknown outcome / response timeout",3,"UNKNOWN","No final evidence arrives in this fictional scenario.","Missing processing response","Reconcile before resubmission to avoid duplicate risk.","Highlight missing evidence and forbid an invented success or failure."),
 fault("duplicate-risk","Duplicate-risk review",2,"PENDING","A similar prior reference is identified before continuing.","Synthetic duplicate candidate","Check unique identifiers and real processing history before retry.","Surface matching references without automatically blocking real funds.")
 ],["What should a PSP do when instant processing outcome is unknown?",["Resend immediately","Reconcile authoritative processing evidence first","Treat as settled"],1,"An unknown outcome requires reconciliation; an automatic retry can increase duplicate risk."]),
 define("chaps","CHAPS / Bank of England RTGS",
 "High-value sterling payments under the CHAPS payment system, with gross settlement in the Bank of England RTGS service.",
 "CHAPS is a payment system. The Bank of England RTGS service settles individual obligations; a message submission is not settlement.",
 [
 step("Receive high-value instruction","Customer","Sending CHAPS participant","Customer instruction","A sending institution receives a payment request."),
 step("Bank checks and approves","Sending participant","Payment control systems","Instruction details / control outcomes","Bank performs its own validation and controls."),
 step("Submit CHAPS instruction","Sending participant","CHAPS processing","ISO 20022 pacs.008 / pacs.009 as applicable","CHAPS instruction is sent under applicable participation and message arrangements."),
 step("Settle at Bank of England","CHAPS / sending participant","BoE RTGS / receiving participant","RTGS settlement event","Each CHAPS obligation is gross settled; sufficient liquidity matters."),
 step("Receive and reconcile","Receiving participant","Beneficiary bank / customer","Settlement and posting information","Settlement between participants is distinct from final customer account communication.")
 ],[
 fault("success","Illustrative gross settlement",4,"SIMULATED","Fictional completion label; no central-bank settlement occurred.","Synthetic RTGS teaching event","Look for actual RTGS evidence before asserting settlement.","Explain finality boundaries and controls."),
 fault("liquidity-hold","Liquidity queue / hold",3,"PENDING","Gross settlement cannot yet be shown due to a hypothetical funding shortfall.","Fictional liquidity warning","Review available liquidity and authorised RTGS queue management.","Summarise liquidity issue; never release or reorder real payments."),
 fault("rejected","Participant rejection",2,"RJCT","A fictional participant rejects before gross settlement.","Synthetic CHAPS negative processing event","Read authorised rejection detail and correct at source.","Explain rejection versus RTGS settlement failure."),
 fault("unknown","Unconfirmed settlement",3,"UNKNOWN","RTGS outcome information is missing in this training trace.","No independently verified RTGS receipt","Contact authorised settlement operations before treating as final.","Flag unconfirmed settlement without a confident-sounding answer.")
 ],["Where are CHAPS interbank obligations settled?",["Swift gpi Tracker","Bank of England RTGS","Bacs Direct Debit"],1,"The Bank of England RTGS service settles CHAPS gross payment obligations."]),
 define("fps","Faster Payments (FPS)",
 "A UK retail payment system used for near-real-time sterling transfers.",
 "Customer-facing payment processing and interbank settlement are related but distinct; this is not CHAPS.",
 [
 step("Payer requests transfer","Retail customer","Sending PSP","Retail payment instruction","Customer provides payee and amount."),
 step("Check and authorise","Sending PSP","Bank controls","Authentication / recipient and policy checks","Checks may include account conditions and payee-name warning services."),
 step("Exchange retail instruction","Sending PSP","FPS / receiving PSP","Faster Payments scheme messages (conceptual)","The payment is routed using FPS-specific interfaces, not an invented pacs.008."),
 step("Receive and respond","Receiving PSP","FPS / sending PSP","Scheme status or response (conceptual)","Receiving PSP responds according to scheme processing."),
 step("Notify and reconcile","Sending / receiving PSP","Customers and settlement operations","Customer notifications and distinct settlement records","Do not equate immediate customer notification with gross RTGS settlement.")
 ],[
 fault("success","Illustrative customer payment",4,"SIMULATED","Fictional near-real-time credit, not a participant acknowledgement.","Synthetic receiving-PSP result","Reconcile any actual payment with the PSP's authoritative status.","Explain fast user experience versus underlying settlement."),
 fault("receiving-down","Receiving PSP unavailable",3,"RJCT","An explicit fictional negative response is shown.","Synthetic receiving-bank rejection","Explain reason to customer and follow authorised retry policy.","Explain failure without claiming all FPS outages have the same outcome."),
 fault("response-lost","Missing response / uncertain outcome",3,"UNKNOWN","Response is missing; success or rejection cannot be inferred.","Missing synthetic scheme response","Reconcile before submitting again.","Flag duplicate risk when certainty is absent."),
 fault("duplicate","Potential duplicate submission",2,"PENDING","A repeated synthetic reference requires review.","Illustrative repeated-payment candidate","Check identifiers and payment history with authorised tools.","Identify likely duplicates but do not perform irreversible actions.")
 ],["Is an instant customer notification the same as gross central-bank settlement?",["Yes, always","No; retail processing and interbank settlement differ","Only for Swift payments"],1,"FPS retail processing must not be conflated with CHAPS-style gross settlement."]),
 define("bacs-debit","Bacs Direct Debit / Direct Credit",
 "Illustrative UK multi-day batch processes. This walkthrough focuses on Direct Debit collection; Direct Credit is a separate Bacs flow.",
 "Bacs is not an instant payment rail. Direct Debit requires mandate-related controls; Direct Credit has different authority and reports.",
 [
 step("Prepare collection","Originator","Sponsoring bank / bureau","Mandate-linked collection instruction","A Direct Debit originator prepares a collection based on authority."),
 step("Submit batch file","Originator / bureau","Bacs submission service","Bacs Standard 18-style file (conceptual)","Submission follows Bacs schedules and validation requirements."),
 step("Process Bacs cycle","Bacs / participant banks","Paying bank","Batch processing reports","Illustrative multi-day processing; calendar and timings depend on service rules."),
 step("Apply debit / settlement","Paying bank / settlement participants","Originator / customer accounts","Debit and settlement events (conceptual)","Processing, net settlement and account posting are separate concepts."),
 step("Handle returns and reports","Banks / Bacs","Originator / payer","Unpaid / return or indemnity reports (conceptual)","Reports and possible claims require the proper Direct Debit workflows.")
 ],[
 fault("success","Illustrative collection cycle",4,"SIMULATED","Synthetic batch collection progression, not a live Bacs collection.","Fictional batch and account report","Reconcile actual payer and originator records.","Explain multi-day cycle and contrasting Direct Credit flow."),
 fault("mandate","Mandate missing / disputed",0,"RJCT","Mandate reference is missing in this fictional collection.","Synthetic mandate check","Validate authorised mandate records; never invent payer authority.","Explain why a language model cannot supply missing authorisation."),
 fault("file-reject","File rejected at submission",1,"RJCT","Bacs submission is rejected in the toy processing cycle.","Fictional input report","Correct source file and resubmit only under authorised timing rules.","Distinguish file rejection from an unpaid Direct Debit."),
 fault("unpaid","Collection returned unpaid",4,"SIMULATED","A fictional unpaid collection report arrives after processing.","Synthetic unpaid item reference","Follow appropriate return and customer-contact procedure.","Separate unpaid return, mandate dispute and indemnity scenarios.")
 ],["What distinguishes Bacs Direct Debit from Bacs Direct Credit?",["They are identical","Direct Debit is a mandate-based collection; Direct Credit is a credit submission","Both are CHAPS RTGS"],1,"Both are Bacs services with different direction, authorisation and exception processes."])
]);
export const JOURNEY_IDS=Object.freeze(JOURNEYS.map(j=>j.id));
export const getJourney=id=>{const journey=JOURNEYS.find(x=>x.id===id);if(!journey)throw Error("Unsupported guided payment journey");return journey;};
/** Curated conceptual relationships only; not a routing directory or proof of participation. */
const links=[
 ["cbpr","gpi","Tracking overlay","UETR can support cross-border status visibility; gpi does not settle funds."],
 ["cbpr","g4c","Corporate overlay","Corporate tracking can expose selected bank payment statuses."],
 ["cbpr","swift-fin","Messaging evolution","Legacy FIN and CBPR+ are different message environments, not simultaneous mandatory hops."],
 ["cbpr","swift-go","Cross-border service","Swift Go uses payment messaging and service-level arrangements."],
 ["swift-fileact","bacs-credit","File-transport comparison","FileAct and Bacs submission are different networks/processes, not an asserted direct connection."],
 ["chaps","boe-rtgs","Gross settlement","CHAPS settles sterling participant obligations in the Bank of England RTGS service."],
 ["fps","boe-rtgs","Settlement relationship","Retail interbank settlement arrangements are separate from customer-level FPS processing."],
 ["bacs-credit","boe-rtgs","Settlement relationship","Net interbank settlement differs from individual Bacs file acceptance."],
 ["bacs-debit","boe-rtgs","Settlement relationship","Net interbank settlement differs from a Direct Debit collection outcome."],
 ["bacs-credit","bacs-debit","Related Bacs products","Direct Credit and Direct Debit are different workflows on the Bacs system."],
 ["cop","fps","Optional payee check","Confirmation of Payee is a separate name-check overlay, not payment settlement."],
 ["ics","boe-rtgs","Clearing / settlement distinction","Cheque-image clearing and interbank settlement are separate."],
 ["pexa","chaps","Property use case","Time-critical sterling property payments can rely on settlement-oriented bank services; no integration asserted."],
 ["sct","step2","Illustrative CSM route","STEP2 is one possible SCT clearing and settlement mechanism."],
 ["sct-inst","rt1","Instant infrastructure option","RT1 is an example infrastructure route for instant euro payments."],
 ["sct-inst","tips","Instant infrastructure option","TIPS is a distinct central-bank settlement route; not a mandatory second RT1 hop."],
 ["sct","vop","Payee verification overlay","Verification of Payee is separate from executing a credit transfer."],
 ["sct-inst","vop","Payee verification overlay","VoP supports payee checks; its response is not instant settlement."],
 ["srtp","sct","Related request flow","Request-to-Pay is not execution; a payer may choose a separate credit transfer."],
 ["sdd-core","step2-sdd","Illustrative SDD CSM","STEP2 SDD can process Direct Debit interbank instructions."],
 ["sdd-b2b","step2-sdd","Illustrative SDD CSM","B2B scheme rights and checks differ from SDD Core."],
 ["oct-inst","sct-inst","Distinct euro transfer schemes","One-leg-out instant and SCT Inst have distinct rules; not the same scheme."],
 ["t2","tips","Distinct Eurosystem services","Large-value T2 RTGS and TIPS instant settlement are different services."],
 ["t2s","t2","Eurosystem cash services","Securities-versus-cash and RTGS are distinct infrastructure functions."],
 ["euro1","t2","Distinct large-value services","EURO1 and T2 are different euro large-value arrangements."],
 ["de-sepa-clearer","sct","SEPA processing","German SEPA-Clearer supports relevant SEPA clearing, not a new EPC scheme."],
 ["fr-stet","sct","SEPA processing context","French processing can support SCT instructions; check current service eligibility."],
 ["es-snce","sct","SEPA processing context","Spanish retail clearing is distinct from EPC scheme rules."],
 ["it-bicomp","sct","SEPA processing context","Italian clearing context and EPC SCT rules are separate layers."],
 ["nl-csm","sct","SEPA processing context","Dutch processing context and EPC scheme are different layers."],
 ["lt-centrolink","sct","SEPA service context","CENTROlink provides services for participating payment providers."],
 ["se-swish","se-rix-inst","Swedish instant ecosystem","Swish user experience and RIX-INST settlement services are not interchangeable."],
 ["se-rix-inst","se-rix-rtgs","Distinct RIX services","Swedish instant and gross settlement services have different operating roles."],
 ["pl-express-elixir","pl-elixir","Distinct Polish systems","Instant Express Elixir and regular Elixir are different KIR clearing arrangements."],
 ["dk-retail-clearing","dk-tips","Distinct Danish services","Domestic retail processing and TIPS instant settlement must be distinguished."],
 ["cls","cbpr","Different cross-border layers","CLS FX PvP is not CBPR+ messaging, though banking participants may use multiple services."],
 ["link","fps","UK retail comparison","ATM cash access and Faster Payments are distinct UK payment arrangements."]
];
export const CONNECTIONS=Object.freeze(links.map(([from,to,kind,detail])=>{
 getRail(from);getRail(to);return Object.freeze({from,to,kind,detail});
}));
export function connectionsFor(id){
 getRail(id);
 return CONNECTIONS.filter(x=>x.from===id||x.to===id).map(x=>({
  ...x,related:getRail(x.from===id?x.to:x.from),
  direction:x.from===id?"outgoing":"incoming"
 }));
}
export function simulate(id,scenarioId="success"){
 const journey=getJourney(id);
 const scenario=journey.scenarios.find(x=>x.id===scenarioId);
 if(!scenario)throw Error("Unsupported fictional journey scenario");
 const fixture=generateFixture(id,"baseline");
 const status=scenario.status;
 fixture.scenario="baseline";
 fixture.status=status;
 if(id==="sct"&&scenarioId==="iban-reject")fixture.creditor.account="FR1420041010050500013M02607";
 if(id==="bacs-debit"&&scenarioId==="mandate")fixture.mandateReference=null;
 if(id==="cbpr"&&scenarioId==="address-review")fixture.creditor.address.town="";
 fixture.timeline=journey.stages.slice(0,scenario.at+1).map((stage,i)=>({
  type:"STAGE_"+(i+1),source:"synthetic-"+id,
  uetr:fixture.uetr||null,evidenceRef:"EDU-"+id.toUpperCase()+"-"+(i+1),
  note:stage.sender+" → "+stage.receiver+"; "+stage.message+". "+stage.meaning
 }));
 fixture.timeline.push({
  type:status,source:"synthetic-"+id,uetr:fixture.uetr||null,
  evidenceRef:"EDU-"+id.toUpperCase()+"-OUTCOME",
  note:scenario.what+" Evidence: "+scenario.evidence+". Not an attested bank or infrastructure status."
 });
 const report=validateFixture(fixture);
 report.nextAction=scenario.next;
 return {
  synthetic:true,educationalOnly:true,journeyId:id,scenarioId,
  journey,scenario,fixture,report,
  stages:journey.stages.map((stage,i)=>({...stage,index:i,
   reachable:i<=scenario.at,completed:i<scenario.at,
   outcomeAt:i===scenario.at})),
  evidence:report.evidence,
  status:status,disclaimer:"Fictional payment training data. No funds, networks, official rule validation, tracking, settlement or live LLM."
 };
}
export function aiReplay(simulation){
 if(!simulation?.synthetic||!simulation?.scenario||!simulation?.report)throw Error("Synthetic simulation required");
 const s=simulation.scenario;
 return {
  liveModel:false,backendCalled:false,automatedPaymentAction:false,
  deterministic:"The training rule engine found "+simulation.report.issues.length+" basic-rule finding(s). Final fictional outcome: "+s.status+".",
  evidence:s.evidence+"; evidence reference "+simulation.evidence.at(-1)?.evidenceRef,
  hypotheticalLLM:"An evidence-grounded assistant could: "+s.ai,
  humanReview:s.next,
  boundary:"This is a deterministic SCRIPTED AI-workflow replay, not Gemini/LLM output, sanctions screening, settlement confirmation or a real recommendation."
 };
}
export function gradeQuiz(journeyId,answerIndex){
 const [question,options,correct,why]=getJourney(journeyId).quiz;
 if(!Number.isInteger(answerIndex)||answerIndex<0||answerIndex>=options.length)throw Error("Invalid quiz answer");
 return {question,correct:answerIndex===correct,explanation:why};
}
export const ALL_CONTEXTS=RAILS;
