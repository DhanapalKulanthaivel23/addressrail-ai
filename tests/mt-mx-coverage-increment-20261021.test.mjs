import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRawMessage} from '../apps/workbench/raw-review.mjs';
import {KNOWN_MX,mtBusinessIssues,mxBusinessIssues} from '../apps/workbench/message-rules.mjs';

for(const number of ['199','299']){
 const body=':20:SYNTHETIC-REF\n:79:TEST ONLY\n';
 test('MT'+number+' limited synthetic positive and missing narrative negative',()=>{
  const sample='{1:F01BANKGB2LAXXX}{2:I'+number+'BANKDEFFXXXXN}{4:\n'+body+'-}';
  const result=reviewRawMessage('MT',sample);
  assert.equal(result.identifier,'MT'+number);
  assert.equal(result.issues.length,0);
  assert.equal(result.schemaValidated,false);
  assert.equal(result.schemeValidated,false);
  const broken=sample.replace(':79:TEST ONLY\n','');
  assert.ok(reviewRawMessage('MT',broken).issues.some(x=>x.path==='/FIN/4/79'));
  assert.ok(mtBusinessIssues('MT'+number,':20:REF\n:79:TEXT\n:79:DUPLICATE').some(x=>x.path==='/FIN/4/79'));
 });
}
const cases=[
 ['pain.002.001.10','CstmrPmtStsRpt','<GrpHdr><MsgId>AR-1</MsgId></GrpHdr><OrgnlGrpInfAndSts><OrgnlMsgId>AR-ORIGINAL</OrgnlMsgId></OrgnlGrpInfAndSts>','OrgnlGrpInfAndSts/OrgnlMsgId'],
 ['pacs.002.001.12','FIToFIPmtStsRpt','<GrpHdr><MsgId>AR-2</MsgId></GrpHdr><OrgnlGrpInfAndSts><OrgnlMsgId>AR-ORIGINAL</OrgnlMsgId></OrgnlGrpInfAndSts>','OrgnlGrpInfAndSts/OrgnlMsgId'],
 ['camt.052.001.13','BkToCstmrAcctRpt','<GrpHdr><MsgId>AR-3</MsgId></GrpHdr><Rpt><Id>AR-REPORT</Id></Rpt>','Rpt/Id'],
];
for(const [identifier,root,inner,required] of cases){
 test(identifier+' exact-version structural witness, not an XSD test',()=>{
  assert.ok(KNOWN_MX.includes(identifier));
  const ns='urn:iso:std:iso:20022:tech:xsd:'+identifier;
  const xml='<Document xmlns="'+ns+'"><'+root+'>'+inner+'</'+root+'></Document>';
  assert.match(xml,new RegExp(identifier.replaceAll('.','\\.')));
  const node=(name,children=[],value='')=>({localName:name,namespaceURI:ns,children,textContent:value});
  const group=node('GrpHdr',[node('MsgId',[],'AR-1')]);
  const section=identifier.startsWith('camt')?node('Rpt',[node('Id',[],'AR-REPORT')]):node('OrgnlGrpInfAndSts',[node('OrgnlMsgId',[],'AR-ORIGINAL')]);
  const business=node(root,[group,section]);
  const document={documentElement:{namespaceURI:ns,firstElementChild:business}};
  assert.deepEqual(mxBusinessIssues(identifier,document),[]);
  section.children=[];
  assert.ok(mxBusinessIssues(identifier,document).some(x=>x.path.endsWith(required)));
 });
}
