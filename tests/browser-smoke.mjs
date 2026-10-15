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
 await page.locator("#rail option").first().waitFor();
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
 await context.close();
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,
  deviceScaleFactor:2,hasTouch:true,acceptDownloads:true});
 const small=await mobile.newPage();
 small.on("pageerror",error=>exceptions.push("mobile: "+error.message));
 await small.goto(base+"/studio/payment-intelligence/");
 await small.locator("#rail option").first().waitFor();
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
 await mobile.close();
 assert.deepEqual(exceptions,[]);
 console.log("BROWSER PASS: desktop five-currency validation, JSON/message export, same-tab handoff, isolated visitor, mobile controls, no runtime errors");
}finally{
 await browser.close();
}
