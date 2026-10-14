import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page=readFileSync("web/studio/index.html","utf8");
const script=readFileSync("web/studio/studio.js","utf8");
const home=readFileSync("web/index.html","utf8");
test("studio has all working interaction roots",()=>{
 for(const id of ["rail","scenario","simulate","trace","flow-title","flow-description","rail-meta","references","scenario-result","question","answers","quiz-feedback","module-nav","trace-demo","agent-trace"]){
  assert.match(page,new RegExp('id="'+id+'"'));
 }
});
test("scheme modules are separate learning journeys",()=>{
 for(const id of ["sepa","sctinst","chaps","bacs","t2","fps","cbpr","cls"])
   assert.match(script,new RegExp('id:"'+id+'"'));
});
test("website links back and forth",()=>{
 assert.match(home,/href="studio\//);
 assert.match(page,/href="\.\.\/"/);
 assert.match(page,/href="\.\.\/#ai"/);
});
test("browser demo is explicitly synthetic and avoids dynamic HTML injection",()=>{
 assert.match(page,/No actual payment is transmitted/);
 assert.match(script,/ILLUSTRATIVE EXCEPTION/);
 assert.doesNotMatch(script,/\.innerHTML\s*=/);
 assert.doesNotMatch(script,/fetch\(/);
});
