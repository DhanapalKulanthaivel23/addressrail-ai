// Provider and Turnstile are mocked here; this is not evidence of a real Gemini call.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();let requests=0,mode='success',last;
 await page.route('https://addressrail-ai.onrender.com/api/config',route=>route.fulfill({json:{aiEnabled:true,turnstileSiteKey:'test-site'}}));
 await page.route('https://challenges.cloudflare.com/turnstile/**',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('mock-human'),0);return 'test-widget'},remove:()=>{},reset:()=>{}};`}));
 let release;
 await page.route('https://addressrail-ai.onrender.com/api/ai-explain',async route=>{
  requests++;last=route.request().postDataJSON();
  if(mode==='delayed')await new Promise(resolve=>{release=resolve});
  if(mode==='quota')return route.fulfill({status:429,json:{detail:'Public demo AI quota reached.'}});
  if(mode==='malformed')return route.fulfill({json:{mode:'fallback',model:null}});
  return route.fulfill({json:{mode:'gemini',model:'mock-gemini-model',advice:{summary:'Review fictional checks',actions:['Review manually'],cautions:['No scheme validation']}}});
 });
 await page.goto((process.env.WORKBENCH_URL || 'http://127.0.0.1:8765/studio/workbench/'));
 const run=page.getByRole('button',{name:'Validate / simulate checks'});
 const ask=page.getByRole('button',{name:'Ask Gemini',exact:true});
 const provenance=page.getByTestId('gemini-provenance');
 const consent=page.getByRole('checkbox');
 for(const [id,name] of [['cbpr','CBPR+'],['sct','SEPA Credit Transfer (SCT)'],['sct-inst','SEPA Instant Credit Transfer (SCT Inst)'],['sdd-core','SEPA Direct Debit Core'],['sdd-b2b','SEPA Direct Debit B2B']]){
  if(id!=='cbpr'){
   await page.locator('details').filter({has:page.locator('summary').filter({hasText:'SEPA'})}).evaluate(el=>el.open=true);
   // Resolve display names from the registry-backed buttons, allowing catalog wording.
   const buttons=page.locator('.subproducts button');
   const target=await buttons.evaluateAll((els,rail)=>els.findIndex(el=>el.textContent.includes(rail)),name);
   if(target<0){const index={sct:0,'sct-inst':1,'sdd-core':2,'sdd-b2b':3}[id];await page.locator('details').filter({has:page.locator('summary').filter({hasText:'SEPA'})}).locator('button').nth(index).click()}
   else await buttons.nth(target).click();
  }
  await run.click();await page.getByRole('button',{name:'Review / Ask Gemini'}).click();
  assert.equal(await ask.isDisabled(),true);const before=requests;
  await consent.check();await ask.waitFor({state:'visible'});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
  assert.equal(requests,before);await ask.click();await page.getByText('Gemini response received. Human review required.',{exact:true}).waitFor();
  assert.equal(last.analysis.rail,id);assert.equal(last.turnstile_token,'mock-human');assert.equal(last.confirm_synthetic,true);
  assert.deepEqual(Object.keys(last.analysis).sort(),['finding_codes','product','rail','stages','synthetic']);
  assert.match(await provenance.textContent(),/GEMINI · provider: Google · model: mock-gemini-model/);
  assert.match(await provenance.textContent(),/no RAG citations/);
 }
 for(const failure of ['quota','malformed']){
  await consent.uncheck();await consent.check();mode=failure;
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
  await ask.click();await page.getByText(/Local deterministic fallback retained/).waitFor();
  assert.match(await provenance.textContent(),/DETERMINISTIC_FALLBACK/);
  assert.doesNotMatch(await provenance.textContent(),/Review fictional checks/);
 }
 await consent.uncheck();await consent.check();mode='delayed';
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
 await ask.click();await page.getByText('Asking Gemini…',{exact:true}).last().waitFor();
 await page.getByRole('button',{name:'Payment testing',exact:true}).click();await page.getByRole('button',{name:'Load error fixture'}).click();await run.click();
 release();await page.getByRole('button',{name:'Review / Ask Gemini'}).click();
 assert.match(await provenance.textContent(),/DETERMINISTIC_FALLBACK/);assert.equal(await consent.isChecked(),false);
 console.log('GEMINI WORKBENCH PASS: all five rails, opt-in, minimal payload, provider provenance, quota/malformed failure, stale response isolation (mocked provider)');
}finally{await browser.close()}
