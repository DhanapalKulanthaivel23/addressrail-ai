// Provider and Turnstile are mocked here; this is not evidence of a real Gemini call.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext();const page=await context.newPage();let requests=0,mode='success',last;
 await page.route('https://addressrail-ai.onrender.com/api/config',route=>route.fulfill({json:{aiEnabled:true,turnstileSiteKey:'test-site'}}));
 await page.route('https://challenges.cloudflare.com/turnstile/**',route=>route.fulfill({contentType:'application/javascript',body:`window.turnstile={render:(el,o)=>{setTimeout(()=>o.callback('mock-human'),0);return 'test-widget'},remove:()=>{},reset:()=>{}};`}));
 const source={id:'WB-EXECUTION',topic:'Synthetic execution scope',url:'https://www.iso20022.org/iso-20022-message-definitions',summary:'Educational context only.',reviewed:'2026-10-19',score:0.5};
 let release;
 await page.route('https://addressrail-ai.onrender.com/api/ai-explain',async route=>{
  requests++;last=route.request().postDataJSON();
  if(mode==='delayed')await new Promise(resolve=>{release=resolve});
  if(mode==='quota')return route.fulfill({status:429,json:{detail:'Public demo AI quota reached.'}});
  if(mode==='malformed')return route.fulfill({json:{mode:'fallback',model:null}});
  if(mode==='fallback')return route.fulfill({json:{mode:'deterministic_fallback',model:null,citationIds:[],retrieval:[source],advice:{summary:'Rejected unsupported provider claim.',actions:['Review manually'],cautions:['Human review required.']}}});
  if(mode==='bad-source')return route.fulfill({json:{mode:'gemini',model:'mock',retrieval:[{...source,url:'javascript:alert(1)'}],advice:{summary:'Review',actions:[],cautions:[]}}});
  return route.fulfill({json:{mode:'gemini',model:'mock-gemini-model',humanReviewRequired:true,framework:'LangGraph',promptVersion:'workbench-review-v2',knowledgeVersion:'mock-knowledge',
   citationIds:['WB-EXECUTION'],retrieval:[source],toolTrace:[{tool:'explain_findings',readOnly:true},{tool:'retrieve_sources',readOnly:true}],
   advice:{summary:'Review fictional checks',actions:['Review manually'],cautions:['No scheme validation']}}});
 });
 await page.goto((process.env.WORKBENCH_URL || 'http://127.0.0.1:8765/studio/workbench/'));
 await page.locator('aside .subproducts button[aria-current="page"]').click();
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
  assert.match(await page.getByTestId('rag-sources').textContent(),/Cited by Gemini/);
  assert.equal(await page.getByTestId('rag-sources').getByRole('link').getAttribute('href'),source.url);
  await page.getByText('How this explanation was produced',{exact:true}).click();
  assert.match(await page.locator('.gemini-panel').textContent(),/LangGraph/);
  await page.getByRole('button',{name:'Mark explanation reviewed',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Explanation reviewed in this view'}).isDisabled(),true);
 }
 for(const [rail,label] of [['gpi','SWIFT gpi Tracker'],['chaps','CHAPS'],['bacs-debit','Bacs Direct Debit'],['t2','T2 (Eurosystem RTGS)'],['cls','CLS FX settlement']]){
  // Keep the synthetic-only existing test contract across non-SEPA contexts.
  await page.locator('aside details').evaluateAll(nodes=>nodes.forEach(node=>node.open=true));
  const buttons=page.locator('.subproducts button');
  const index=await buttons.evaluateAll((els,name)=>els.findIndex(el=>el.textContent?.includes(name)),label);
  assert.ok(index>=0,'Missing registered rail navigation '+label);
  await buttons.nth(index).click();
  await run.click();await page.getByRole('button',{name:'Review / Ask Gemini'}).click();
  await consent.check();
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
  await ask.click();
  await page.getByText('Gemini response received. Human review required.',{exact:true}).waitFor();
  assert.equal(last.analysis.rail,rail);
  assert.deepEqual(Object.keys(last.analysis).sort(),['finding_codes','product','rail','stages','synthetic']);
  assert.match(await provenance.textContent(),/GEMINI · provider: Google/);
 }
 for(const failure of ['quota','malformed','fallback','bad-source']){
  await consent.uncheck();await consent.check();mode=failure;
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
  await ask.click();await page.getByText(/Local deterministic fallback retained/).waitFor();
  assert.match(await provenance.textContent(),/DETERMINISTIC_FALLBACK/);
  assert.doesNotMatch(await provenance.textContent(),/Review fictional checks/);
  assert.doesNotMatch(await provenance.textContent(),/Cited by Gemini/);
  if(failure==='fallback')assert.match(await page.getByTestId('rag-sources').textContent(),/Retrieved context only/);
  if(failure==='bad-source')assert.equal(await page.getByTestId('rag-sources').count(),0);
 }
 await consent.uncheck();await consent.check();mode='delayed';
 await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Ask Gemini')?.disabled);
 await ask.click();await page.getByText('Asking Gemini…',{exact:true}).last().waitFor();
 await page.getByRole('button',{name:'Payment testing',exact:true}).click();await page.getByRole('button',{name:'Load error fixture'}).click();await run.click();
 release();await page.getByRole('button',{name:'Review / Ask Gemini'}).click();
 assert.match(await provenance.textContent(),/DETERMINISTIC_FALLBACK/);assert.equal(await consent.isChecked(),false);
 console.log('GEMINI WORKBENCH PASS: original five plus representative cross-rail contexts, opt-in, minimal payload, provider provenance, quota/malformed failure, stale response isolation (mocked provider)');
}finally{await browser.close()}
