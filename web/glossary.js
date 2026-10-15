/* Shared keyboard-accessible terminology lookup; no external APIs. */
(()=>{
"use strict";
const ENTRIES=[["Account","A bank or PSP record of balances and transactions."],["ACH","An automated clearing house for batched electronic payment processing."],["API","An interface through which software exchanges defined data and requests."],["Bank","A regulated institution that provides banking services."],["PSP","A payment service provider governed by applicable regulation."],["BIC","A Business Identifier Code used for identifying institutions in financial messages."],["IBAN","International Bank Account Number, a country-specific standard account identifier."],["IBAN checksum","A mod-97 check that detects some account-number typing errors."],["ISO 20022","Standardised financial message models and vocabularies."],["MT103","Legacy Swift FIN customer credit transfer message."],["MT202 COV","Legacy cover-payment instruction between financial institutions."],["CBPR+","Swift cross-border ISO 20022 usage guidance, not a settlement system."],["Swift FIN","Legacy Swift financial message network service."],["Swift gpi","A cross-border status-tracking overlay, not a settlement rail."],["UETR","Unique End-to-end Transaction Reference for message tracking."],["Correspondent","A bank providing services/accounts for another bank."],["Nostro","An account that a bank holds with another bank."],["Vostro","An account held on behalf of another bank."],["Clearing","Exchange and processing of payment instructions or obligations."],["Settlement","Discharge of interbank transfer obligations."],["RTGS","Real-Time Gross Settlement of individual obligations."],["Gross settlement","Settlement transaction by transaction, without netting."],["Net settlement","Settlement of calculated net obligations."],["CHAPS","UK high-value GBP payment system with gross settlement in BoE RTGS."],["FPS","Faster Payments, a UK near-real-time retail system."],["Bacs","UK batch processing for Direct Credit and Direct Debit."],["Direct Credit","Payment initiated to credit a recipient account."],["Direct Debit","Mandate-based collection initiated by a biller."],["Mandate","Authority supporting a Direct Debit instruction."],["Unpaid","A Direct Debit collection that was not paid."],["Return","An outcome reversing or returning value after prior processing."],["Recall","A request to retrieve or cancel a payment, without guarantee of success."],["Refund","Repayment to a payer according to applicable scheme rights."],["Reversal","A scheme-specific process intended to reverse a previous payment."],["SCT","EPC SEPA Credit Transfer scheme."],["SCT Inst","EPC SEPA Instant Credit Transfer scheme."],["SDD Core","SEPA Direct Debit Core with its own consumer protections."],["SDD B2B","SEPA Direct Debit Business-to-Business scheme."],["STEP2","An EBA CLEARING SEPA processing infrastructure."],["RT1","EBA CLEARING instant euro payment infrastructure."],["TIPS","Eurosystem TARGET Instant Payment Settlement service."],["T2","Eurosystem real-time gross settlement service."],["T2S","TARGET2-Securities: securities settlement service."],["CLS","FX payment-versus-payment settlement service."],["PvP","Payment-versus-Payment: two currency obligations linked in FX settlement."],["DvP","Delivery-versus-Payment: delivery of securities against payment."],["pacs.008","ISO 20022 FI-to-FI customer credit transfer."],["pacs.009","ISO 20022 financial-institution credit transfer."],["pacs.002","ISO 20022 financial institution payment status report."],["pacs.004","ISO 20022 payment return message."],["pacs.003","ISO 20022 FI-to-FI customer direct debit."],["pain.001","ISO 20022 customer credit transfer initiation."],["pain.008","ISO 20022 customer direct debit initiation."],["pain.002","ISO 20022 customer payment status report."],["camt.056","ISO 20022 interbank payment cancellation request."],["camt.053","ISO 20022 account statement message."],["KYC","Know Your Customer checks and due diligence."],["AML","Anti-Money Laundering controls."],["Sanctions","Restrictions requiring applicable screening controls."],["Screening","Checking relevant parties and transactions against control data."],["Liquidity","Available resources needed to fulfil payment/settlement obligations."],["Queue","Payment instructions waiting on permitted processing conditions."],["Timeout","No response before a defined timer expires; outcome may be unknown."],["UNKNOWN","No authoritative final processing outcome yet."],["RJCT","ISO payment status code associated with a rejection."],["ACTC","Status associated with accepted technical validation."],["ACSP","Status associated with accepted settlement processing."],["ACSC","Status associated with accepted settlement completed in context."],["XSD","XML Schema Definition specifying XML structures and datatypes."],["Schema validation","Checking XML against a specific XSD, not all business rules."],["EBA CLEARING","European payment infrastructure provider including STEP2 and RT1."],["Rulebook","Published and versioned payment scheme participant requirements."]];
const menu=document.querySelector("#ar-shared-nav");
if(!menu)return;
const e=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x};
const launch=e("button","Glossary · "+ENTRIES.length);launch.id="ar-glossary-open";launch.type="button";launch.setAttribute("aria-haspopup","dialog");
menu.append(launch);
const panel=e("section");panel.id="ar-glossary-panel";panel.hidden=true;
panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-label","Payment and AI glossary");
const header=e("div");header.className="ar-glossary-heading";
const title=e("strong","Payment and AI glossary — "+ENTRIES.length+" terms");
const close=e("button","Close ✕");close.type="button";header.append(title,close);
const label=e("label","Search glossary terms");label.htmlFor="ar-glossary-search";
const input=e("input");input.id="ar-glossary-search";input.type="search";input.placeholder="Search IBAN, pacs.008, settlement...";
const count=e("p");count.setAttribute("aria-live","polite");
const list=e("div");list.className="ar-glossary-list";
panel.append(header,label,input,count,list);document.body.append(panel);
function render(){
 const query=input.value.toLowerCase().trim();list.replaceChildren();let matched=0;
 for(const [term,meaning] of ENTRIES){
  if(query&&!(term+" "+meaning).toLowerCase().includes(query))continue;
  matched++;
  const item=e("article"),button=e("button",term),text=e("p",meaning);
  button.type="button";button.title=meaning;button.setAttribute("aria-expanded","false");
  text.hidden=true;
  button.addEventListener("click",()=>{text.hidden=!text.hidden;button.setAttribute("aria-expanded",String(!text.hidden))});
  item.append(button,text);list.append(item);
 }
 count.textContent=matched+" matching terms. Focus a term and press Enter to show its definition.";
}
function hide(){panel.hidden=true;launch.setAttribute("aria-expanded","false");launch.focus()}
launch.addEventListener("click",()=>{panel.hidden=false;launch.setAttribute("aria-expanded","true");input.value="";render();input.focus()});
close.addEventListener("click",hide);input.addEventListener("input",render);
document.addEventListener("keydown",event=>{if(!panel.hidden&&event.key==="Escape"){event.preventDefault();hide()}});
})();
