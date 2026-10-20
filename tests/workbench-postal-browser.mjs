import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORKBENCH_URL||'http://127.0.0.1:8765/studio/workbench/');
 const choices=await page.locator('.gateway-choices .gateway-choice strong').allTextContents();
 assert.deepEqual(choices,['SWIFT MT messages','Postal Address Converter','ISO 20022 MX messages']);
 await page.getByRole('button',{name:/Postal Address Converter/}).click();
 await page.getByRole('button',{name:'Load address example'}).click();
 await page.getByRole('button',{name:'Convert postal address',exact:true}).click();
 const output=page.getByLabel('Converted postal address XML');
 assert.match(await output.inputValue(),/<StrtNm>Mark Lane<\/StrtNm>/);
 assert.match(await output.inputValue(),/<TwnNm>London<\/TwnNm>/);
 assert.match(await output.inputValue(),/<Ctry>GB<\/Ctry>/);
 assert.match(await page.getByTestId('postal-result-status').textContent(),/Converted/);

 // Never silently infer a country solely because London appears in a pasted line.
 await page.getByLabel('Postal address input').fill('55 Mark Lane, London, EC3R 7NE');
 await page.getByRole('button',{name:'Convert postal address',exact:true}).click();
 assert.match(await page.getByTestId('postal-result-status').textContent(),/Review required/);
 assert.ok(!(await output.inputValue()).includes('<Ctry>GB</Ctry>'));

 // Extract debtor and creditor postal elements from ISO Document without sending anywhere.
 await page.getByLabel('Postal address input').fill('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.14"><FIToFICstmrCdtTrf><CdtTrfTxInf><Dbtr><Nm>PARTY A</Nm><PstlAdr><StrtNm>Mark Lane</StrtNm><BldgNb>55</BldgNb><TwnNm>London</TwnNm><Ctry>GB</Ctry></PstlAdr></Dbtr><Cdtr><Nm>PARTY B</Nm><PstlAdr><TwnNm>Paris</TwnNm><Ctry>FR</Ctry><AdrLine>15 Rue Example</AdrLine></PstlAdr></Cdtr></CdtTrfTxInf></FIToFICstmrCdtTrf></Document>');
 await page.getByRole('button',{name:'Convert postal address',exact:true}).click();
 const xml=await output.inputValue();
 assert.match(xml,/<StrtNm>Mark Lane<\/StrtNm>/);
 assert.match(xml,/<TwnNm>Paris<\/TwnNm>/);
 assert.match(xml,/<AdrLine>15 Rue Example<\/AdrLine>/);
 assert.match(await page.getByTestId('postal-result-status').textContent(),/2 address/);

 await page.getByRole('button',{name:/ISO 20022 MX messages/}).click();
 assert.equal(await page.getByRole('button',{name:'Convert to MT'}).count(),1);
 await page.setViewportSize({width:375,height:812});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('POSTAL CONVERTER PASS: placement, structured XML result, missing country, MX parties and mobile');
}finally{await browser.close()}
