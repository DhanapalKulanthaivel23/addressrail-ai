import test from 'node:test';
import assert from 'node:assert/strict';
import {convertPostalAddress,POSTAL_SAMPLE} from '../apps/workbench/postal-address.mjs';

test('country and town explicitly present yield structured ISO XML with address parts',()=>{
 const x=convertPostalAddress(POSTAL_SAMPLE);
 assert.equal(x.ok,true);assert.equal(x.complete,true);
 assert.equal(x.results[0].mode,'structured');
 assert.match(x.output,/<StrtNm>Mark Lane<\/StrtNm>/);
 assert.match(x.output,/<BldgNb>55<\/BldgNb>/);
 assert.match(x.output,/<TwnNm>London<\/TwnNm>/);
 assert.match(x.output,/<Ctry>GB<\/Ctry>/);
 assert.match(x.output,/<PstCd>EC3R 7NE<\/PstCd>/);
 assert.doesNotMatch(x.output,/<AdrLine>/);
});
test('not supplied country is marked missing, never inferred from the city',()=>{
 const x=convertPostalAddress('55 Mark Lane, London, EC3R 7NE');
 assert.equal(x.ok,true);assert.equal(x.complete,false);
 assert.ok(x.results[0].issues.some(v=>v.includes('Country')));
 assert.ok(!x.output.includes('<Ctry>GB</Ctry>'));
});
test('MT FIN extracts only explicit 50K and 59 address fields, not adjacent payment tags',()=>{
 const source='{1:F01BANKGB2LAXXX}{2:I103BANKDEFFXXXXN}{4:\n:20:REF\n:50K:/ABC\nJOHN SMITH\n55 MARK LANE\nLONDON\nGB\n:59:/DEF\nSOMEONE ELSE\n23 RUE DE RIVOLI\nPARIS\nFR\n:71A:SHA\n-}';
 const x=convertPostalAddress(source);
 assert.equal(x.ok,true);assert.equal(x.results.length,2);
 assert.equal(x.results[0].party,'Debtor');
 assert.equal(x.results[1].party,'Creditor');
 assert.match(x.output,/<TwnNm>London<\/TwnNm>/);
 assert.match(x.output,/<TwnNm>Paris<\/TwnNm>/);
 assert.ok(!x.output.includes(':71A:SHA'));
 assert.ok(!x.output.includes('ABC'));
});
test('escaping and missing essential fields do not present valid conversion',()=>{
 const x=convertPostalAddress('123 Main & <Street>');
 assert.equal(x.ok,true);assert.equal(x.complete,false);
 assert.match(x.output,/&amp;/);
 assert.match(x.output,/&lt;Street&gt;/);
 assert.ok(x.results[0].issues.length>=2);
});
test('unsupported input and excessive size return clear errors',()=>{
 assert.equal(convertPostalAddress('').ok,false);
 assert.equal(convertPostalAddress('x'.repeat(65537)).ok,false);
 assert.equal(convertPostalAddress('{4:\n:20:ABC\n-}').ok,false);
});
