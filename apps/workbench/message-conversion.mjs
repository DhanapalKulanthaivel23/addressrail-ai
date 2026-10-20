/* Bounded browser-only translation preview. Never silently manufacture business facts. */
const XML_NS='urn:iso:std:iso:20022:tech:xsd:';
const MAX_BYTES=65536;
const pairs={
  MT103:{mx:'pacs.008.001.14',root:'FIToFICstmrCdtTrf'},
  MT202:{mx:'pacs.009.001.12',root:'FICdtTrf'}
};
const inverse=Object.fromEntries(Object.entries(pairs).map(([mt,info])=>[info.mx,mt]));
inverse['pacs.008.001.13']='MT103';
inverse['pacs.009.001.11']='MT202';
function esc(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]))}
function xml(name,value){
 if(value===null||value===undefined||value==='')return '';
 return '<'+name+'>'+esc(value)+'</'+name+'>';
}
function wrap(name,value){return value?'<'+name+'>'+value+'</'+name+'>':''}
function warning(field,reason){return {field,reason}}
function parseFin(raw){
 const id=raw.match(/\{2:[IO](\d{3})/)?.[1];
 const fields=new Map();
 const start=raw.indexOf('{4:');
 const text=start>=0?raw.slice(start+3).split('-}')[0].replace(/^\r?\n/,''):'';
 const tags=[...text.matchAll(/^:([0-9]{2}[A-Z]?):/gm)];
 for(let i=0;i<tags.length;i++){
  const tag=tags[i],end=tags[i+1]?.index??text.length;
  const content=text.slice(tag.index+tag[0].length,end).trim();
  fields.set(tag[1],content);
 }
 return {type:id?'MT'+id:'',fields};
}
function finAmount(value,diagnostics){
 if(!value){diagnostics.push(warning('32A','Missing source amount and value date.'));return null}
 const match=/^(\d{6})([A-Z]{3})(\d{1,15},\d{1,2})$/.exec(value);
 if(!match){diagnostics.push(warning('32A','Cannot map amount/date: invalid source format.'));return null}
 const [,yyMMdd,currency,amount]=match;
 const yyyy='20'+yyMMdd.slice(0,2),mm=yyMMdd.slice(2,4),dd=yyMMdd.slice(4,6);
 if(Number(mm)<1||Number(mm)>12||Number(dd)<1||Number(dd)>31){
  diagnostics.push(warning('32A','Source value date is not a possible calendar date.'));return null
 }
 diagnostics.push(warning('32A','Two-digit date interpreted in the 2000–2099 century; confirm against the original instruction.'));
 return {date:yyyy+'-'+mm+'-'+dd,currency,amount:amount.replace(',','.')};
}
function partiesFromFin(tag,value,diagnostics){
 if(!value)return '';
 const lines=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const account=lines[0]?.startsWith('/')?lines.shift().slice(1):'';
 const name=lines.shift()||'';
 const addr=lines;
 if(!name)diagnostics.push(warning(tag,'Name cannot be identified; original payment party must be reviewed.'));
 if(addr.length)diagnostics.push(warning(tag,'Postal address copied into unstructured address lines; town and country were not inferred.'));
 const person=wrap(tag==='50K'?'Dbtr':'Cdtr',
    xml('Nm',name)+(addr.length?wrap('PstlAdr',addr.map(a=>xml('AdrLine',a)).join('')):''));
 const acct=account?wrap(tag==='50K'?'DbtrAcct':'CdtrAcct',wrap('Id',wrap('Othr',xml('Id',account)))):'';
 return person+acct;
}
function mtToMx(raw){
 const parsed=parseFin(raw),selected=pairs[parsed.type];
 if(!selected)return {ok:false,reason:'Only MT103 → pacs.008 and MT202 → pacs.009 mappings are available. No equivalent can be safely inferred for this MT type.'};
 const {fields}=parsed,diagnostics=[],mapped=[];
 const field=(tag)=>fields.get(tag)||'';
 const ref=field('20');
 const amt=finAmount(field('32A'),diagnostics);
 if(!ref)diagnostics.push(warning('20','Source reference is missing; no message ID was invented.'));
 else {mapped.push({from:'MT/20',to:'GrpHdr/MsgId and PmtId/InstrId'});diagnostics.push(warning('20','Sender reference was reused as message ID and instruction ID for a review-only draft.'))}
 const group=wrap('GrpHdr',xml('MsgId',ref)+xml('NbOfTxs','1'));
 diagnostics.push(warning('GrpHdr/SttlmInf','Settlement method is absent and cannot be assumed.'));
 const pmt=wrap('PmtId',xml('InstrId',ref)+(parsed.type==='MT202'?xml('EndToEndId',field('21')):''));
 if(parsed.type==='MT202'&&!field('21'))diagnostics.push(warning('21','Related reference absent.'));
 const amount=amt?'<IntrBkSttlmAmt Ccy="'+esc(amt.currency)+'">'+esc(amt.amount)+'</IntrBkSttlmAmt>'+xml('IntrBkSttlmDt',amt.date):'';
 if(amt)mapped.push({from:'MT/32A',to:'CdtTrfTxInf/IntrBkSttlmAmt and IntrBkSttlmDt'});
 let other='';
 if(parsed.type==='MT103'){
  other+=partiesFromFin('50K',field('50K'),diagnostics);
  other+=partiesFromFin('59',field('59'),diagnostics);
  for(const tag of ['50K','59'])if(field(tag))mapped.push({from:'MT/'+tag,to:tag==='50K'?'Dbtr / DbtrAcct':'Cdtr / CdtrAcct'});
  if(!field('50K'))diagnostics.push(warning('50a','Ordering customer source field is missing or uses an unimplemented option A/F; do not infer the debtor.'));
  if(!field('59'))diagnostics.push(warning('59a','Beneficiary source field is missing or uses an unimplemented option A/F; do not infer the creditor.'));
  const charges={SHA:'SHAR',OUR:'DEBT',BEN:'CRED'}[field('71A')];
  if(charges){other+=xml('ChrgBr',charges);mapped.push({from:'MT/71A',to:'CdtTrfTxInf/ChrgBr'})}
  else diagnostics.push(warning('71A','Charges bearer absent or unsupported.'));
  if(field('70')){other+=wrap('RmtInf',xml('Ustrd',field('70')));mapped.push({from:'MT/70',to:'CdtTrfTxInf/RmtInf/Ustrd'})}
 }else{
  const institution=field('58A')||field('58D');
  if(institution){other+=wrap('Cdtr',wrap('FinInstnId',xml('BICFI',institution)));mapped.push({from:'MT/58a',to:'CdtTrfTxInf/Cdtr/FinInstnId'})}
  else diagnostics.push(warning('58a','Beneficiary institution is missing.'));
 }
 const supported=new Set(parsed.type==='MT103'?['20','23B','32A','50K','59','59A','59F','71A','70']:['20','21','32A','58A','58D']);
 for(const tag of fields.keys())if(!supported.has(tag))diagnostics.push(warning(tag,'Source field was not mapped; inspect for loss of information.'));
 if(field('23B'))diagnostics.push(warning('23B','Bank operation code has no confirmed direct mapping in this preview.'));
 const payload=wrap('CdtTrfTxInf',pmt+amount+other);
 const result='<?xml version="1.0" encoding="UTF-8"?>\n'+
   '<Document xmlns="'+XML_NS+selected.mx+'">\n'+
   '  <'+selected.root+'>\n'+group+'\n'+payload+'\n  </'+selected.root+'>\n</Document>';
 return {ok:true,format:'MX',identifier:selected.mx,output:result,mapped,diagnostics,
         complete:false,reason:'Review-only XML translation. Missing schema/CBPR+ fields are not invented.'};
}
function select(node,name,ns){return Array.from(node?.children??[]).find(x=>x.localName===name&&x.namespaceURI===ns)}
function path(node,parts,ns){for(const part of parts.split('/'))node=select(node,part,ns);return node}
function value(node){return node?.textContent?.trim()||''}
function validField(s){return !!s&&!/[\r\n:{}]/.test(s)&&s.length<=35}
function addFin(lines,tag,valueStr,diagnostics,mappedFrom){
 const val=String(valueStr||'').trim();
 if(!val)return;
 if(!validField(val)){diagnostics.push(warning(mappedFrom||tag,'Field cannot fit one FIN line without truncation; omitted from draft.'));return}
 lines.push(':'+tag+':'+val);
}
function mxToMt(raw,Parser){
 if(typeof Parser!=='function')return {ok:false,reason:'Browser XML parser is unavailable.'};
 if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw))return {ok:false,reason:'XML entity/DOCTYPE declarations are not accepted.'};
 let doc;try{doc=new Parser().parseFromString(raw,'application/xml')}catch{return {ok:false,reason:'Malformed XML.'}}
 if(doc.getElementsByTagName('parsererror').length)return {ok:false,reason:'Malformed XML. Correct the document before conversion.'};
 const root=doc.documentElement,ns=root.namespaceURI||'',type=ns.slice(XML_NS.length);
 if(root.localName!=='Document'||!ns.startsWith(XML_NS))return {ok:false,reason:'Expected an ISO 20022 Document root.'};
 const mt=inverse[type];
 if(!mt)return {ok:false,reason:'No verified translation pair for '+type+'. Supported: pacs.008.001.13/.14 and pacs.009.001.11/.12.'};
 const name=mt==='MT103'?'FIToFICstmrCdtTrf':'FICdtTrf';
 const content=select(root,name,ns);
 if(!content)return {ok:false,reason:'Expected '+name+' business-message element for '+type+'.'};
 const diagnostics=[],mapped=[],fields=[];
 const g=select(content,'GrpHdr',ns),tx=select(content,'CdtTrfTxInf',ns);
 if(!tx)diagnostics.push(warning('CdtTrfTxInf','Missing transaction details.'));
 const ref=value(path(tx,'PmtId/InstrId',ns))||value(path(g,'MsgId',ns));
 if(ref){addFin(fields,'20',ref,diagnostics,'PmtId/InstrId');mapped.push({from:'PmtId/InstrId or GrpHdr/MsgId',to:'MT/20'})}
 else diagnostics.push(warning('20','Missing sender reference.'));
 if(mt==='MT103'){diagnostics.push(warning('23B','Bank operation code is not supplied by the MX source; do not invent one.'))}
 else {const related=value(path(tx,'PmtId/EndToEndId',ns));if(related)addFin(fields,'21',related,diagnostics,'PmtId/EndToEndId');else diagnostics.push(warning('21','Related reference is unavailable.'))}
 const amountNode=path(tx,'IntrBkSttlmAmt',ns);
 const amount=value(amountNode),currency=amountNode?.getAttribute('Ccy')||'';
 const date=value(path(tx,'IntrBkSttlmDt',ns))||value(path(g,'IntrBkSttlmDt',ns));
 if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&/^20\d{2}/.test(date)&&/^[A-Z]{3}$/.test(currency)&&/^\d{1,15}(?:\.\d{1,2})?$/.test(amount)){
  addFin(fields,'32A',date.slice(2,4)+date.slice(5,7)+date.slice(8,10)+currency+amount.replace('.',','),diagnostics,'IntrBkSttlmAmt');
  mapped.push({from:'IntrBkSttlmAmt and IntrBkSttlmDt',to:'MT/32A'});
 }else diagnostics.push(warning('32A','Missing date, currency or amount, or not representable in FIN. No amount was fabricated.'));
 function party(tag,personName,accountNode){
  const person=select(tx,personName,ns);
  const who=value(select(person,'Nm',ns));
  const addr=select(person,'PstlAdr',ns);
  const lines=Array.from(addr?.children||[]).filter(x=>x.localName==='AdrLine').map(value).filter(Boolean);
  if(addr&&Array.from(addr.children).some(x=>x.localName!=='AdrLine'))
    diagnostics.push(warning(personName+'/PstlAdr','Structured address fields may not map to FIN AdrLine; review original address for data loss.'));
  const account=value(path(tx,accountNode+'/Id/Othr/Id',ns))||value(path(tx,accountNode+'/Id/IBAN',ns));
  const parts=[...(account?['/'+account]:[]),...(who?[who]:[]),...lines];
  if(!parts.length){diagnostics.push(warning(tag,'Party details not present.'));return}
  if(parts.length>4||parts.some(x=>x.length>35||/[\r\n:{}]/.test(x))){
   diagnostics.push(warning(tag,'Party details exceed FIN line/length limits; data was not truncated and must be reviewed.'));return
  }
  fields.push(':'+tag+':'+parts.join('\n'));
  mapped.push({from:personName+' and '+accountNode,to:'MT/'+tag});
  if(lines.length)diagnostics.push(warning(tag,'Structured address information may be lost when represented as unstructured FIN lines.'));
 }
 if(mt==='MT103'){
  party('50K','Dbtr','DbtrAcct');party('59','Cdtr','CdtrAcct');
  const chrg=value(select(tx,'ChrgBr',ns)),mtCharge={SHAR:'SHA',DEBT:'OUR',CRED:'BEN'}[chrg];
  if(mtCharge){addFin(fields,'71A',mtCharge,diagnostics,'ChrgBr');mapped.push({from:'ChrgBr',to:'MT/71A'})}
  else diagnostics.push(warning('71A','Charges bearer missing or cannot be mapped.'));
  const text=value(path(tx,'RmtInf/Ustrd',ns));if(text)addFin(fields,'70',text,diagnostics,'RmtInf/Ustrd');
 }else {
  const bic=value(path(tx,'Cdtr/FinInstnId/BICFI',ns));
  if(bic)addFin(fields,'58A',bic,diagnostics,'Cdtr/FinInstnId/BICFI');
  else diagnostics.push(warning('58a','Beneficiary institution missing.'));
 }
 if(value(path(tx,'PmtId/UETR',ns)))diagnostics.push(warning('PmtId/UETR','UETR has no field in this basic MT text-block preview; preserve it outside this conversion.'));
 diagnostics.push(warning('FIN envelope','No originating SWIFT header/routing data was provided. Block 1 and 2 have NOT been invented; this is a text-block draft.'));
 return {ok:true,format:'MT',identifier:mt,output:'{4:\n'+fields.join('\n')+'\n-}',
         mapped,diagnostics,complete:false,reason:'FIN block-4 preview only. Sender/receiver headers and message validation remain unresolved.'};
}
export function convertMessage(format,raw,Parser=globalThis.DOMParser){
 if(!['MT','MX'].includes(format))return {ok:false,reason:'Select MT or MX.'};
 if(typeof raw!=='string'||!raw.trim())return {ok:false,reason:'Paste or load a source message.'};
 if(new TextEncoder().encode(raw).length>MAX_BYTES)return {ok:false,reason:'Message exceeds the 64 KB limit.'};
 return format==='MT'?mtToMx(raw):mxToMt(raw,Parser);
}
