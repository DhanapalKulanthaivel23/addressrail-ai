// Read-only message summary displayed only when local format checks have no findings.
// Values are taken verbatim from the submitted content; never infer bank/payment status.
const MAX_FIELD=100;
function item(label,value){
  const cleaned=(value||'').trim().replace(/[\r\n\t]+/g,' ').slice(0,MAX_FIELD);
  return cleaned?{label,value:cleaned}:null;
}
function finField(body,tag){
  const match=body.match(new RegExp('^:'+tag+':([^\\r\\n]+)', 'm'));
  return match?.[1]?.trim()||'';
}
export function summarizeMessage(format,raw,identifier,Parser=globalThis.DOMParser){
  const items=[item('Message type',identifier)];
  if(format==='MT'){
    const body=raw.includes('{4:')?raw.split('{4:')[1].split('-}')[0]:'';
    items.push(item('Reference',finField(body,'20')));
    if(identifier==='MT202')items.push(item('Related reference',finField(body,'21')));
    const amount=finField(body,'32A').match(/^(\d{6})([A-Z]{3})(\d+(?:,\d{1,2})?)/);
    if(amount){
      items.push(item('Value date (YYMMDD)',amount[1]));
      items.push(item('Currency',amount[2]));
      items.push(item('Amount',amount[3]));
    }
    if(identifier==='MT103')items.push(item('Charges',finField(body,'71A')));
  }else if(format==='MX'&&typeof Parser==='function'){
    try{
      const document=new Parser().parseFromString(raw,'application/xml');
      if(document.getElementsByTagName('parsererror').length)return items.filter(Boolean);
      const get=(tag)=>document.getElementsByTagNameNS('*',tag)[0];
      const value=(tag)=>get(tag)?.textContent||'';
      items.push(item('Message ID',value('MsgId')||value('PmtInfId')||(identifier.startsWith('camt.')?value('Id'):'')));
      items.push(item('Payment reference',value('EndToEndId')||value('InstrId')||value('TxId')));
      const amount=get('IntrBkSttlmAmt')||get('InstdAmt')||get('ForexAmt');
      if(amount){
        items.push(item('Currency',amount.getAttribute('Ccy')));
        items.push(item('Amount',amount.textContent));
      }
      items.push(item('Date',value('IntrBkSttlmDt')||value('CreDtTm')||value('TradDt')));
    }catch{ /* The caller already ran local parsing checks; never invent fields. */ }
  }
  return items.filter(Boolean);
}
