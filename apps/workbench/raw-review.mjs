/* Local synthetic FIN MT / ISO MX syntax checks. Not an official standard validator. */
export const MT_EXAMPLE='{1:F01BANKGB2LAXXX}{2:I103BANKDEFFXXXXN}{4:\n:20:AR-DEMO-103\n:23B:CRED\n:32A:261020EUR100,00\n:50K:/DEMO\nSYNTHETIC PAYER\n:59:/DEMO\nSYNTHETIC BENEFICIARY\n:71A:SHA\n-}';
export const MX_EXAMPLE='<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14"><FIToFICstmrCdtTrf><GrpHdr><MsgId>AR-DEMO-008</MsgId></GrpHdr><CdtTrfTxInf><PmtId><EndToEndId>AR-DEMO-008</EndToEndId></PmtId><DbtrAgt><FinInstnId><BICFI>bankgb2lxxx</BICFI></FinInstnId></DbtrAgt></CdtTrfTxInf></FIToFICstmrCdtTrf></Document>';
const MAX_BYTES=65536;
function finding(code,path,detail){return {code,path,detail}}
export function reviewRawMessage(format,raw,Parser=globalThis.DOMParser){
  if(!['MT','MX'].includes(format))throw Error('Select MT or MX.');
  const issues=[];
  let identifier='UNKNOWN',proposal=null;
  if(typeof raw!=='string'||!raw.trim())return {format,identifier,issues:[finding('DEMO_MISSING_REFERENCE','/','Paste a synthetic message first.')],proposal:null,validated:false};
  if(new TextEncoder().encode(raw).length>MAX_BYTES)return {format,identifier,issues:[finding('DEMO_XML_STRUCTURE','/','64 KB message limit exceeded.')],proposal:null,validated:false};
  if(format==='MT'){
    const header=raw.match(/\{2:[IO](\d{3})/);
    identifier=header?'MT'+header[1]:'UNKNOWN';
    const block4=raw.indexOf('{4:');
    if(!raw.includes('{1:')||!header||block4<0){
      issues.push(finding('DEMO_MT_ENVELOPE','/FIN','FIN blocks 1, 2 and 4 are required for this envelope check.'));
    }else{
      const end=raw.lastIndexOf('-}');
      if(end<block4){
        issues.push(finding('DEMO_MT_ENVELOPE','/FIN/4','Missing FIN block-4 -} terminator.'));
        if(/^:[0-9]{2}[A-Z]?:/m.test(raw.slice(block4+3))&&!raw.includes('-}')){
          proposal={description:'Append missing FIN block-4 terminator (no field values invented).',corrected:raw.replace(/\s*$/,'')+'\n-}'};
        }
      }else{
        const body=raw.slice(block4+3,end).replace(/^\s*\r?\n/,'');
        const matches=[...body.matchAll(/^:([0-9]{2}[A-Z]?):/gm)];
        if(!matches.length||matches[0].index!==0)issues.push(finding('DEMO_MT_ENVELOPE','/FIN/4','Cannot identify FIN tagged fields at the beginning of block 4.'));
        else if(matches.some((m,i)=>!body.slice(m.index+m[0].length,i+1<matches.length?matches[i+1].index:body.length).trim()))
          issues.push(finding('DEMO_MISSING_REFERENCE','/FIN/4','At least one FIN tag has an empty value.'));
        if(identifier==='MT103'&&!/^:20:[^\r\n]+/m.test(body))issues.push(finding('DEMO_MISSING_REFERENCE','/FIN/4/20','MT103 example requires a field 20 reference; never invent it.'));
        const amount=body.match(/^:32A:(\S+)/m);
        if(identifier==='MT103'&&amount&&!/^\d{6}[A-Z]{3}\d{1,12},\d{1,2}$/.test(amount[1]))
          issues.push(finding('DEMO_AMOUNT','/FIN/4/32A','Expected YYMMDDCCYamount with a comma decimal separator for this MT103 subset.'));
      }
    }
  }else{
    if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw)||/<\?(?!xml\s)/i.test(raw))issues.push(finding('DEMO_XML_STRUCTURE','/','DOCTYPE, ENTITY or non-XML processing instructions are unsupported.'));
    else if(typeof Parser!=='function')issues.push(finding('DEMO_XML_STRUCTURE','/','XML parser unavailable.'));
    else{
      try{
        const document=new Parser().parseFromString(raw,'application/xml');
        if(document.getElementsByTagName('parsererror').length)throw Error('Malformed XML.');
        const root=document.documentElement;
        const ns=root.namespaceURI||'';
        const supportedNamespace=/^urn:iso:std:iso:20022:tech:xsd:([a-z]{4})\.\d{3}\.\d{3}\.\d{2,3}$/.test(ns);
        if(root.localName!=='Document'||!supportedNamespace)
          issues.push(finding('DEMO_XML_STRUCTURE','/Document','Expected a four-letter ISO 20022 business-area namespace and Document root; no XSD is loaded.'));
        else{
          identifier=ns.split(':').at(-1);
          if(root.children.length!==1)issues.push(finding('DEMO_XML_STRUCTURE','/Document','Expected one ISO business-message element.'));
          if(identifier==='fxtr.014.001.05'&&root.children.length===1){
            const trade=root.children[0];
            if(trade.localName!=='FxTradInstr'){
              issues.push(finding('DEMO_FXTR_STRUCTURE','/Document','fxtr.014.001.05 expects an FxTradInstr business element.'));
            }else{
              // Reviewed FX V05 root-section smoke check only; NOT a full XSD or CLS usage guideline.
              const required=['TradInf','TradgSdId','CtrPtySdId','TradAmts','AgrdRate'];
              const allowed=new Set([...required,'NDFConds','TradgSdSttlmInstrs','CtrPtySdSttlmInstrs','OptnlGnlInf','RgltryRptg','SplmtryData']);
              const present=Array.from(trade.children,el=>el.localName);
              for(const name of required)if(!present.includes(name))
                issues.push(finding('DEMO_FXTR_STRUCTURE','/Document/FxTradInstr/'+name,'Required FX V05 section not found in this structural subset. Do not invent trade details.'));
              for(const name of present)if(!allowed.has(name))
                issues.push(finding('DEMO_FXTR_STRUCTURE','/Document/FxTradInstr/'+name,'Unexpected FX V05 top-level section in this structural subset. Review the exact-version schema.'));
            }
          }
          const bics=[...document.getElementsByTagNameNS('*','BICFI'),...document.getElementsByTagNameNS('*','BIC'),...document.getElementsByTagNameNS('*','AnyBIC')];
          for(const bic of bics){
            const value=(bic.textContent||'').trim();
            if(!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value)){
              issues.push(finding('DEMO_BIC_FORMAT','/Document/.../'+bic.localName,'BIC must have 8 or 11 uppercase characters with a valid basic structure.'));
              const upper=value.toUpperCase();
              const text=(bic.textContent||'');
              const opening='<'+bic.localName+'>';
              const closing='</'+bic.localName+'>';
              const original=opening+text+closing;
              if(!proposal&&/^[A-Za-z]{4}[A-Za-z]{2}[A-Za-z0-9]{2}([A-Za-z0-9]{3})?$/.test(value)
                  &&raw.split(original).length===2)proposal={description:'Normalise the existing BIC text to uppercase only; no BIC or account is invented.',corrected:raw.replace(original,opening+upper+closing)};
            }
          }
        }
      }catch{issues.push(finding('DEMO_XML_STRUCTURE','/Document','XML is not well formed. Review the original source; unknown content is never invented.'))}
    }
  }
  return {format,identifier,issues,proposal,validated:issues.length===0,scope:'LOCAL_SYNTAX_SUBSET_ONLY',schemaValidated:false,schemeValidated:false};
}
