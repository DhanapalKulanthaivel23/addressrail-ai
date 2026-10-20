import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
const errors=[];
try{
 const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.WORKBENCH_URL || 'http://127.0.0.1:8765/studio/workbench/'));
 await page.getByRole('button',{name:'Open existing payment workbench'}).click();
 const palette=await page.evaluate(()=>({
  background:getComputedStyle(document.body).backgroundColor,
  sidebar:getComputedStyle(document.querySelector('aside')).backgroundColor,
  header:getComputedStyle(document.querySelector('header')).backgroundColor
 }));
 assert.deepEqual(palette,{background:'rgb(245, 240, 232)',sidebar:'rgb(37, 35, 33)',header:'rgb(255, 254, 250)'});

 const run=page.getByRole('button',{name:'Validate / simulate checks'});
 await run.click();await page.getByRole('status').filter({hasText:'execution complete'}).waitFor();
 assert.match(await page.getByLabel('Output message').inputValue(),/assessment/);
 const exported=page.waitForEvent('download');await page.getByRole('button',{name:'Report',exact:true}).click();
 const report=JSON.parse(await readFile(await (await exported).path(),'utf8'));
 assert.equal(report.steps.length,2);assert.equal(report.synthetic,true);
 await page.locator('.tool-nav').getByRole('button',{name:'AML / Sanctions / Compliance'}).click();
 await page.getByRole('button',{name:'Screen current synthetic request'}).click();
 assert.match(await page.getByTestId('aml-result').textContent(),/FICTIONAL_EXACT_NAME/);
 assert.match(await page.getByTestId('aml-result').textContent(),/POTENTIAL_MATCH/);
 await page.getByLabel('Fictional watchlist name').fill('FICTIONAL TEST CANDIDATE');
 await page.getByRole('button',{name:'Add to temporary list'}).click();
 assert.match(await page.locator('.learning-list').textContent(),/FICTIONAL TEST CANDIDATE/);
 await page.locator('.tool-nav').getByRole('button',{name:'REST / MQ / Kafka / Files / SFTP'}).click();
 await page.getByLabel('Simulated channel').selectOption('KAFKA');
 await page.getByRole('button',{name:'Simulate channel flow'}).click();
 assert.match(await page.getByTestId('channel-result').textContent(),/SIMULATED_ONLY/);
 assert.match(await page.getByTestId('channel-result').textContent(),/FICTIONAL_CONSUME_ACK/);
 await page.getByRole('button',{name:'Simulate channel flow'}).click();
 assert.match(await page.getByTestId('channel-result').textContent(),/"duplicateInBrowserSession": true/);
 await page.getByRole('button',{name:'Payment testing',exact:true}).click();
 await page.getByRole('button',{name:'MT → MX',exact:true}).click();
 assert.equal(JSON.parse(await page.getByLabel('Output message').inputValue()).outcome,'BLOCKED');
 await page.getByRole('button',{name:'Load error fixture'}).click();await run.click();
 await page.getByRole('button',{name:'Validation',exact:true}).click();
 assert.match(await page.locator('section:not([hidden])').textContent(),/DEMO_BIC_FORMAT/);
 await page.getByRole('button',{name:'Payment testing',exact:true}).click();
 await page.getByLabel('Scenario',{exact:true}).selectOption('missing-town');await run.click();
 await page.getByRole('button',{name:'Approve correction & revalidate'}).click();
 await page.getByRole('button',{name:'AI explanation',exact:true}).click();
 assert.match(await page.locator('section:not([hidden])').textContent(),/REVALIDATED_INTERNAL_RULES/);
 assert.match(await page.locator('section:not([hidden])').textContent(),/DETERMINISTIC_FALLBACK/);
 await page.getByRole('button',{name:'Execution evidence',exact:true}).click();
 assert.equal(await page.locator('.react-flow__node').count(),2);
 await page.locator('.react-flow__node').first().click();
 assert.match(await page.getByTestId('step-detail').textContent(),/RECEIVED/);
 await page.locator('.react-flow__edge-interaction').click({force:true});
 assert.match(await page.getByTestId('step-detail').textContent(),/CHECKED/);
 await page.reload();await page.getByRole('button',{name:'Open existing payment workbench'}).click();await page.getByText('Recovered synthetic draft from IndexedDB').waitFor();
 assert.equal(JSON.parse(await page.getByLabel('Input message').inputValue()).creditor.address.town,'Paris');
 await page.getByRole('button',{name:'Clear saved session'}).click();await page.getByText('Saved synthetic session cleared').waitFor();
 await page.locator('summary').filter({hasText:'SEPA'}).click();
 await page.getByRole('button',{name:'SEPA Instant Credit Transfer (SCT Inst)',exact:true}).click();
 assert.equal(JSON.parse(await page.getByLabel('Input message').inputValue()).railId,'sct-inst');
 assert.equal(await page.getByLabel('Output message').inputValue(),'');
 await run.click();assert.match(await page.getByLabel('Output message').inputValue(),/sct-inst/);
 await page.getByLabel('Input message').fill('{invalid');await run.click();
 assert.match(await page.getByRole('status').textContent(),/JSON/);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/addressrail-workbench-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:'/tmp/addressrail-workbench-desktop.png',fullPage:true});
 const isolated=await browser.newContext();await isolated.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{get(){throw Error('blocked')}})});
 const blocked=await isolated.newPage();await blocked.goto((process.env.WORKBENCH_URL || 'http://127.0.0.1:8765/studio/workbench/'));
 await blocked.getByRole('button',{name:'Open existing payment workbench'}).click();
 await blocked.getByRole('button',{name:'Validate / simulate checks'}).click();
 await blocked.getByRole('status').filter({hasText:'execution complete'}).waitFor();
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('WORKBENCH PASS: fixtures, negative findings, blocked conversion, correction revalidation, flow nodes/arrows, AI status, IndexedDB recovery/clear, blocked storage and mobile layout');
}finally{await browser.close()}
