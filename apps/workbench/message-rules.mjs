/* Targeted browser-only payment-format checks. Never a substitute for official FIN or XSD rules. */
const MT_RULES={
 MT103:[['20','Sender reference',/^20$/],['23B','Bank operation code',/^23B$/],['32A','Value date, currency and amount',/^32A$/],['50a','Ordering customer',/^50[AFK]$/],['59a','Beneficiary customer',/^59[AF]?$/],['71A','Charges bearer',/^71A$/]],
 MT202:[['20','Transaction reference',/^20$/],['21','Related reference',/^21$/],['32A','Value date, currency and amount',/^32A$/],['58a','Beneficiary institution',/^58[AD]$/]]
};
export const KNOWN_MT=Object.keys(MT_RULES);
export const KNOWN_MX=['pacs.008.001.13','pacs.008.001.14','pain.001.001.09','camt.053.001.14','fxtr.014.001.05'];

export function mtBusinessIssues(identifier,body){
 const issues=[];
 const rules=MT_RULES[identifier];
 if(!rules)return [{code:'DEMO_UNSUPPORTED_MESSAGE',path:'/FIN/2',detail:'Field-level checks are not available for '+identifier+'. An identified message is not a validated message.'}];
 const matches=[...body.matchAll(/^:([0-9]{2}[A-Z]?):([^\r\n]*)(?:\r?\n|$)/gm)];
 const fields=matches.map(m=>({tag:m[1],value:body.slice(m.index+m[0].indexOf(':',1)+1,
    matches.find(n=>n.index>m.index)?.index??body.length).trim()}));
 for(const [tag,label,pattern] of rules){
  if(!fields.some(f=>pattern.test(f.tag)))issues.push({code:'DEMO_REQUIRED_FIELD',path:'/FIN/4/'+tag,detail:identifier+' requires '+label+' ('+tag+'); obtain the value from the original instruction.'});
 }
 const amount=fields.find(f=>f.tag==='32A')?.value.split(/\s/)[0];
 if(amount&&!/^\d{6}[A-Z]{3}(?:0|[1-9]\d{0,14}),\d{1,2}$/.test(amount))
   issues.push({code:'DEMO_AMOUNT',path:'/FIN/4/32A',detail:'Field 32A needs YYMMDD, three-letter currency and a comma-decimal amount.'});
 else if(amount){
  const mm=Number(amount.slice(2,4)),dd=Number(amount.slice(4,6));
  if(mm<1||mm>12||dd<1||dd>31)issues.push({code:'DEMO_AMOUNT',path:'/FIN/4/32A',detail:'Field 32A has an impossible month or day; verify the date against the source.'});
 }
 const fees=fields.find(f=>f.tag==='71A');
 if(identifier==='MT103'&&fees&&!/^(SHA|OUR|BEN)$/.test(fees.value))
  issues.push({code:'DEMO_REQUIRED_FIELD',path:'/FIN/4/71A',detail:'Field 71A should be SHA, OUR or BEN for this MT103 subset.'});
 return issues;
}

const REQUIRED={
 'pacs.008.001.13':[['GrpHdr','Group header'],['GrpHdr/MsgId','Message identification'],['GrpHdr/NbOfTxs','Number of transactions'],['GrpHdr/SttlmInf','Settlement information'],['CdtTrfTxInf','Credit transfer'],['CdtTrfTxInf/PmtId','Payment identification'],['CdtTrfTxInf/IntrBkSttlmAmt','Interbank settlement amount'],['CdtTrfTxInf/Dbtr','Debtor'],['CdtTrfTxInf/Cdtr','Creditor']],
 'pacs.008.001.14':[['GrpHdr','Group header'],['GrpHdr/MsgId','Message identification'],['GrpHdr/NbOfTxs','Number of transactions'],['GrpHdr/SttlmInf','Settlement information'],['CdtTrfTxInf','Credit transfer'],['CdtTrfTxInf/PmtId','Payment identification'],['CdtTrfTxInf/IntrBkSttlmAmt','Interbank settlement amount'],['CdtTrfTxInf/Dbtr','Debtor'],['CdtTrfTxInf/Cdtr','Creditor']],
 'pain.001.001.09':[['GrpHdr','Group header'],['GrpHdr/MsgId','Message identification'],['GrpHdr/NbOfTxs','Number of transactions'],['GrpHdr/InitgPty','Initiating party'],['PmtInf','Payment information'],['PmtInf/PmtInfId','Payment information reference'],['PmtInf/PmtMtd','Payment method'],['PmtInf/CdtTrfTxInf','Credit transfer instruction']],
 'camt.053.001.14':[['GrpHdr','Group header'],['GrpHdr/MsgId','Message identification'],['Stmt','Account statement'],['Stmt/Id','Statement identifier']]
};
const ROOT={
 'pacs.008.001.13':'FIToFICstmrCdtTrf','pacs.008.001.14':'FIToFICstmrCdtTrf',
 'pain.001.001.09':'CstmrCdtTrfInitn','camt.053.001.14':'BkToCstmrStmt'
};
export function mxBusinessIssues(identifier,document){
 if(identifier==='fxtr.014.001.05')return [];
 if(!REQUIRED[identifier])return [{code:'DEMO_UNSUPPORTED_MESSAGE',path:'/Document',detail:'Exact-version structural checks are not configured for '+identifier+'.'}];
 const namespace=document.documentElement.namespaceURI;
 const root=document.documentElement.firstElementChild;
 const rootName=ROOT[identifier];
 if(!root||root.localName!==rootName)return [{code:'DEMO_REQUIRED_FIELD',path:'/Document/'+rootName,detail:'Expected '+rootName+' as the business-message root for '+identifier+'.'}];
 function child(node,name){
  return Array.from(node?.children??[]).find(x=>x.localName===name&&x.namespaceURI===namespace);
 }
 return REQUIRED[identifier].flatMap(([path,label])=>{
  let target=root;
  for(const name of path.split('/'))target=child(target,name);
  return target?[]:[{code:'DEMO_REQUIRED_FIELD',path:'/Document/'+rootName+'/'+path,detail:label+' is required by this message-structure subset; obtain the actual value from the original record.'}];
 });
}
