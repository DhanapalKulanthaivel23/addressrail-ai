// AddressRail AI: synthetic SEPA SCT teaching messages, NOT EPC-certified schemas.
// No customer data, network activity or money movement.
export const FIXTURE = Object.freeze({
  debtorName: "SYNTHETIC PAYER LTD",
  creditorName: "SYNTHETIC RECEIVER LTD",
  debtorIban: "DE89370400440532013000",
  creditorIban: "FR1420041010050500013M02606",
  debtorBic: "AAAADEFFXXX",
  creditorBic: "BBBBFRPPXXX",
  amount: "125.00",
  reference: "AR-DEMO-SCT-001"
});
export const SCENARIOS = Object.freeze(["accepted", "invalid-iban", "csm-reject"]);
const sanitize = value => String(value ?? "").trim();
export const escapeXml = value => sanitize(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
export function ibanValid(value) {
  const iban=sanitize(value).replace(/\s+/g,"").toUpperCase();
  if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  const rotated=iban.slice(4)+iban.slice(0,4);
  let mod=0;
  for(const c of rotated){
    const digits=(c>="A"&&c<="Z")?String(c.charCodeAt(0)-55):c;
    for(const digit of digits) mod=(mod*10+Number(digit))%97;
  }
  return mod===1;
}
const bicValid = value => /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(sanitize(value).toUpperCase());
const compact = value => sanitize(value).replace(/\s+/g,"").toUpperCase();
export function validateInput(input) {
  const errors=[];
  const amount=sanitize(input.amount);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount) || Number(amount)<=0 || Number(amount)>9999999999.99)
    errors.push("Enter an amount greater than zero with at most two decimals.");
  if(!ibanValid(input.debtorIban)) errors.push("Debtor IBAN failed format/check-digit validation.");
  if(!ibanValid(input.creditorIban)) errors.push("Creditor IBAN failed format/check-digit validation.");
  if(!bicValid(input.debtorBic)) errors.push("Debtor BIC failed basic format checks.");
  if(!bicValid(input.creditorBic)) errors.push("Creditor BIC failed basic format checks.");
  if(!sanitize(input.debtorName) || sanitize(input.debtorName).length>70)
    errors.push("Enter a synthetic debtor name (1–70 characters).");
  if(!sanitize(input.creditorName) || sanitize(input.creditorName).length>70)
    errors.push("Enter a synthetic creditor name (1–70 characters).");
  if(!/^[A-Za-z0-9-]{1,35}$/.test(sanitize(input.reference)))
    errors.push("Reference must contain 1–35 letters, numbers or hyphens.");
  for(const key of ["debtorName","creditorName","reference"]){
    if(/[\x00-\x08\x0B-\x1F\x7F]/.test(sanitize(input[key]))) errors.push("Unsupported control characters.");
  }
  return errors;
}
function xmlParties(p){return {
  debtorName:escapeXml(p.debtorName),creditorName:escapeXml(p.creditorName),
  debtorIban:escapeXml(compact(p.debtorIban)),creditorIban:escapeXml(compact(p.creditorIban)),
  debtorBic:escapeXml(compact(p.debtorBic)),creditorBic:escapeXml(compact(p.creditorBic)),
  amount:Number(p.amount).toFixed(2),reference:escapeXml(p.reference)
};}
export function pain001(input){
  const p=xmlParties(input);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
 <CstmrCdtTrfInitn>
  <GrpHdr><MsgId>${p.reference}-INIT</MsgId><CreDtTm>2026-10-14T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><CtrlSum>${p.amount}</CtrlSum><InitgPty><Nm>${p.debtorName}</Nm></InitgPty></GrpHdr>
  <PmtInf><PmtInfId>${p.reference}-PMT</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>1</NbOfTxs><CtrlSum>${p.amount}</CtrlSum>
   <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
   <ReqdExctnDt><Dt>2026-10-14</Dt></ReqdExctnDt>
   <Dbtr><Nm>${p.debtorName}</Nm></Dbtr><DbtrAcct><Id><IBAN>${p.debtorIban}</IBAN></Id></DbtrAcct><DbtrAgt><FinInstnId><BICFI>${p.debtorBic}</BICFI></FinInstnId></DbtrAgt>
   <CdtTrfTxInf><PmtId><EndToEndId>${p.reference}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${p.amount}</InstdAmt></Amt>
    <CdtrAgt><FinInstnId><BICFI>${p.creditorBic}</BICFI></FinInstnId></CdtrAgt><Cdtr><Nm>${p.creditorName}</Nm></Cdtr>
    <CdtrAcct><Id><IBAN>${p.creditorIban}</IBAN></Id></CdtrAcct><ChrgBr>SLEV</ChrgBr>
   </CdtTrfTxInf>
  </PmtInf>
 </CstmrCdtTrfInitn>
</Document>`;
}
export function pacs008(input){
 const p=xmlParties(input);
 return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
 <FIToFICstmrCdtTrf><GrpHdr><MsgId>${p.reference}-INTERBANK</MsgId><CreDtTm>2026-10-14T09:01:00Z</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr>
 <CdtTrfTxInf><PmtId><InstrId>${p.reference}-INSTR</InstrId><EndToEndId>${p.reference}</EndToEndId><TxId>${p.reference}-TX</TxId></PmtId>
 <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf>
 <IntrBkSttlmAmt Ccy="EUR">${p.amount}</IntrBkSttlmAmt><IntrBkSttlmDt>2026-10-14</IntrBkSttlmDt><ChrgBr>SLEV</ChrgBr>
 <Dbtr><Nm>${p.debtorName}</Nm></Dbtr><DbtrAcct><Id><IBAN>${p.debtorIban}</IBAN></Id></DbtrAcct>
 <DbtrAgt><FinInstnId><BICFI>${p.debtorBic}</BICFI></FinInstnId></DbtrAgt>
 <CdtrAgt><FinInstnId><BICFI>${p.creditorBic}</BICFI></FinInstnId></CdtrAgt>
 <Cdtr><Nm>${p.creditorName}</Nm></Cdtr><CdtrAcct><Id><IBAN>${p.creditorIban}</IBAN></Id></CdtrAcct>
 </CdtTrfTxInf></FIToFICstmrCdtTrf>
</Document>`;
}
export function pain002(input){
 const p=xmlParties(input);
 return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.10">
 <CstmrPmtStsRpt><GrpHdr><MsgId>${p.reference}-CUSTOMER-STATUS</MsgId><CreDtTm>2026-10-14T09:00:05Z</CreDtTm></GrpHdr>
 <OrgnlGrpInfAndSts><OrgnlMsgId>${p.reference}-INIT</OrgnlMsgId><OrgnlMsgNmId>pain.001.001.09</OrgnlMsgNmId></OrgnlGrpInfAndSts>
 <OrgnlPmtInfAndSts><OrgnlPmtInfId>${p.reference}-PMT</OrgnlPmtInfId><PmtInfSts>RJCT</PmtInfSts>
 <StsRsnInf><Rsn><Cd>AC01</Cd></Rsn><AddtlInf>Illustrative invalid creditor IBAN; local bank validation only</AddtlInf></StsRsnInf>
 </OrgnlPmtInfAndSts></CstmrPmtStsRpt>
</Document>`;
}
export function pacs002(input, code="RJCT"){
 const p=xmlParties(input);
 if(!["RJCT","ACTC"].includes(code)) throw Error("Unsupported illustrative interbank status");
 const rejected=code==="RJCT";
 return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10">
 <FIToFIPmtStsRpt><GrpHdr><MsgId>${p.reference}-INTERBANK-STATUS</MsgId><CreDtTm>2026-10-14T09:02:00Z</CreDtTm></GrpHdr>
 <OrgnlGrpInfAndSts><OrgnlMsgId>${p.reference}-INTERBANK</OrgnlMsgId><OrgnlMsgNmId>pacs.008.001.08</OrgnlMsgNmId></OrgnlGrpInfAndSts>
 <TxInfAndSts><OrgnlInstrId>${p.reference}-INSTR</OrgnlInstrId><OrgnlEndToEndId>${p.reference}</OrgnlEndToEndId><OrgnlTxId>${p.reference}-TX</OrgnlTxId>
 <TxSts>${code}</TxSts>${rejected?"<StsRsnInf><Rsn><Cd>AG01</Cd></Rsn><AddtlInf>Illustrative CSM eligibility failure (not an actual STEP2 reason assignment)</AddtlInf></StsRsnInf>":""}
 </TxInfAndSts></FIToFIPmtStsRpt>
</Document>`;
}
const event=(stage,actor,description,status)=>({stage,actor,description,status,evidenceRef:`SCT-EDU-${String(stage).padStart(2,"0")}`});
export function simulate(input,scenario="accepted"){
 if(!SCENARIOS.includes(scenario))throw Error("Unsupported scenario");
 const p={...input};
 if(scenario==="invalid-iban")p.creditorIban="FR001234INVALID";
 const errors=validateInput(p);
 // Only the deliberately injected creditor IBAN is permitted in the local-rejection exercise.
 const expectedFailure=scenario==="invalid-iban" && errors.length===1 && errors[0].startsWith("Creditor IBAN");
 if(errors.length && !expectedFailure) return {status:"INPUT_INVALID",errors,events:[event(1,"User","Synthetic input did not pass basic input checks.","INPUT_INVALID")],messages:{},settlement:"NOT_ATTEMPTED"};
 const messages={"pain.001":pain001(p)};
 const events=[event(1,"Customer / debtor PSP","Synthetic customer-to-bank pain.001 prepared.","INITIATED")];
 if(expectedFailure){
  events.push(event(2,"Debtor PSP","Synthetic creditor IBAN invalid; validation stops before interbank submission.","LOCAL_REJECTED"));
  messages["pain.002"]=pain002(p);
  return {status:"LOCAL_REJECTED",errors,events,messages,settlement:"NOT_ATTEMPTED",note:"Illustrative bank-to-customer pain.002, not an interbank pacs.002. No pacs.008 was submitted."};
 }
 events.push(event(2,"Debtor PSP","Demo format/check-digit controls passed; this is NOT scheme or sanctions certification.","BASIC_VALIDATED"));
 messages["pacs.008"]=pacs008(p);
 events.push(event(3,"Sending PSP → STEP2 (illustrative)","Synthetic interbank instruction prepared. STEP2 uses continuous gross settlement; no real CSM connection.","INTERBANK_SIMULATED"));
 if(scenario==="csm-reject"){
  events.push(event(4,"CSM illustration","Hypothetical interbank rejection before any claimed settlement.","CSM_REJECTED"));
  messages["pacs.002"]=pacs002(p,"RJCT");
  return {status:"CSM_REJECTED",errors:[],events,messages,settlement:"NOT_SETTLED",note:"Illustrative pacs.002 rejection, not a response from STEP2. The displayed reason is hypothetical."};
 }
 messages["pacs.002"]=pacs002(p,"ACTC");
 events.push(event(4,"CSM illustration","Synthetic ACTC technical validation acknowledgment. It does NOT establish settlement or beneficiary credit.","TECHNICAL_ACCEPTED"));
 events.push(event(5,"Receiving PSP / settlement education","Further processing and settlement outcomes are not observed by this static demo.","OUTCOME_UNVERIFIED"));
 return {status:"OUTCOME_UNVERIFIED",errors:[],events,messages,settlement:"UNVERIFIED",note:"ACTC indicates only illustrative technical acceptance, never confirmed settlement. STEP2 actual processing is not connected."};
}
