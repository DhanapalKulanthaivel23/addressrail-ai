import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buildChapsExample,escapeXml} from "../web/studio/chaps/core.mjs";

test("CHAPS customer sketch uses correct pacs.008 namespace",()=>{
 const xml=buildChapsExample("customer","250000.00");
 assert.match(xml,/pacs\.008\.001\.08/);
 assert.match(xml,/<FIToFICstmrCdtTrf>/);
 assert.match(xml,/<IntrBkSttlmAmt Ccy="GBP">250000\.00<\/IntrBkSttlmAmt>/);
 assert.match(xml,/NOT CHAPS\/XSD CONFORMANT/);
 assert.doesNotMatch(xml,/<FICdtTrf>/);
});
test("CHAPS FI sketch identifies CORE transfer separately from cover",()=>{
 const xml=buildChapsExample("institution","1500000.00");
 assert.match(xml,/pacs\.009\.001\.08/);
 assert.match(xml,/<FICdtTrf>/);
 assert.match(xml,/SYNTHETIC SENDING BANK/);
 assert.doesNotMatch(xml,/<FIToFICstmrCdtTrf>/);
});
test("amount guardrails and XML escaping",()=>{
 assert.throws(()=>buildChapsExample("customer","0.00"),/positive/);
 assert.throws(()=>buildChapsExample("customer","-1.00"),/positive/);
 assert.throws(()=>buildChapsExample("customer","1.234"),/positive/);
 assert.throws(()=>buildChapsExample("customer",'<script>'),/positive/);
 assert.throws(()=>buildChapsExample("cover","125.00"),/Choose/);
 assert.equal(escapeXml("A&B <C>"),"A&amp;B &lt;C&gt;");
});
test("public page includes non-conformance warnings and local-only lab pointer",()=>{
 const h=readFileSync("web/studio/chaps/index.html","utf8");
 const js=readFileSync("web/studio/chaps/lab.mjs","utf8");
 assert.match(h,/deliberately incomplete teaching sketch/);
 assert.match(h,/Bank of England/);
 assert.match(h,/payments-core\/README.md/);
 assert.doesNotMatch(js,/fetch\(/);
 assert.doesNotMatch(js,/innerHTML\s*=/);
});
