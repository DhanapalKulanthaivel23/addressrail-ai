/** AR-101/102/105/106 + G-01,G-03,G-04,G-05,G-07,G-08,G-12 browser acceptance
 * Local-only synthetic data; run alongside the existing browser-smoke script.
 */
import assert from "node:assert/strict";
import {chromium} from "playwright";
const browser=await chromium.launch({headless:true});
const base="http://127.0.0.1:8765";
const routes=[
 "/", "/studio/", "/studio/start/", "/studio/journeys/",
 "/studio/payment-intelligence/", "/studio/sepa-sct/", "/studio/sct-inst/",
 "/studio/chaps/", "/studio/ai-lab/", "/studio/open-demo/",
 "/mt103-address-correction/", "/iso20022-structured-address/",
 "/pacs008-address-validation/", "/cbpr-address-guide/"
];
const deep=[
 ["/studio/?module=chaps","studio","chaps"],
 ["/studio/journeys/?mode=professional&rail=chaps&scenario=liquidity-hold","journeys","liquidity-hold"],
 ["/studio/journeys/?mode=ai&rail=sct-inst&scenario=timeout","journeys","timeout"],
 ["/studio/sct-inst/?scenario=timeout","instant","timeout"],
 ["/studio/chaps/?scenario=liquidity-hold#case-lab","chaps","liquidity-hold"],
 ["/studio/ai-lab/?case=INSTANT_UNKNOWN","ai","INSTANT_UNKNOWN"],
 ["/studio/payment-intelligence/?beginner=1","catalogue","essentials"]
];
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:1280,height:800}});
 const page=await context.newPage();
 page.on("pageerror",err=>errors.push("main: "+err.message));
 for(const path of routes){
  const response=await page.goto(base+path,{waitUntil:"load"});
  assert.equal(response.status(),200,path);
  await page.locator("#ar-shared-nav").waitFor({state:"attached"});
  assert.equal(await page.locator("#ar-shared-nav .ar-nav-pages a").count(),14,path);
  assert.equal(await page.locator("#ar-shared-nav [aria-current=page]").count(),1,path);
  assert.equal(await page.locator("h1").count(),1,path);
  const expected=new URL(base+path).pathname;
  const canonical=await page.locator('link[rel="canonical"]').getAttribute("href");
  assert.equal(new URL(canonical).pathname,"/addressrail-ai"+expected,path);
  assert.match(await page.title(),/AddressRail AI/);
  assert.match(await page.locator(".ar-site-metadata").textContent(),/Reviewed 15 October 2026/);
  assert.equal(await page.locator(".ar-trust-box p").count(),3,path);
  assert.match(await page.locator("footer").textContent(),/v2\.1/);
 }
 assert.equal(routes.length+deep.length,21);
 for(const [route,kind,value] of deep){
  await page.goto(base+route);
  await page.locator("#ar-shared-nav").waitFor({state:"attached"});
  if(kind==="studio")assert.equal(await page.locator("#rail").inputValue(),value);
  if(kind==="journeys"){
   assert.equal(await page.locator("#scenario-select").inputValue(),value);
   assert.equal(await page.locator("#ar-role").inputValue(),
     new URL(base+route).searchParams.get("mode"));
  }
  if(kind==="instant"||kind==="chaps")assert.equal(await page.locator("#case-scenario").inputValue(),value);
  if(kind==="ai")assert.equal(await page.locator("#fixture").inputValue(),value);
  if(kind==="catalogue")assert.equal(await page.locator("#beginner-mode").inputValue(),value);
 }
 await page.goto(base+"/studio/?mode=professional");
 await page.locator("#ar-role").waitFor({state:"attached"});
 assert.equal(await page.locator("#ar-role").inputValue(),"professional");
 await page.selectOption("#ar-role","ai");
 assert.match(new URL(page.url()).search,/mode=ai/);
 await page.goBack();
 assert.equal(await page.locator("#ar-role").inputValue(),"professional");
 await page.goForward();
 assert.equal(await page.locator("#ar-role").inputValue(),"ai");
 await page.goto(base+"/studio/chaps/");
 assert.equal(await page.locator("#ar-role").inputValue(),"ai");
 await page.goto(base+"/studio/journeys/?mode=learner");
 assert.equal(await page.locator("#ar-role").inputValue(),"learner");
 for(const path of ["/studio/chaps/","/studio/sct-inst/","/iso20022-structured-address/","/cbpr-address-guide/"]){
  await page.goto(base+path);
  assert.match(await page.locator(".ar-address-status").textContent(),/EPC/);
  assert.equal(await page.locator(".ar-address-status a").count(),3);
 }
 const blocked=await browser.newContext({viewport:{width:360,height:740}});
 await blocked.addInitScript(()=>{Object.defineProperty(window,"localStorage",{configurable:true,get(){throw Error("blocked")}})});
 const blockedPage=await blocked.newPage();
 await blockedPage.goto(base+"/studio/ai-lab/?mode=ai");
 await blockedPage.locator("#ar-role").waitFor({state:"attached"});
 assert.equal(await blockedPage.locator("#ar-role").inputValue(),"ai");
 assert.match(await blockedPage.locator(".ar-mode-hint").textContent(),/unavailable/);
 await blockedPage.selectOption("#ar-role","learner");
 assert.equal(await blockedPage.locator("#ar-role").inputValue(),"learner");
 await blocked.close();
 for(const width of [360,768,1280,1920]){
  await page.setViewportSize({width,height:800});
  for(const path of ["/","/studio/","/studio/journeys/"]){
   await page.goto(base+path);
   const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert.ok(sizes.scroll<=sizes.width+2,path+" at "+width+"px: "+JSON.stringify(sizes));
  }
 }
 await context.close();
 assert.deepEqual(errors,[]);
 console.log("ACCEPTANCE PASS: 14 pages + 7 deep links, role navigation, source status, storage-blocked, 360/768/1280/1920 viewports");
}finally{await browser.close()}
