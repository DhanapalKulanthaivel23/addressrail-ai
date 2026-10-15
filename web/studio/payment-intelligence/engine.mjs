/**
 * Cross-rail educational rule engine.
 * No official XSD/MIG validation, API calls, network settlement, sanction checks,
 * or assertion of bank-certified message conformance. All inputs must be synthetic.
 */
import {getRail,currencyOptionsForRail,defaultCurrencyForRail,TEACHING_CURRENCIES} from "./catalog.mjs";

export const SCENARIOS=Object.freeze([
 {id:"baseline",label:"Illustrative baseline / no injected fault"},
 {id:"missing-town",label:"Missing structured town; evidence-based repair option"},
 {id:"invalid-iban",label:"Invalid illustrative IBAN check digits"},
 {id:"invalid-bic",label:"Malformed illustrative BIC"},
 {id:"missing-uetr",label:"Missing SWIFT-style UETR correlation"},
 {id:"timeout",label:"Missing outcome / delayed response"},
 {id:"liquidity",label:"Hypothetical liquidity hold"},
 {id:"mandate",label:"Missing synthetic debit mandate"},
 {id:"conflict",label:"Stored status disagrees with final event"}
]);
export const UETR="b2901e72-79a4-46c0-87dc-ead971e0a005";
const ORIGINAL_IBAN="DE89370400440532013000";
const BENEFICIARY_IBAN="FR1420041010050500013M02606";
const REQUIRES_UETR=new Set(["cbpr","gpi","g4c","swift-fin","swift-go"]);
const HIGH_VALUE=new Set(["chaps","boe-rtgs","t2","euro1","cls"]);
const DIRECT_DEBIT=new Set(["sdd-core","sdd-b2b","bacs-debit","step2-sdd"]);
const NO_PAYMENT=new Set(["vop","srtp","cop","swift-fileact","t2s"]);
const REQUIRES_ISO_DETAILS = new Set([
 "cbpr","chaps","boe-rtgs","sct","sct-inst","sdd-core","sdd-b2b",
 "oct-inst","step2","step2-sdd","rt1","tips","t2","euro1"
]);
export function isIban(value){
 const raw=String(value??"").replace(/\s+/g,"").toUpperCase();
 if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(raw))return false;
 const rotated=raw.slice(4)+raw.slice(0,4);
 let modulus=0;
 for(const char of rotated){
  const digits=(char>="A"&&char<="Z")?String(char.charCodeAt(0)-55):char;
  for(const digit of digits)modulus=(modulus*10+Number(digit))%97;
 }
 return modulus===1;
}
export const isBic=value=>/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(String(value??"").trim().toUpperCase());
export const isUetr=value=>/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value??""));
export const safeText=value=>String(value??"").replace(/[\u0000-\u001f\u007f]/g," ").trim();
export const escapeXml=value=>safeText(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");

function isoMessageFor(rail){
 const id=rail.id;
 if(DIRECT_DEBIT.has(id))return id.startsWith("sdd")?"pain.008":"pacs.003";
 if(["t2","euro1","boe-rtgs"].includes(id))return "pacs.009 CORE";
 if(["cop","vop"].includes(id))return "payee-check response (concept only)";
 if(id==="swift-fin")return "MT103 (legacy example)";
 if(id==="gpi")return "UETR tracker response (concept only)";
 if(id==="g4c")return "g4C Pay and Trace response (concept only)";
 if(id==="swift-go")return "cross-border status (concept only)";
 if(id==="swift-fileact")return "file transport acknowledgement (concept only)";
 if(id==="srtp")return "request-to-pay (concept only)";
 if(["bacs-credit","bacs-debit"].includes(id))return "Bacs Standard 18 (concept only)";
 if(id==="fps")return "UK FPS payment event (concept only)";
 if(id==="ics")return "cheque image clearing event (concept only)";
 if(id==="link")return "ATM transaction event (concept only)";
 if(id==="t2s")return "securities delivery-versus-payment event (concept only)";
 if(id==="cls")return "FX payment-versus-payment event (concept only)";
 if(["chaps","cbpr","sct","sct-inst","oct-inst","step2","rt1","tips"].includes(id))return "pacs.008";
 return "payments service event (concept only)";
}
function syntheticTimeline(rail,scenario,status,uetr){
 const id=rail.id.toUpperCase().replace(/-/g,"");
 const path=[
  ["INITIATED","Synthetic instruction or service event created; not transmitted to participants."],
  ["CHECKS","Illustrative metadata checks; no sanctions or real scheme validation."],
  ["ROUTED","Teaching route for "+rail.name+" only; no external infrastructure connection."],
  [status,status==="UNKNOWN"?
     "Missing fictional outcome. Must be reconciled; not rejected or settled.":
    status==="PENDING"?
     "Fictional processing or liquidity hold. No settlement evidence.":
    status==="RJCT"?"Fictional negative outcome only.":
     "Fictional completion label ONLY; not an attested bank or scheme response."]
 ];
 return path.map(([type,note],i)=>({
  type,note,source:"synthetic-"+id.toLowerCase(),
  uetr:uetr||null,evidenceRef:"EDU-"+id+"-E"+(i+1)
 }));
}
export function generateFixture(railId,scenarioId="baseline"){
 const rail=getRail(railId);
 if(!SCENARIOS.some(x=>x.id===scenarioId))throw Error("Unknown fictional scenario");
 const isDebit=DIRECT_DEBIT.has(rail.id), isNoPayment=NO_PAYMENT.has(rail.id);
 const currency=defaultCurrencyForRail(rail.id);
 const amount=isNoPayment?"0.00":HIGH_VALUE.has(rail.id)?"250000.00":"125.00";
 const status=scenarioId==="timeout"||scenarioId==="missing-uetr"?"UNKNOWN":
  scenarioId==="liquidity"?"PENDING":
  scenarioId==="invalid-bic"||scenarioId==="invalid-iban"||scenarioId==="mandate"?"RJCT":
  isNoPayment?"SIMULATED":"SIMULATED";
 const uetr=REQUIRES_UETR.has(rail.id)?UETR:"";
 const message={
  synthetic:true,educationalOnly:true,
  railId:rail.id,railName:rail.name,kind:rail.kind,format:rail.format,
  messageType:isoMessageFor(rail),scenario:scenarioId,
  reference:"EDU-"+rail.id.toUpperCase()+"-001",uetr,
  currency,amount,status,
  debtor:{name:"SYNTHETIC PAYER LTD",account:ORIGINAL_IBAN,bic:"AAAAGB2LXXX",
   address:{street:"1 Example Road",town:"London",country:"GB",
    unstructured:"1 Example Road, London, GB"}},
  creditor:{name:"SYNTHETIC RECEIVER LTD",account:BENEFICIARY_IBAN,bic:"BBBBDEFFXXX",
   address:{street:"2 Demo Street",town:"Paris",country:"FR",
    unstructured:"2 Demo Street, Paris, FR"}},
  mandateReference:isDebit?"EDU-MANDATE-001":null,
  timeline:syntheticTimeline(rail,scenarioId,status,uetr)
 };
 switch(scenarioId){
  case "missing-town":message.creditor.address.town="";break;
  case "invalid-iban":message.creditor.account="FR1420041010050500013M02607";break;
  case "invalid-bic":message.creditor.bic="INVALID-BIC";break;
  case "missing-uetr":message.uetr="";message.timeline.forEach(e=>e.uetr=null);break;
  case "mandate":message.mandateReference=null;break;
  case "conflict":message.status="RJCT";break; // last event remains SIMULATED
 }
 return message;
}
const addIssue=(issues,code,severity,path,explanation,recommendation,reference)=>issues.push({
 code,severity,path,explanation,recommendation,
 evidenceRef:reference||"EDU-LOCAL-CHECK"
});
const isNonEmpty=value=>typeof value==="string"&&value.trim().length>0;
const addressEvidence=addr=>{
 if(!addr || typeof addr.unstructured!=="string")return null;
 // Deliberately conservative: exactly three comma-separated fields.
 const parts=addr.unstructured.split(",").map(v=>v.trim());
 if(parts.length!==3)return null;
 const [street,town,country]=parts;
 if(!street || !/^[A-Za-z][A-Za-z .'-]{1,60}$/.test(town) ||
    !/^[A-Z]{2}$/.test(country))return null;
 return {street,town,country};
};
export function validateFixture(message){
 if(!message || typeof message!=="object"||Array.isArray(message)||
    message.synthetic!==true||message.educationalOnly!==true)
    throw Error("Only explicitly synthetic teaching data is accepted.");
 const rail=getRail(message.railId);
 const encoded=JSON.stringify(message);
 if(encoded.length>18000)throw Error("Synthetic example exceeds the local 18 KB limit.");
 const issues=[],proposals=[];
 const requiresIdentity=REQUIRES_ISO_DETAILS.has(rail.id)||rail.id==="swift-fin";
 const requiresUetr=REQUIRES_UETR.has(rail.id);
 const requiresIban=REQUIRES_ISO_DETAILS.has(rail.id);
 const selectedFault=String(message.scenario||"baseline");
 const applicability={
  "invalid-iban":requiresIban,
  "invalid-bic":requiresIdentity,
  "missing-uetr":requiresUetr,
  "missing-town":requiresIdentity,
  "mandate":DIRECT_DEBIT.has(rail.id)
 };
 if(Object.hasOwn(applicability,selectedFault)&&!applicability[selectedFault]){
  addIssue(issues,"DEMO_SCENARIO_NOT_APPLICABLE","NOTICE","scenario",
   "This injected fault is not a modeled validation rule for the selected service.",
   "Choose an applicable payment context or a different teaching exception.");
 }
 if(!isNonEmpty(message.messageType)||!isNonEmpty(message.reference))
  addIssue(issues,"DEMO_MISSING_REFERENCE","ERROR","reference",
    "Illustrative message metadata is incomplete.","Add a synthetic teaching reference.");
 const allowedCurrencies=currencyOptionsForRail(rail.id);
 if(!TEACHING_CURRENCIES.includes(message.currency) ||
    !allowedCurrencies.includes(message.currency))
  addIssue(issues,"DEMO_CURRENCY","ERROR","currency",
    "Currency does not match this teaching example's selected payment context.",
    "Choose an allowed illustrative currency for this service. No FX conversion or settlement is performed.");
 if(!/^(?:0|[1-9]\d{0,9})\.\d{2}$/.test(String(message.amount??"")) ||
    (!NO_PAYMENT.has(rail.id)&&Number(message.amount)<=0))
  addIssue(issues,"DEMO_AMOUNT","ERROR","amount",
    "Synthetic amount is missing or not a permitted nonnegative two-decimal value.",
    "Use a fictional amount with two decimal digits.");
 if(requiresUetr&&!isUetr(message.uetr))
  addIssue(issues,"DEMO_UETR","ERROR","uetr",
    "SWIFT-style UETR is missing or malformed in this tracking demonstration.",
    "Populate an illustrative version-4 UETR. This does not query a real tracker.");
 if(requiresIdentity){
  for(const side of ["debtor","creditor"]){
   const party=message[side];
   if(!party||!isNonEmpty(party.name))
    addIssue(issues,"DEMO_MISSING_PARTY","ERROR",side+".name",
      "Synthetic party name is missing.","Use a fictional party name.");
   if(!isBic(party?.bic))
    addIssue(issues,"DEMO_BIC_FORMAT","ERROR",side+".bic",
      "Basic BIC syntax appears invalid.","Review the fictional 8/11-character BIC; no live BIC lookup.");
   if(requiresIban&&!isIban(party?.account))
    addIssue(issues,"DEMO_IBAN_CHECK","ERROR",side+".account",
      "IBAN basic format/check-digit verification failed.",
      "Request account details from an authorised source; never fabricate digits.");
   const addr=party?.address;
   if(!addr||!isNonEmpty(addr.town)||!isNonEmpty(addr.country)){
    addIssue(issues,"DEMO_ADDRESS_STRUCTURE","WARNING",side+".address",
      "Structured town or country is absent in this training example.",
      "Check original evidence and current applicable scheme address guidelines before changing fields.");
    if(addr && !isNonEmpty(addr.town)){
     const candidate=addressEvidence(addr);
     if(candidate && candidate.country===addr.country &&
        (!addr.street||candidate.street.toLowerCase()===addr.street.toLowerCase())){
      proposals.push({path:side+".address.town",before:"",
       proposed:candidate.town,evidence:addr.unstructured,
       explanation:"Town is explicitly present in the three-part original demo address. Human review required.",
       requiresHumanReview:true});
     }
    }
   } else if(!/^[A-Z]{2}$/.test(addr.country)){
    addIssue(issues,"DEMO_COUNTRY_FORMAT","WARNING",side+".address.country",
      "Country should be an illustrative two-letter ISO country code.",
      "Verify the country code independently.");
   }
  }
 }
 if(DIRECT_DEBIT.has(rail.id)&&!isNonEmpty(message.mandateReference))
  addIssue(issues,"DEMO_MANDATE","ERROR","mandateReference",
    "Illustrative debit mandate reference is missing.",
    "Investigate the mandate source; never invent debtor authorisation.");
 const events=Array.isArray(message.timeline)?message.timeline:[];
 if(!events.length||events.length>30||events.some(e=>!e||!isNonEmpty(e.evidenceRef)||!isNonEmpty(e.type)))
  addIssue(issues,"DEMO_TIMELINE","ERROR","timeline",
    "Missing or incomplete synthetic evidence history.",
    "Add fictional events with nonempty evidence references.");
 else if(events.at(-1).type!==message.status)
  addIssue(issues,"DEMO_STATUS_CONFLICT","ERROR","status",
    "The recorded status differs from the final synthetic event.",
    "Reconcile contradictory evidence; do not override the final state.");
 if(message.status==="UNKNOWN")
  addIssue(issues,"DEMO_UNKNOWN_OUTCOME","NOTICE","status",
    "The final simulated outcome is UNKNOWN; no settlement or rejection can be inferred.",
    "Request authoritative confirmation before retrying or taking action.");
 if(message.status==="PENDING")
  addIssue(issues,"DEMO_PENDING_OUTCOME","NOTICE","status",
    "The hypothetical payment is pending; this is not confirmation of gross settlement.",
    "Check source status and available liquidity with authorised channels.");
 if(NO_PAYMENT.has(rail.id))
  addIssue(issues,"DEMO_NOT_PAYMENT_SCHEME","NOTICE","railId",
    "This selection is an overlay, file exchange or securities context—not a stand-alone credit transfer.",
    "Identify the underlying payment scheme before asserting any execution outcome.");
 const status=issues.some(i=>i.severity==="ERROR")?"TRAINING_EXCEPTION":
              issues.some(i=>i.severity==="WARNING")?"TRAINING_REVIEW":
              "ILLUSTRATIVE_ONLY";
 return {
  synthetic:true,educationalOnly:true,
  rail:{id:rail.id,name:rail.name,kind:rail.kind,region:rail.region,
        reference:rail.reference,format:rail.format},
  messageType:message.messageType,reference:message.reference,
  uetr:isUetr(message.uetr)?message.uetr:null,
  paymentStatus:message.status,currency:message.currency,amount:message.amount,
  assessment:status,issues,proposals,
  evidence:events.slice(0,30).map(e=>({type:safeText(e.type),source:safeText(e.source),
   evidenceRef:safeText(e.evidenceRef),description:safeText(e.note),
   uetr:isUetr(e.uetr)?e.uetr:null})),
  nextAction:message.status==="UNKNOWN"?"Reconcile missing outcome with an authorised source.":
   message.status==="PENDING"?"Review the hypothetical hold before considering any further action.":
   "Human review required; demo checks are not an official message or settlement validation.",
  limitations:[
   "Synthetic data; browser-only and not transmitted.",
   "Rules are a small educational subset; no scheme XSD/MIG, CBPR+ SR, EPC, RTGS, SWIFT or network validation.",
   "No certified participant, real tracker, clearing, sanctions screening, payment execution or settlement confirmation."
  ]
 };
}
export function applyEvidenceRepair(message,proposal){
 if(!message?.synthetic||!proposal?.requiresHumanReview)
  throw Error("Explicit review-only repair proposal required.");
 if(!["debtor.address.town","creditor.address.town"].includes(proposal.path))
  throw Error("Only demonstrated town repairs are supported.");
 const side=proposal.path.split(".")[0];
 const party=message[side];
 if(!party?.address||isNonEmpty(party.address.town))
  throw Error("The town is already populated; proposal no longer applicable.");
 const candidate=addressEvidence(party.address);
 if(!candidate || candidate.town!==proposal.proposed || candidate.country!==party.address.country)
  throw Error("Original address no longer supports this proposal.");
 const next=structuredClone(message);
 next[side].address.town=candidate.town;
 return next;
}
