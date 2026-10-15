/**
 * Educational coverage map, NOT a live rail directory, routing table or certification.
 * "scheme", "infrastructure", "network", "overlay", and "service" are deliberately distinct.
 * All URLs are public informational references, not connectivity endpoints.
 */
const entries = [
 ["cbpr","SWIFT CBPR+","Global","messaging standard/profile","ISO","pacs.008 / pacs.009 CORE+COV / pacs.002 / pacs.004 / camt.056","Cross-border MX message use and exception handling; not a clearing system.","https://www.swift.com/standards/iso-20022/iso-20022-programme"],
 ["gpi","SWIFT gpi Tracker","Global","tracking overlay","TRACKING","UETR / payment tracker status","Cross-border payment tracking and confirmations; not a settlement rail.","https://www.swift.com/our-solutions/swift-gpi"],
 ["g4c","SWIFT gpi for Corporates (g4C)","Global","corporate overlay","TRACKING","Pay and trace / inbound tracking","Corporate treasury-facing bank-agnostic payment visibility, not a scheme.","https://docs.developer.swift.com/docs/api-guides/gpi-for-corporates-api/gpi-for-corporates-api-reference"],
 ["swift-fin","SWIFT FIN MT (legacy learning)","Global","messaging network","MT","MT103 / MT202(COV) / MT199","Historical/transition teaching only. MT/MX use depends on current release and message scope.","https://www.swift.com/standards"],
 ["swift-go","SWIFT Go","Global","cross-border service","TRACKING","Payment initiation / tracking","Service for cross-border payment experience; not a new clearing/settlement system.","https://www.swift.com/our-solutions/swift-go"],
 ["swift-fileact","SWIFT FileAct","Global","file-transfer network","FILE","File transfer / acknowledgements","Secure file transport concepts; payload and rail depend on participants.","https://www.swift.com/"],
 ["chaps","CHAPS","UK","payment system","ISO","pacs.008 / pacs.009 / pacs.002","Sterling high-value/time-critical payments; gross-settled in BoE RTGS.","https://www.bankofengland.co.uk/payment-and-settlement/a-brief-introduction-to-the-real-time-gross-settlement-system-and-chaps"],
 ["boe-rtgs","Bank of England RTGS","UK","settlement infrastructure","ISO","Settlement/liquidity events","Central-bank sterling gross settlement for CHAPS plus net settlement services for retail systems.","https://www.bankofengland.co.uk/payment-and-settlement"],
 ["fps","Faster Payments Service (FPS)","UK","retail payment system","UK_RETAIL","Faster Payments retail messages","Near-real-time UK retail payments; scheme processing is distinct from net interbank settlement.","https://www.wearepay.uk/what-we-do/payment-systems/faster-payment-system/"],
 ["bacs-credit","Bacs Direct Credit","UK","retail credit scheme","UK_RETAIL","Standard 18 / submission reports","Batch salary and credit payments across the Bacs processing cycle.","https://www.wearepay.uk/what-we-do/payment-systems/bacs-payment-system/"],
 ["bacs-debit","Bacs Direct Debit","UK","retail direct debit scheme","UK_RETAIL","Mandate / collection / returns","UK mandate-based pull payments and collection exceptions.","https://www.wearepay.uk/what-we-do/payment-systems/bacs-payment-system/"],
 ["ics","Image Clearing System (ICS)","UK","cheque clearing system","UK_RETAIL","Cheque image / clearing returns","UK cheque-image clearing; not an ISO 20022 credit transfer scheme.","https://www.wearepay.uk/what-we-do/payment-systems/image-clearing-system/"],
 ["cop","Confirmation of Payee (CoP)","UK","name-check overlay","OVERLAY","Payee matching response","Payee name-checking service, not a guarantee of payment or settlement.","https://www.wearepay.uk/what-we-do/overlay-services/confirmation-of-payee/"],
 ["link","LINK ATM network","UK","ATM payment system","UK_RETAIL","ATM transaction / network settlement","UK cash access/payment network; distinct from CHAPS and Faster Payments.","https://www.link.co.uk/"],
 ["pexa","PEXA / UK property payments","UK","property settlement service","UK_RETAIL","Property settlement instruction","Payment-related property settlement orchestration, not a general retail credit scheme.","https://www.bankofengland.co.uk/payment-and-settlement"],
 ["sct","SEPA Credit Transfer (SCT)","EU/SEPA","EPC payment scheme","ISO","pain.001 / pacs.008 / pacs.002","Ordinary euro credit transfers under EPC SCT scheme rules.","https://www.europeanpaymentscouncil.eu/what-we-do/sepa-credit-transfer"],
 ["sct-inst","SEPA Instant Credit Transfer (SCT Inst)","EU/SEPA","EPC payment scheme","ISO","pacs.008 / pacs.002","Instant euro scheme; CSM/infrastructure routing chosen by participating PSPs.","https://www.europeanpaymentscouncil.eu/what-we-do/sepa-instant-credit-transfer"],
 ["sdd-core","SEPA Direct Debit Core","EU/SEPA","EPC direct-debit scheme","ISO","pain.008 / pacs.003 / pacs.002","Consumer-oriented euro pull payment with mandates and return/refund processes.","https://www.europeanpaymentscouncil.eu/what-we-do/sepa-direct-debit"],
 ["sdd-b2b","SEPA Direct Debit B2B","EU/SEPA","EPC direct-debit scheme","ISO","pain.008 / pacs.003 / pacs.002","Business-to-business euro direct debit; mandate requirements differ from Core.","https://www.europeanpaymentscouncil.eu/what-we-do/sepa-direct-debit"],
 ["oct-inst","One-Leg Out Instant Credit Transfer (OCT Inst)","EU/SEPA","EPC payment scheme","ISO","pacs.008 / pacs.002","Euro leg of international instant credit transfers; not standard SCT Inst.","https://www.europeanpaymentscouncil.eu/what-we-do"],
 ["vop","Verification of Payee (VoP)","EU/SEPA","payee-check scheme","OVERLAY","Payee verification result","Payee-name/account verification concept; not payment settlement.","https://www.europeanpaymentscouncil.eu/what-we-do"],
 ["srtp","SEPA Request-to-Pay (SRTP)","EU/SEPA","request overlay","OVERLAY","Request / response","A request-to-pay experience distinct from executing a credit transfer.","https://www.europeanpaymentscouncil.eu/what-we-do"],
 ["step2","STEP2 SCT","EU/SEPA","clearing/settlement mechanism","ISO","pacs.008 / pacs.002","EBA CLEARING pan-European SCT processing; not the EPC scheme itself.","https://www.ebaclearing.eu/services/step2-sct/"],
 ["step2-sdd","STEP2 SDD","EU/SEPA","clearing/settlement mechanism","ISO","pacs.003 / pacs.002","EBA CLEARING SDD processing for Core and B2B; distinct scheme rules.","https://www.ebaclearing.eu/services/step2-sdd/"],
 ["rt1","RT1","EU/SEPA","instant payment infrastructure","ISO","pacs.008 / pacs.002","EBA CLEARING real-time payment infrastructure; one SCT Inst route.","https://www.ebaclearing.eu/services/rt1/"],
 ["tips","TARGET Instant Payment Settlement (TIPS)","EU/SEPA","central-bank settlement infrastructure","ISO","pacs.008 / pacs.002","Eurosystem 24/7 instant settlement service; distinct from RT1 and T2.","https://www.ecb.europa.eu/paym/target/tips/html/index.en.html"],
 ["t2","T2 (Eurosystem RTGS)","EU/SEPA","central-bank RTGS infrastructure","ISO","pacs.008 / pacs.009 / camt.*","Large-value central-bank-money gross settlement; not TARGET2, its predecessor.","https://www.ecb.europa.eu/paym/target/t2/html/index.en.html"],
 ["t2s","TARGET2-Securities (T2S)","EU/SEPA","securities settlement infrastructure","ISO","securities cash settlement events","Delivery-versus-payment securities platform, not a retail credit transfer rail.","https://www.ecb.europa.eu/paym/target/t2s/html/index.en.html"],
 ["euro1","EURO1","EU/SEPA","large-value payment system","ISO","Large-value payment events","Private-sector high-value euro payment system; distinguish from Eurosystem T2.","https://www.ebaclearing.eu/services/euro1/"],
 ["fr-stet","STET / French clearing","EU national","national processing context","NATIONAL","French SEPA payment processing","National clearing context; not a new EPC payment scheme.","https://www.stet.eu/"],
 ["es-snce","SNCE / Spain","EU national","national clearing context","NATIONAL","Spanish SEPA clearing concepts","National infrastructure context and SEPA routing; check current operator guidance.","https://www.iberpay.com/"],
 ["it-bicomp","BI-COMP / Italy","EU national","national clearing context","NATIONAL","Italian retail payments processing","Italian retail clearing context; not an independent Europe-wide EPC scheme.","https://www.bancaditalia.it/"],
 ["nl-csm","Equens / Netherlands","EU national","national clearing context","NATIONAL","Dutch SEPA processing","Dutch domestic clearing context; refer to current provider coverage.","https://www.equensworldline.com/"],
 ["lt-centrolink","CENTROlink / Lithuania","EU national","national clearing context","NATIONAL","SEPA routing and settlement services","National PSP access/clearing services; not a separate EPC scheme.","https://www.lb.lt/en/"],
 ["cls","CLS FX settlement (GBP/EUR legs)","Cross-border","FX settlement infrastructure","TRACKING","FX PvP / funding events","Cross-currency payment-versus-payment risk reduction; not an SCT or CHAPS retail scheme.","https://www.cls-group.com/"]
];
export const RAILS=Object.freeze(entries.map(([id,name,region,kind,format,messages,description,reference])=>
 Object.freeze({id,name,region,kind,format,messages,description,reference})));
export const RAIL_MAP=Object.freeze(Object.fromEntries(RAILS.map(x=>[x.id,x])));
export const FORMATS=Object.freeze({ISO:"ISO 20022 educational sketch",TRACKING:"Tracking/service overlay",MT:"Legacy MT learning",
 UK_RETAIL:"UK retail conceptual record",OVERLAY:"Overlay/check (not a payment)",FILE:"File transfer concept",NATIONAL:"National infrastructure context"});
export const IS_REAL_SCHEME=id=>["sct","sct-inst","sdd-core","sdd-b2b","oct-inst"].includes(id);
export function getRail(id){
 const rail=RAIL_MAP[id]; if(!rail)throw Error("Unsupported educational rail or service");
 return rail;
}
export function listRails({region="ALL",query=""}={}){
 const q=String(query).trim().toLowerCase();
 return RAILS.filter(r=>(region==="ALL"||r.region===region)&&
 (!q||[r.name,r.description,r.messages,r.kind,r.region].some(v=>v.toLowerCase().includes(q))));
}
