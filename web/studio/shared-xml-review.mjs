import {ibanValid} from "./sepa-sct/core.mjs";
/** Browser-only *subset* XML checks. NOT XSD, EPC, BoE, CBPR+ or security certification. */
const MAX=65536;
export function validateSyntheticXML(xml,rail,Parser=globalThis.DOMParser){
 if(!["sct","sct-inst","chaps"].includes(rail))throw Error("Unsupported payment rail");
 const issues=[];const flag=(id,path,explanation)=>issues.push({id,path,explanation});
 if(typeof xml!=="string"||xml.trim().length<10){flag("XML-EMPTY","/","Enter a fictional payment XML snippet.");return issues}
 if(xml.length>MAX){flag("XML-SIZE","/","Paste at most 64 KB of fictional XML. Large files are not accepted.");return issues}
 if(/<!\s*(DOCTYPE|ENTITY)/i.test(xml)){flag("XML-ENTITY","/","DTD/ENTITY declarations are blocked in this educational parser.");return issues}
 if(!/(SYNTHETIC|AR-DEMO|TESTDATA|FICTIONAL)/i.test(xml)){flag("XML-PRIVACY","/","No synthetic-data marker found. Do not paste actual customer or bank data.");return issues}
 if(typeof Parser!=="function"){flag("XML-ENV","/","This browser does not support XML parsing.");return issues}
 let doc;try{doc=new Parser().parseFromString(xml,"application/xml")}catch{flag("XML-PARSE","/","Could not parse XML.");return issues}
 if(doc.getElementsByTagName("parsererror").length||doc.querySelector?.("parsererror")){
  flag("XML-PARSE","/","Malformed XML. Fix tags and character escaping before running checks.");return issues
 }
 const root=doc.documentElement;
 if(!root||root.localName!=="Document"){flag("XML-ROOT","/Document","Expected a single ISO 20022 Document root element.");return issues}
 const ns=root.namespaceURI||"";
 if(!/^urn:iso:std:iso:20022:tech:xsd:(?:pain\.001|pacs\.008|pacs\.002|pacs\.009)\.001\.\d{2}$/.test(ns))
  flag("XML-NS","/Document","Namespace is not a supported ISO 20022 base message family/version for this toy check.");
 const nodes=name=>Array.from(doc.getElementsByTagNameNS("*",name));
 const path=elem=>{const items=[];for(let e=elem;e&&e.nodeType===1;e=e.parentNode)items.unshift(e.localName);return "/"+items.join("/")};
 if(!nodes("GrpHdr").length)flag("XML-HEADER","/Document","Group Header is missing in this limited teaching check.");
 if(!nodes("PmtId").length&&!nodes("MsgId").length)flag("XML-ID","/Document","No message/payment identifier found.");
 for(const item of nodes("IBAN")){
  const value=(item.textContent||"").trim();
  if(!ibanValid(value))flag("IBAN-101",path(item),"IBAN format/check digits failed the standard mod-97 check.");
 }
 for(const item of [...nodes("BICFI"),...nodes("BIC")]){
  const value=(item.textContent||"").trim().toUpperCase();
  if(!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value))
   flag("BIC-101",path(item),"Invalid basic BIC shape (8 or 11 characters).");
 }
 const amountNodes=[...nodes("InstdAmt"),...nodes("IntrBkSttlmAmt")];
 for(const item of amountNodes){
  const amt=(item.textContent||"").trim(),ccy=item.getAttribute("Ccy");
  if(!/^\d{1,12}(\.\d{1,2})?$/.test(amt)||Number(amt)<=0)flag("AMT-101",path(item),"Amount must be positive with at most two decimals.");
  if(ccy&&ccy!==(rail==="chaps"?"GBP":"EUR"))
   flag("RAIL-CCY",path(item),rail==="chaps"?"CHAPS educational sample expects GBP.":"SEPA SCT/SCT Inst educational sample expects EUR.");
 }
 if(!amountNodes.length)flag("XML-AMOUNT","/Document","No amount elements in this toy message fragment.");
 if(rail!=="chaps"&&!nodes("IBAN").length)
  flag("SEPA-IBAN","/Document","No IBAN found; payment scenario may require account fields.");
 return issues;
}
export const XML_EXAMPLES=Object.freeze({
 sct:`<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-SCT-001</MsgId></GrpHdr><CdtTrfTxInf>
<PmtId><EndToEndId>AR-DEMO-SCT-001</EndToEndId></PmtId>
<IntrBkSttlmAmt Ccy="EUR">125.00</IntrBkSttlmAmt>
<Dbtr><Nm>SYNTHETIC PAYER LTD</Nm></Dbtr><DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
<Cdtr><Nm>SYNTHETIC RECEIVER</Nm></Cdtr><CdtrAcct><Id><IBAN>FR1420041010050500013M02606</IBAN></Id></CdtrAcct>
</CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`,
 "sct-inst":`<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-INSTANT-001</MsgId></GrpHdr><CdtTrfTxInf>
<PmtId><EndToEndId>AR-DEMO-INSTANT-001</EndToEndId></PmtId>
<IntrBkSttlmAmt Ccy="EUR">1.00</IntrBkSttlmAmt>
<Dbtr><Nm>SYNTHETIC SENDER</Nm></Dbtr><DbtrAcct><Id><IBAN>DE89370400440532013000</IBAN></Id></DbtrAcct>
<Cdtr><Nm>SYNTHETIC PAYEE</Nm></Cdtr><CdtrAcct><Id><IBAN>FR1420041010050500013M02606</IBAN></Id></CdtrAcct>
</CdtTrfTxInf></FIToFICstmrCdtTrf></Document>`,
 chaps:`<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
<FICdtTrf><GrpHdr><MsgId>AR-DEMO-CHAPS-001</MsgId></GrpHdr><CdtTrfTxInf>
<PmtId><InstrId>AR-DEMO-CHAPS-001</InstrId></PmtId>
<IntrBkSttlmAmt Ccy="GBP">1000.00</IntrBkSttlmAmt>
<Dbtr><Nm>SYNTHETIC BANK</Nm></Dbtr><Cdtr><Nm>SYNTHETIC RECEIVING BANK</Nm></Cdtr>
</CdtTrfTxInf></FICdtTrf></Document>`
});
