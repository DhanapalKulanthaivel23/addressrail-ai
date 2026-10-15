/**
 * Headless, local-only end-to-end smoke of the PUBLIC static guest experience.
 * Run with: npm install --no-save playwright && npx playwright install chromium
 * then start: python3 -m http.server 8765 --directory web --bind 127.0.0.1
 * and: node tests/browser-smoke.mjs
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {chromium} from "playwright";
const base="http://127.0.0.1:8765";
const browser=await chromium.launch({headless:true});
const exceptions=[];
try{
 const context=await browser.newContext({acceptDownloads:true,viewport:{width:1366,height:900}});
 const page=await context.newPage();
 page.on("pageerror",error=>exceptions.push("desktop: "+error.message));
 await page.goto(base+"/studio/payment-intelligence/",{waitUntil:"load"});
 await page.locator("#rail option").first().waitFor({state:"attached"});
 assert.equal(await page.locator("#rail option").count(),43);
 assert.deepEqual(await page.locator("#currency option").allTextContents(),["EUR","GBP","SEK","PLN","DKK"]);
 await page.selectOption("#currency","SEK");
 assert.equal((JSON.parse(await page.locator("#json-editor").inputValue())).currency,"SEK");
 await page.locator("#validate").click();
 assert.equal(await page.locator("#download-report").isDisabled(),false);
 const reportWait=page.waitForEvent("download");
 await page.locator("#download-report").click();
 const reportDownload=await reportWait;
 assert.match(reportDownload.suggestedFilename(),/synthetic-investigation\.json$/);
 const exported=JSON.parse(await readFile(await reportDownload.path(),"utf8"));
 assert.equal(exported.currency,"SEK");
 assert.equal(exported.rail.id,"cbpr");
 const messageWait=page.waitForEvent("download");
 await page.locator("#download-message").click();
 const messageDownload=await messageWait;
 assert.match(await readFile(await messageDownload.path(),"utf8"),/Ccy="SEK"/);
 await page.locator("#send-case").click();
 await page.waitForURL("**/studio/open-demo/#import-intelligence");
 await page.locator("#entry-form button[type=submit]").click();
 await page.locator("#workspace").waitFor({state:"visible"});
 assert.equal(await page.locator("#import-intelligence").isDisabled(),false);
 await page.locator("#import-intelligence").click();
 assert.match(await page.locator("#action-status").textContent(),/imported as/);
 assert.equal(await page.locator("#import-intelligence").isDisabled(),true);
 assert.match(await page.locator("#case-list").textContent(),/SWIFT CBPR\+/);
 assert.match(await page.locator("#case-list").textContent(),/SEK|Cross-rail/);
 const caseWait=page.waitForEvent("download");
 await page.locator("#export-case").click();
 const caseDownload=await caseWait;
 const caseJson=JSON.parse(await readFile(await caseDownload.path(),"utf8"));
 assert.equal(caseJson.case.currency,"SEK");
 assert.equal(caseJson.case.intelligence.railId,"cbpr");
 const isolated=await browser.newContext({viewport:{width:1280,height:800}});
 const privatePage=await isolated.newPage();
 privatePage.on("pageerror",error=>exceptions.push("isolated: "+error.message));
 await privatePage.goto(base+"/studio/open-demo/");
 await privatePage.locator("#entry-form button[type=submit]").click();
 assert.equal(await privatePage.locator("#import-intelligence").isDisabled(),true);
 assert.doesNotMatch(await privatePage.locator("#case-list").textContent(),/SWIFT CBPR\+/);
 await isolated.close();
 const journeys=await browser.newContext({acceptDownloads:true,viewport:{width:1280,height:800}});
 const guided=await journeys.newPage();
 guided.on("pageerror",error=>exceptions.push("journeys: "+error.message));
 await guided.goto(base+"/studio/journeys/");
 await guided.locator("#map-rail option").first().waitFor({state:"attached"});
 assert.equal(await guided.locator("#map-rail option").count(),43);
 assert.equal(await guided.locator("#journey-select option").count(),6);
 await guided.locator('[data-mode="professional"]').click();
 assert.equal(await guided.locator('[data-mode="professional"]').getAttribute("aria-pressed"),"true");
 await guided.selectOption("#map-rail","chaps");
 assert.match(await guided.locator("#map-neighbours").textContent(),/Bank of England RTGS/);
 await guided.locator('[data-mode="ai"]').click();
 assert.match(await guided.locator("#ai-boundary").textContent(),/SCRIPTED/);
 await guided.selectOption("#journey-select","sct-inst");
 await guided.selectOption("#scenario-select","timeout");
 assert.equal(await guided.locator("#stage-list li").count(),5);
 assert.equal(await guided.locator("#stage-list button:disabled").count(),1);
 for(let i=0;i<3;i++)await guided.locator("#step-next").click();
 assert.equal(await guided.locator("#step-next").isDisabled(),true);
 assert.match(await guided.locator("#scenario-outcome").textContent(),/UNKNOWN/);
 assert.equal(await guided.locator("#journey-evidence article").count(),5);
 await guided.locator("#run-journey-checks").click();
 assert.match(await guided.locator("#journey-findings").textContent(),/SIM-SCT_INST-TIMEOUT/);
 await guided.locator("#sample-message").click();
 assert.match(await guided.locator("#journey-message").textContent(),/EDUCATIONAL/);
 await guided.locator("#quiz-options button").nth(1).click();
 assert.match(await guided.locator("#quiz-result").textContent(),/Correct/);
 const journeyDownloadWait=guided.waitForEvent("download");
 await guided.locator("#download-journey").click();
 const journeyDownload=await journeyDownloadWait;
 const exportedJourney=JSON.parse(await readFile(await journeyDownload.path(),"utf8"));
 assert.equal(exportedJourney.journey,"sct-inst");
 assert.equal(exportedJourney.assessment.paymentStatus,"UNKNOWN");
 assert.equal(exportedJourney.aiReplay.liveModel,false);
 await guided.locator("#handoff-journey").click();
 await guided.waitForURL("**/studio/open-demo/#import-intelligence");
 await guided.locator("#entry-form button[type=submit]").click();
 await guided.locator("#import-intelligence").click();
 assert.match(await guided.locator("#action-status").textContent(),/imported as/);
 const startPage=await journeys.newPage();
 startPage.on("pageerror",error=>exceptions.push("start: "+error.message));
 await startPage.goto(base+"/studio/start/");
 assert.equal(await startPage.locator("#lesson-grid article").count(),5);
 assert.equal(await startPage.locator("#glossary-cards article").count(),12);
 await startPage.locator("#lesson-grid input[type=checkbox]").first().check();
 assert.match(await startPage.locator("#progress-message").textContent(),/1 of 5/);
 const startCheck=await journeys.newPage();
 await startCheck.goto(base+"/studio/start/");
 assert.match(await startCheck.locator("#progress-message").textContent(),/0 of 5/);
 await startPage.reload();
 assert.match(await startPage.locator("#progress-message").textContent(),/1 of 5/);
 await startCheck.close();
 const instant=await journeys.newPage();
 instant.on("pageerror",error=>exceptions.push("instant: "+error.message));
 await instant.goto(base+"/studio/sct-inst/?scenario=timeout");
 assert.equal(await instant.locator("#case-scenario").inputValue(),"timeout");
 assert.match(await instant.locator("#case-outcome").textContent(),/UNKNOWN/);
 assert.match(await instant.locator("#case-rules").textContent(),/SIM-SCT_INST-TIMEOUT/);
 await instant.selectOption("#case-route","TIPS");
 assert.match(await instant.locator("#case-events").textContent(),/TIPS/);
 await instant.locator("#case-download").click();
 const chapsCase=await journeys.newPage();
 chapsCase.on("pageerror",error=>exceptions.push("chaps-v2: "+error.message));
 await chapsCase.goto(base+"/studio/chaps/?scenario=liquidity-hold#case-lab");
 assert.match(await chapsCase.locator("#case-outcome").textContent(),/PENDING/);
 assert.match(await chapsCase.locator("#case-rules").textContent(),/SIM-CHAPS-LIQUIDITY_HOLD/);
 const ai=await journeys.newPage();
 ai.on("pageerror",error=>exceptions.push("ai-v2: "+error.message));
 await ai.goto(base+"/studio/ai-lab/");
 assert.equal(await ai.locator("#fixture option").count(),8);
 assert.match(await ai.locator("#decision").textContent(),/REJECT/);
 assert.equal(await ai.locator("#pass-count").textContent(),"8/8");
 await ai.selectOption("#fixture","INSTANT_CAUTION");
 assert.match(await ai.locator("#decision").textContent(),/ALLOW/);
 await ai.fill("#model-claim","The payment is settled.");
 await ai.locator("#check-claim").click();
 assert.match(await ai.locator("#decision").textContent(),/AI-G01/);
 const commentsPage=await journeys.newPage();
 commentsPage.on("pageerror",error=>exceptions.push("comments: "+error.message));
 const commentPaths=[
  "/","/studio/","/studio/start/","/studio/journeys/",
  "/studio/payment-intelligence/","/studio/sepa-sct/","/studio/sct-inst/",
  "/studio/chaps/","/studio/ai-lab/","/studio/open-demo/", "/studio/sdd/", "/studio/fps/", "/studio/bacs/", "/studio/t2/", "/studio/cbpr/", "/studio/cls/",
  "/mt103-address-correction/","/iso20022-structured-address/",
  "/pacs008-address-validation/","/cbpr-address-guide/"
 ];
 for(const path of commentPaths){
  await commentsPage.goto(base+path);
  await commentsPage.locator("#comments .ra-comment-form").waitFor({state:"attached"});
  assert.equal(await commentsPage.locator("#comments").count(),1,path);
  assert.equal(await commentsPage.locator("#ra-comment-name").count(),1,path);
  assert.equal(await commentsPage.locator("#ra-comment-message").count(),1,path);
  assert.equal(await commentsPage.locator("#comments .ra-comment-submit").isDisabled(),true,
   "Local visitor must not get a fake shared-comment submission: "+path);
  assert.match(await commentsPage.locator("#comments .ra-comment-feedback").textContent(),/deployed site/i);
 }
 await commentsPage.close();
 await journeys.close();
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
  deviceScaleFactor:2,hasTouch:true,acceptDownloads:true});
 const small=await mobile.newPage();
 small.on("pageerror",error=>exceptions.push("mobile: "+error.message));
 await small.goto(base+"/studio/payment-intelligence/");
 await small.locator("#rail option").first().waitFor({state:"attached"});
 const overflow=await small.evaluate(()=>({
  documentWidth:document.documentElement.scrollWidth,screenWidth:window.innerWidth
 }));
 assert.ok(overflow.documentWidth<=overflow.screenWidth+2,
  "Mobile horizontal overflow: "+JSON.stringify(overflow));
 await small.fill("#search-rails","SOME-UNMATCHABLE-SERVICE-NAME");
 assert.equal(await small.locator("#rail option").count(),0);
 assert.equal(await small.locator("#validate").isDisabled(),true);
 await small.fill("#search-rails","");
 assert.equal(await small.locator("#rail option").count(),43);
 assert.equal(await small.locator("#validate").isDisabled(),false);
 await small.selectOption("#region","EU national");
 await small.selectOption("#rail","pl-elixir");
 assert.deepEqual(await small.locator("#currency option").allTextContents(),["PLN"]);
 await small.locator("#validate").click();
 assert.equal(await small.locator("#download-report").isDisabled(),false);
 await small.goto(base+"/studio/journeys/");
 await small.locator("#journey-select option").first().waitFor({state:"attached"});
 const journeyOverflow=await small.evaluate(()=>({documentWidth:document.documentElement.scrollWidth,screenWidth:window.innerWidth}));
 assert.ok(journeyOverflow.documentWidth<=journeyOverflow.screenWidth+2,
   "Journey mobile overflow: "+JSON.stringify(journeyOverflow));
 await small.locator('[data-mode="learner"]').click();
 await small.selectOption("#journey-select","bacs-debit");
 await small.selectOption("#scenario-select","mandate");
 assert.match(await small.locator("#journey-intro").textContent(),/batch/i);
 await small.goto(base+"/studio/start/");
 const startWidth=await small.evaluate(()=>({actual:document.documentElement.scrollWidth,expected:window.innerWidth}));
 assert.ok(startWidth.actual<=startWidth.expected+2,"Start Here horizontal overflow: "+JSON.stringify(startWidth));
 await small.goto(base+"/studio/ai-lab/");
 const aiWidth=await small.evaluate(()=>({actual:document.documentElement.scrollWidth,expected:window.innerWidth}));
 assert.ok(aiWidth.actual<=aiWidth.expected+2,"AI Lab horizontal overflow: "+JSON.stringify(aiWidth));
 await mobile.close();
 assert.deepEqual(exceptions,[]);
 console.log("BROWSER PASS: six-journey modes, mapping, failure-stage evidence, AI replay, quiz, JSON and guest import; desktop five-currency validation, JSON/message export, same-tab handoff, isolated visitor, mobile controls, no runtime errors");
}finally{
 await browser.close();
}
