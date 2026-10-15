import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const pages=[
 "/", "/studio/", "/studio/start/", "/studio/journeys/",
 "/studio/payment-intelligence/", "/studio/sepa-sct/", "/studio/sct-inst/",
 "/studio/chaps/", "/studio/ai-lab/", "/studio/open-demo/",
 "/mt103-address-correction/", "/iso20022-structured-address/",
 "/pacs008-address-validation/", "/cbpr-address-guide/"
];
const path=uri=>"web"+(uri==="/"?"/index.html":uri+"index.html");
const script=readFileSync("web/site-shell.js","utf8");
test("AR-101 AR-102 AR-205 AR-206 AR-207: every content page uses one shell and trust box",()=>{
 assert.equal(pages.length,14);
 for(const url of pages){
  const html=readFileSync(path(url),"utf8");
  assert.equal((html.match(/site-shell.js/g)||[]).length,1,url);
  assert.equal((html.match(/site-shell.css/g)||[]).length,1,url);
  assert.match(html,/<title>/);
  assert.match(html,/<h1[^>]*>/);
  assert.match(html,/<link rel="canonical"/);
 }
 for(const mode of ["professional","ai","learner"])assert.match(script,new RegExp(mode));
 for(const id of ["ar-shared-nav","ar-role","ar-footer-version","ar-trust-box","ar-address-status"])
  assert.ok(script.includes(id),id);
 assert.match(script,/aria-current/);
 assert.match(script,/localStorage/);
 assert.match(script,/try\{/);
 assert.match(script,/popstate/);
 assert.match(script,/addressrail:mode/);
 assert.match(script,/content-error\.yml/);
 assert.doesNotMatch(script,/innerHTML\s*=/);
});
test("AR-103 AR-104: homepage has 3 goals and one dated Studio changelog",()=>{
 const home=readFileSync("web/index.html","utf8");
 const studio=readFileSync("web/studio/index.html","utf8");
 for(const title of ["Show a demo","Explain AI","Learn →"])assert.ok(home.includes(title),title);
 assert.match(home,/id="demo"/);
 assert.match(home,/<main id="home">/);
 assert.doesNotMatch(home,/\bexisting\b/i);
 assert.equal((studio.match(/id="whats-new"/g)||[]).length,1);
 assert.equal((studio.match(/class="notice"/g)||[]).length,1);
 assert.match(studio,/15 October 2026/);
 assert.doesNotMatch(studio,/>\s*NEW —/);
});
test("AR-201 AR-202 AR-203 AR-204: source-dated status and legacy guide not blanket migration claims",()=>{
 const status=readFileSync("web/site-shell.js","utf8");
 for(const s of ["27 August 2026","9 September 2026","30 September 2026","No revised release date",
 "bankofengland.co.uk/news/2026","swift.com/fr/node/310752"])
  assert.ok(status.includes(s),s);
 const guide=readFileSync("web/mt103-address-correction/index.html","utf8");
 assert.match(guide,/22 November 2025/);
 assert.match(guide,/contingency translation/);
 assert.match(guide,/:50F:/);
 const pacs=readFileSync("web/pacs008-address-validation/index.html","utf8");
 assert.match(pacs,/TwnNm/);
 const iso=readFileSync("web/iso20022-structured-address/index.html","utf8");
 for(const x of ["Hybrid-style teaching example","AdrLine","TwnNm","Ctry"])assert.ok(iso.includes(x));
});
