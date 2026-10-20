/* Browser-local, conservative ISO 20022 postal address structuring preview. */
const countries=new Map([['GB','GB'],['UK','GB'],['UNITED KINGDOM','GB'],['GREAT BRITAIN','GB'],['US','US'],['USA','US'],['UNITED STATES','US'],['DE','DE'],['GERMANY','DE'],['FR','FR'],['FRANCE','FR'],['BE','BE'],['BELGIUM','BE'],['IN','IN'],['INDIA','IN'],['SG','SG'],['SINGAPORE','SG'],['CN','CN'],['CHINA','CN']]);
const cities=new Map([['LONDON','London'],['BRUSSELS','Brussels'],['PARIS','Paris'],['BERLIN','Berlin'],['MUMBAI','Mumbai'],['DELHI','Delhi'],['SINGAPORE','Singapore'],['SHENZHEN','Shenzhen'],['NEW YORK','New York'],['CHENNAI','Chennai'],['BENGALURU','Bengaluru'],['BANGALORE','Bengaluru']]);
const postcodeGB=/\b(?:GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))\b/i;
const postcodeUS=/\b\d{5}(?:-\d{4})?\b/;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(name,text)=>text?'<'+name+'>'+esc(text)+'</'+name+'>':'';
function initialLines(value){
 return String(value).replace(/\r\n/g,'\n').split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);
}
function postalFromLines(lines,overrides={}){
 const parts=[...lines];let country=overrides.country||'',town=overrides.town||'',postcode=overrides.postcode||'';
 let street=overrides.street||'',building=overrides.building||'';
 for(let i=parts.length-1;i>=0;i--){
  const upper=parts[i].toUpperCase().replace(/\.$/,'');
  if(!country&&countries.has(upper)){country=countries.get(upper);parts.splice(i,1);continue}
  const zip=country==='US'?postcodeUS.exec(parts[i]):postcodeGB.exec(parts[i]);
  if(zip&&!postcode){postcode=zip[0].toUpperCase();parts[i]=parts[i].replace(zip[0],'').trim();if(!parts[i])parts.splice(i,1)}
 }
 for(let i=parts.length-1;i>=0;i--){
  const upper=parts[i].toUpperCase();
  // Match only explicit supported town names or a separately supplied TwnNm value.
  const matched=[...cities].find(([name])=>upper===name||upper.endsWith(' '+name));
  if(!town&&matched){town=matched[1];const rest=parts[i].slice(0,parts[i].length-matched[0].length).trim();if(rest)parts[i]=rest;else parts.splice(i,1)}
 }
 if(!street&&!overrides.preferHybrid&&parts.length===1){
  const match=/^(\d{1,5}[A-Z]?)\s+(.{3,68})$/i.exec(parts[0]);
  if(match){building=building||match[1];street=match[2];parts.pop()}
 }
 const issues=[];
 if(!town)issues.push('Town name needs confirmation.');
 if(!country)issues.push('Country needs confirmation.');
 let mode=street&&parts.length===0?'structured':'hybrid';
 const linesLeft=parts;
 if(linesLeft.length>2||linesLeft.some(x=>x.length>70)){
  issues.push('Address lines exceed the hybrid format limit of two lines, 70 characters each.');
 }
 if(!linesLeft.length&&!street)issues.push('No street or address line could be identified.');
 const xml=['<PstlAdr>',
    tag('StrtNm',street),tag('BldgNb',building),tag('PstCd',postcode),
    tag('TwnNm',town),tag('Ctry',country),
    ...linesLeft.map(line=>tag('AdrLine',line)), '</PstlAdr>'].filter(Boolean).join('\n');
 return {mode,xml,fields:{street,building,postcode,town,country,lines:linesLeft},issues,
         ready:issues.length===0&&!!town&&!!country};
}
function fromFin(raw){
 const block=raw.includes('{4:')?raw.slice(raw.indexOf('{4:')+3).split('-}')[0]:raw;
 const fields=[...block.matchAll(/^:([0-9]{2}[A-Z]?):/gm)];
 const results=[];
 for(let i=0;i<fields.length;i++){
  const f=fields[i],following=fields[i+1]?.index??block.length;
  if(!['50K','59','59F'].includes(f[1]))continue;
  const value=block.slice(f.index+f[0].length,following).trim();
  const pieces=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(pieces[0]?.startsWith('/'))pieces.shift();
  const name=pieces.shift()||'';
  if(pieces.length)results.push({party:f[1]==='50K'?'Debtor':'Creditor',name,lines:initialLines(pieces.join('\n'))});
 }
 return results;
}
function fromXml(raw,Parser){
 if(typeof Parser!=='function')return {error:'XML parser unavailable.',sources:[]};
 try{
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(raw))return {error:'XML declarations with entities are not supported.',sources:[]};
  const xml=new Parser().parseFromString(raw,'application/xml');
  if(xml.getElementsByTagName('parsererror').length)return {error:'Invalid XML input.',sources:[]};
  const sources=[];
  const tags=['Dbtr','Cdtr','UltmtDbtr','UltmtCdtr'];
  for(const partyName of tags){
   const parties=[...xml.getElementsByTagNameNS('*',partyName)];
   for(const p of parties.slice(0,3)){
    const adr=[...p.children].find(x=>x.localName==='PstlAdr');
    if(!adr)continue;
    const get=name=>[...adr.children].find(x=>x.localName===name)?.textContent?.trim()||'';
    const addressLines=[...adr.children].filter(x=>x.localName==='AdrLine').map(x=>x.textContent?.trim()||'').filter(Boolean);
    const lines=[...addressLines];
    const extraStreet=[get('BldgNb'),get('StrtNm')].filter(Boolean).join(' ');
    // Existing StrtNm/BlgNb already remain in structured fields; do not duplicate as AdrLine.
    sources.push({party:partyName,name:[...p.children].find(x=>x.localName==='Nm')?.textContent?.trim()||'',
      lines,overrides:{town:get('TwnNm'),country:get('Ctry'),postcode:get('PstCd'),
                    street:addressLines.length?'':get('StrtNm'),building:addressLines.length?'':get('BldgNb'),preferHybrid:addressLines.length>0}});
   }
  }
  return {sources};
 }catch{return {error:'XML could not be parsed.',sources:[]}}
}
export const POSTAL_SAMPLE='55 Mark Lane, London, EC3R 7NE, GB';
export function convertPostalAddress(raw,Parser=globalThis.DOMParser){
 if(typeof raw!=='string'||!raw.trim())return {ok:false,reason:'Paste an address or an MT/MX message.',results:[],output:''};
 if(new TextEncoder().encode(raw).length>65536)return {ok:false,reason:'Message is too large.',results:[],output:''};
 let sources=[],source='Address';
 if(/<Document\b|<PstlAdr\b/.test(raw)){
  const xml=fromXml(raw,Parser);if(xml.error)return {ok:false,reason:xml.error,results:[],output:''};
  sources=xml.sources;source='MX';
 }else if(/\{4:|^:50K:/m.test(raw)){
  sources=fromFin(raw);source='MT';
 }else sources=[{party:'Address',name:'',lines:initialLines(raw)}];
 if(!sources.length)return {ok:false,reason:'No supported postal address found. MT: 50K/59; MX: Dbtr/Cdtr/PstlAdr.',results:[],output:''};
 const results=sources.map(({party,name,lines,overrides})=>({party,name,source,...postalFromLines(lines,overrides)}));
 const output=results.map(x=>(results.length>1?x.party+'\n':'')+x.xml).join('\n\n');
 return {ok:true,source,results,output,complete:results.every(x=>x.ready)};
}
