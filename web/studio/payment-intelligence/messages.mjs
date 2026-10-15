/**
 * Readable teaching sketches only. These are INTENTIONALLY INCOMPLETE examples
 * and must never be submitted as SWIFT, EPC, T2, RTGS or CHAPS messages.
 */
import {escapeXml,safeText,isUetr} from "./engine.mjs";
import {getRail} from "./catalog.mjs";
export const MESSAGE_FAMILIES=Object.freeze([
 {id:"auto",label:"Selected rail's teaching format"},
 {id:"pacs.008",label:"pacs.008 FI-to-FI customer credit transfer"},
 {id:"pacs.009-core",label:"pacs.009 CORE financial institution transfer"},
 {id:"pacs.009-cov",label:"pacs.009 COV cover transfer"},
 {id:"pacs.002",label:"pacs.002 interbank status report"},
 {id:"pacs.004",label:"pacs.004 payment return"},
 {id:"pain.001",label:"pain.001 customer credit transfer initiation"},
 {id:"pain.008",label:"pain.008 customer direct debit initiation"},
 {id:"pacs.003",label:"pacs.003 FI-to-FI customer direct debit"},
 {id:"camt.056",label:"camt.056 payment cancellation request"},
 {id:"camt.029",label:"camt.029 resolution of investigation"},
 {id:"camt.053",label:"camt.053 account statement"},
 {id:"camt.054",label:"camt.054 debit/credit notification"},
 {id:"mt103",label:"MT103 historical learning sample"}
]);
const definitions={
 "pacs.008":["pacs.008.001.08","FIToFICstmrCdtTrf"],
 "pacs.009-core":["pacs.009.001.08","FICdtTrf"],
 "pacs.009-cov":["pacs.009.001.08","FICdtTrf"],
 "pacs.002":["pacs.002.001.10","FIToFIPmtStsRpt"],
 "pacs.004":["pacs.004.001.09","PmtRtr"],
 "pain.001":["pain.001.001.09","CstmrCdtTrfInitn"],
 "pain.008":["pain.008.001.08","CstmrDrctDbtInitn"],
 "pacs.003":["pacs.003.001.08","FIToFICstmrDrctDbt"],
 "camt.056":["camt.056.001.08","FIToFIPmtCxlReq"],
 "camt.029":["camt.029.001.09","RsltnOfInvstgtn"],
 "camt.053":["camt.053.001.08","BkToCstmrStmt"],
 "camt.054":["camt.054.001.08","BkToCstmrDbtCdtNtfctn"]
};
const row=(tag,value)=>"<"+tag+">"+escapeXml(value)+"</"+tag+">";
const id=value=>escapeXml(value);
const pmt=message=>"<PmtId>"+
 row("InstrId",message.reference+"-I")+row("EndToEndId",message.reference)+
 (isUetr(message.uetr)?row("UETR",message.uetr):"")+"</PmtId>";
const amount=message=>'<IntrBkSttlmAmt Ccy="'+id(message.currency)+'">'+id(message.amount)+"</IntrBkSttlmAmt>";
const bic=value=>"<FinInstnId>"+row("BICFI",value)+"</FinInstnId>";
const part=(kind,party)=>"<"+kind+">"+
 row("Nm",party?.name||"SYNTHETIC UNKNOWN")+
 (party?.address?"<PstlAdr>"+
 (party.address.street?row("StrtNm",party.address.street):"")+
 (party.address.town?row("TwnNm",party.address.town):"")+
 (party.address.country?row("Ctry",party.address.country):"")+
 "</PstlAdr>":"")+"</"+kind+">";
