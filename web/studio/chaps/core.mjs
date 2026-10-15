// Illustrative CHAPS ISO 20022 message sketches. Not schema- or CHAPS-conformant.
export const EXAMPLES=Object.freeze({
 customer: Object.freeze({type:"pacs.008",label:"Customer credit transfer",amount:"250000.00"}),
 institution: Object.freeze({type:"pacs.009 CORE",label:"Financial institution credit transfer",amount:"1500000.00"})
});
export const escapeXml=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
export function buildChapsExample(kind,amount="250000.00"){
 if(!Object.hasOwn(EXAMPLES,kind))throw Error("Choose the customer or institution teaching example.");
 if(!/^\d{1,10}\.\d{2}$/.test(amount)||Number(amount)<=0)throw Error("Use a positive synthetic GBP amount with two decimals.");
 const a=escapeXml(amount);
 const id=kind==="customer"?"CHAPS-EDU-CUST-01":"CHAPS-EDU-FI-01";
 if(kind==="customer")
 return `<?xml version="1.0" encoding="UTF-8"?>
<!-- AddressRail AI EDUCATIONAL SKETCH. NOT CHAPS/XSD CONFORMANT. -->
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08">
<FIToFICstmrCdtTrf>
 <GrpHdr><MsgId>${id}</MsgId><CreDtTm>2026-10-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs>
  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr>
 <CdtTrfTxInf>
  <PmtId><InstrId>${id}</InstrId><EndToEndId>${id}</EndToEndId><TxId>${id}</TxId></PmtId>
  <IntrBkSttlmAmt Ccy="GBP">${a}</IntrBkSttlmAmt><IntrBkSttlmDt>2026-10-15</IntrBkSttlmDt>
  <Dbtr><Nm>SYNTHETIC PAYER LTD</Nm></Dbtr>
  <DbtrAgt><FinInstnId><BICFI>AAAAGB2LXXX</BICFI></FinInstnId></DbtrAgt>
  <CdtrAgt><FinInstnId><BICFI>BBBBGB2LXXX</BICFI></FinInstnId></CdtrAgt>
  <Cdtr><Nm>SYNTHETIC RECEIVER LTD</Nm></Cdtr>
 </CdtTrfTxInf>
</FIToFICstmrCdtTrf>
</Document>`;
 return `<?xml version="1.0" encoding="UTF-8"?>
<!-- AddressRail AI EDUCATIONAL SKETCH. NOT CHAPS/XSD CONFORMANT. -->
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.08">
<FICdtTrf>
 <GrpHdr><MsgId>${id}</MsgId><CreDtTm>2026-10-15T09:00:00Z</CreDtTm><NbOfTxs>1</NbOfTxs>
  <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf></GrpHdr>
 <CdtTrfTxInf>
  <PmtId><InstrId>${id}</InstrId><EndToEndId>${id}</EndToEndId><TxId>${id}</TxId></PmtId>
  <IntrBkSttlmAmt Ccy="GBP">${a}</IntrBkSttlmAmt><IntrBkSttlmDt>2026-10-15</IntrBkSttlmDt>
  <Dbtr><FinInstnId><Nm>SYNTHETIC SENDING BANK</Nm></FinInstnId></Dbtr>
  <Cdtr><FinInstnId><Nm>SYNTHETIC RECEIVING BANK</Nm></FinInstnId></Cdtr>
 </CdtTrfTxInf>
</FICdtTrf>
</Document>`;
}
