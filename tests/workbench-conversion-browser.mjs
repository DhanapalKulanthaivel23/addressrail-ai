import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WORKBENCH_URL||'http://127.0.0.1:8765/studio/workbench/');
 await page.getByRole('button',{name:/SWIFT MT messages/}).click();
 let actions=page.locator('.gateway-actions button');
 assert.equal(await actions.first().textContent(),'Convert to MX');

 // Empty editor: click conversion directly, using only the known synthetic sample.
 await page.getByRole('button',{name:'Convert to MX'}).click();
 assert.ok((await page.getByLabel('MX message input').inputValue()).includes('pacs.008.001.14'));
 assert.match(await page.getByTestId('conversion-result').textContent(),/Converted to pacs\.008\.001\.14 draft/);
 assert.match(await page.getByTestId('conversion-result').textContent(),/Review/);
 assert.match(await page.getByTestId('raw-issues').textContent(),/SttlmInf/);
 assert.equal(await page.getByRole('button',{name:'Convert to MT'}).count(),1);
 await page.getByRole('button',{name:'Restore original MT'}).click();
 assert.match(await page.getByLabel('MT message input').inputValue(),/:20:AR-DEMO-103/);

 // Errors do not prevent an evidence-preserving partial XML draft.
 await page.getByRole('button',{name:'Try example with errors'}).click();
 await page.getByRole('button',{name:'Convert to MX'}).click();
 assert.ok((await page.getByLabel('MX message input').inputValue()).includes('<Document xmlns='));
 assert.equal(await page.getByTestId('conversion-result').count(),1);

 // XML -> FIN produces only text block, not fake network routing identifiers.
 await page.getByRole('button',{name:'Convert to MT'}).click();
 const text=await page.getByLabel('MT message input').inputValue();
 assert.match(text,/^\{4:\n/);
 assert.match(text,/:20:AR-DEMO-103/);
 assert.ok(!text.includes('{1:'));
 assert.ok(!text.includes('{2:'));
 assert.match(await page.getByTestId('conversion-result').textContent(),/No originating SWIFT header/);

 // Unsupported ISO 20022 families must not be fabricated as MT103.
 await page.getByRole('button',{name:/ISO 20022 MX messages/}).click();
 await page.getByLabel('MX message input').fill('<Document xmlns="urn:iso:std:iso:20022:tech:xsd:fxtr.014.001.05"><FxTradInstr/></Document>');
 await page.getByRole('button',{name:'Convert to MT'}).click();
 assert.match(await page.getByTestId('conversion-result').textContent(),/No verified translation pair/);
 assert.equal(await page.getByLabel('MX message input').count(),1);

 // FI->FI transfer support maps MT202 to pacs.009 then back to a visible MT draft.
 await page.getByRole('button',{name:/SWIFT MT messages/}).click();
 await page.getByLabel('MT message input').fill('{1:F01BANKGB2LAXXX}{2:I202BANKDEFFXXXXN}{4:\n:20:FI-001\n:21:RELATED-002\n:32A:261020USD14,25\n:58A:BANKDEFFXXX\n-}');
 await page.getByRole('button',{name:'Convert to MX'}).click();
 assert.match(await page.getByLabel('MX message input').inputValue(),/pacs\.009\.001\.12/);
 await page.getByRole('button',{name:'Convert to MT'}).click();
 assert.match(await page.getByLabel('MT message input').inputValue(),/:21:RELATED-002/);
 await page.setViewportSize({width:375,height:812});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);
 console.log('MT/MX CONVERSION BROWSER PASS: inline toolbar, MT103↔pacs.008, MT202↔pacs.009, erroneous source, strict no-invention, unsupported FX, restore & mobile.');
}finally{await browser.close()}