function coreBody(message,family){
 const original=id(message.reference),sttl=amount(message);
 const agents="<DbtrAgt>"+bic(message.debtor?.bic)+"</DbtrAgt>"+
              "<CdtrAgt>"+bic(message.creditor?.bic)+"</CdtrAgt>";
 const parties=part("Dbtr",message.debtor)+part("Cdtr",message.creditor);
 const basic="<GrpHdr>"+row("MsgId",message.reference)+row("CreDtTm","2026-10-15T09:00:00Z")+
   row("NbOfTxs","1")+"</GrpHdr>";
 const transfer="<CdtTrfTxInf>"+pmt(message)+sttl+agents+parties+"</CdtTrfTxInf>";
 switch(family){
  case "pacs.008":return basic+transfer;
  case "pacs.009-core":return basic+"<CdtTrfTxInf>"+pmt(message)+sttl+
   "<Dbtr><FinInstnId>"+row("Nm","SYNTHETIC SENDING BANK")+"</FinInstnId></Dbtr>"+
   "<Cdtr><FinInstnId>"+row("Nm","SYNTHETIC RECEIVING BANK")+"</FinInstnId></Cdtr>"+
   "</CdtTrfTxInf>";
  case "pacs.009-cov":return basic+"<CdtTrfTxInf>"+pmt(message)+sttl+
    "<UndrlygCstmrCdtTrf>"+parties+"</UndrlygCstmrCdtTrf>"+
    "</CdtTrfTxInf>";
  case "pacs.002":return basic+"<OrgnlGrpInfAndSts>"+row("OrgnlMsgId",original)+
    row("OrgnlMsgNmId","pacs.008.001.08")+"</OrgnlGrpInfAndSts>"+
    "<TxInfAndSts>"+row("OrgnlEndToEndId",original)+
    row("TxSts",["RJCT","ACTC","ACSC"].includes(message.status)?message.status:"PDNG")+"</TxInfAndSts>";
  case "pacs.004":return basic+"<TxInf>"+row("OrgnlEndToEndId",original)+
    "<RtrdIntrBkSttlmAmt Ccy=\""+id(message.currency)+"\">"+id(message.amount)+
    "</RtrdIntrBkSttlmAmt></TxInf>";
  case "pain.001":return basic+"<PmtInf>"+row("PmtInfId",original)+row("PmtMtd","TRF")+
    "<CdtTrfTxInf>"+pmt(message)+parties+"</CdtTrfTxInf></PmtInf>";
  case "pain.008":return basic+"<PmtInf>"+row("PmtInfId",original)+row("PmtMtd","DD")+
    "<DrctDbtTxInf>"+pmt(message)+row("MndtId",message.mandateReference||"MISSING-SYNTHETIC-MANDATE")+
    "</DrctDbtTxInf></PmtInf>";
  case "pacs.003":return basic+"<DrctDbtTxInf>"+pmt(message)+
    row("MndtId",message.mandateReference||"MISSING-SYNTHETIC-MANDATE")+
    "</DrctDbtTxInf>";
  case "camt.056":return "<Assgnmt>"+row("Id",original+"-CXL")+"</Assgnmt>"+
    "<Undrlyg>"+row("OrgnlEndToEndId",original)+"</Undrlyg>";
  case "camt.029":return "<Assgnmt>"+row("Id",original+"-RESPONSE")+"</Assgnmt>"+
    "<Sts>"+row("Conf","PDCR")+"</Sts>";
  case "camt.053":return "<GrpHdr>"+row("MsgId",original+"-STMT")+"</GrpHdr>"+
    "<Stmt>"+row("Id",original+"-STMT")+"<Ntry>"+
    row("Amt",message.amount)+"</Ntry></Stmt>";
  case "camt.054":return "<GrpHdr>"+row("MsgId",original+"-NOTIFY")+"</GrpHdr>"+
    "<Ntfctn>"+row("Id",original+"-NOTIFY")+"</Ntfctn>";
  default:throw Error("Unsupported teaching message type");
 }
}
function exampleMt103(message){
 return [
 "ADDRESSRAIL AI — HISTORICAL MT103 LEARNING SKETCH, NOT A FIN MESSAGE",
 "No authentic SWIFT headers, security, syntax checks or transmission.",
 "{4:",
 ":20:"+safeText(message.reference).slice(0,16),
 ":23B:CRED",
 ":32A:261015"+safeText(message.currency)+safeText(message.amount).replace(".",","),
 ":50K:/SYNTHETIC-ACCOUNT",
 "SYNTHETIC PAYER LTD",
 ":57A:"+safeText(message.creditor?.bic),
 ":59:/SYNTHETIC-BENEFICIARY",
 "SYNTHETIC RECEIVER LTD",
 ":71A:SHA",
 "-}"
 ].join("\n");
}
export function teachingMessage(message,family="auto"){
 if(!message?.synthetic||!message.educationalOnly)throw Error("Only synthetic teaching input");
 const rail=getRail(message.railId);
 if(!MESSAGE_FAMILIES.some(x=>x.id===family))throw Error("Unknown educational message family");
 let selected=family;
 if(selected==="auto"){
  if(rail.format==="MT")selected="mt103";
  else if(rail.format==="ISO"){
    selected=String(message.messageType).includes("pacs.009")?"pacs.009-core":
             String(message.messageType).includes("pacs.003")?"pacs.003":
             String(message.messageType).includes("pain.008")?"pain.008":"pacs.008";
  }else selected="concept";
 }
 if(selected==="mt103")return exampleMt103(message);
 if(selected==="concept"){
  const tracking=["gpi","g4c","swift-go"].includes(rail.id);
  const record={
   warning:"CONCEPTUAL TRAINING RECORD ONLY. Not an official UK, SWIFT or clearing message.",
   rail:rail.name,kind:rail.kind,format:rail.format,
   reference:safeText(message.reference),status:safeText(message.status),
   currency:message.currency,amount:message.amount,
   uetr:isUetr(message.uetr)?message.uetr:null,
   limitation:"No real participant, scheme network, settlement, payee verification or API call."
  };
  if(tracking){
   record.tracker={service:rail.id==="g4c"?"gpi for Corporates":"SWIFT gpi learning",
    scenario:"fictional outbound payment trace; no real Swift API response",
    instruction_reference:safeText(message.reference),
    illustrative_transaction_status:"ACSP",
    illustrative_reason:"G000",
    label:"Tracker-style teaching data only. ACSP is not attested settlement.",
    evidence:["EDU-TRACK-E1","EDU-TRACK-E2"]};
   if(rail.id==="g4c")record.corporateVisibility={
     payAndTrace:true,inboundTrackingExample:true,
     scope:"Illustrative multi-bank treasury visibility, not a real g4C subscription or event feed."};
  }
  if(["cop","vop"].includes(rail.id))record.payeeCheck={
   result:"REVIEW_REQUIRED_IN_DEMO",verified:false,
   note:"Not a live name-match or beneficiary verification result."};
  if(rail.id==="swift-fileact")record.fileTransfer={
   acknowledgement:"EDUCATIONAL_ONLY",fileContents:"NOT_TRANSMITTED"};
  if(["bacs-credit","bacs-debit"].includes(rail.id))record.retailContext={
   processing:"Illustrative multi-day batch processing; not an official Standard 18 file."};
  if(rail.id==="fps")record.retailContext={
   processing:"Fictional near-real-time payment event; interbank net settlement not verified."};
  if(rail.id==="t2s")record.securitiesContext={
   type:"DELIVERY_VS_PAYMENT_TEACHING",cashSettlement:"NOT_VERIFIED"};
  return JSON.stringify(record,null,2);
 }
 const [namespace,root]=definitions[selected];
 const body=coreBody(message,selected);
 return [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!-- ADDRESSRAIL AI: INCOMPLETE EDUCATIONAL ISO 20022 SKETCH; NOT XSD/CBPR+/EPC/T2/CHAPS CONFORMANT. -->',
  '<Document xmlns="urn:iso:std:iso:20022:tech:xsd:'+namespace+'">',
  ' <'+root+'>'+body+'</'+root+'>',
  '</Document>'
 ].join("\n");
}
export function traceByUetr(report,query){
 const uetr=safeText(query).toLowerCase();
 if(!isUetr(uetr))return [];
 return (report?.evidence||[]).filter(e=>e.uetr?.toLowerCase()===uetr);
}
export function serializeReport(report,fixture){
 return JSON.stringify({
  title:"AddressRail AI cross-rail educational investigation report",
  generatedAt:new Date().toISOString(),
  scope:"SYNTHETIC ONLY — browser-private — NOT official validation",
  rail:report.rail,caseReference:report.reference,assessment:report.assessment,
  messageType:report.messageType,paymentStatus:report.paymentStatus,
  uetr:report.uetr,currency:report.currency,amount:report.amount,
  issues:report.issues,repairProposals:report.proposals,
  evidence:report.evidence,nextAction:report.nextAction,
  guardrails:report.limitations,
  note:"Human verification required. This report is not authentic SWIFT, EPC, CHAPS, RTGS or settlement evidence."
 },null,2);
}
