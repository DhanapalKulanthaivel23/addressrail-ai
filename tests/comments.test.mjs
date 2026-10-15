import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";
const root="web";
const pages=[
 "index.html","studio/index.html","studio/start/index.html",
 "studio/journeys/index.html","studio/payment-intelligence/index.html",
 "studio/sepa-sct/index.html","studio/sct-inst/index.html",
 "studio/chaps/index.html","studio/ai-lab/index.html",
 "studio/open-demo/index.html","mt103-address-correction/index.html",
 "iso20022-structured-address/index.html","pacs008-address-validation/index.html",
 "cbpr-address-guide/index.html"
];
const code=readFileSync("analytics/worker.js","utf8");
const {default:worker}=await import("data:text/javascript;base64,"+Buffer.from(code).toString("base64"));
const origin="https://dhanapalkulanthaivel23.github.io",service="https://comments.example";
function request(path,opts={}){return new Request(service+path,opts)}
function fakeDb(){
 const calls=[];
 return {calls,prepare:sql=>({
  bind:(...args)=>({
   run:async()=>{calls.push({sql,args});return {meta:{changes:1}}},
   all:async()=>{calls.push({sql,args});return {results:[{id:8,name:"Alice",message:"Useful payment explanation!",created_at:"2026-10-15T09:00:00Z"}]}}
  }),
  all:async()=>{calls.push({sql,args:[]});return {results:[]}}
 })};
}
const env=db=>({VISITS:db,COMMENTS_TURNSTILE_SITE_KEY:"site-key",
 COMMENTS_TURNSTILE_SECRET_KEY:"private-turnstile-secret",
 COMMENTS_ADMIN_TOKEN:"a".repeat(48)});
test("all 14 public content pages end with a comments area and shared assets",()=>{
 assert.equal(pages.length,14);
 for(const path of pages){
  const html=readFileSync(root+"/"+path,"utf8");
  assert.equal((html.match(/id="comments"/g)||[]).length,1,path);
  assert.match(html,/class="ra-comments"/,path);
  assert.match(html,/class="ra-comments-app"/,path);
  assert.match(html,/comments\.js\?v=20261015-a/,path);
  assert.match(html,/comments\.css\?v=20261015-a/,path);
  assert.ok(html.indexOf('id="comments"')<html.lastIndexOf("</main>"),path);
  assert.ok(html.indexOf('id="comments"')>html.indexOf("<main"),path);
  // Relative script and stylesheet references must resolve to the repository's web root.
  const depth=path.split("/").length-1;
  const expected="../".repeat(depth);
  assert.ok(html.includes('src="'+expected+'comments.js'),path);
  assert.ok(html.includes('href="'+expected+'comments.css'),path);
  assert.ok(html.includes('src="'+expected+'config.js'),path);
 }
});
test("frontend only renders user comments as text and does not fake persistent storage",()=>{
 const js=readFileSync("web/comments.js","utf8");
 assert.match(js,/textContent/);
 assert.match(js,/status="pending"|status:"pending"|moderation|moderated/i);
 assert.match(js,/turnstile\.render/);
 assert.match(js,/getResponse/);
 assert.match(js,/form\.addEventListener\("submit"/);
 assert.doesNotMatch(js,/innerHTML\s*=|outerHTML\s*=|localStorage\.|sessionStorage\./);
 assert.match(js,/Comments are not accepting|submissions are not enabled/i);
 assert.match(readFileSync("web/config.js","utf8"),/ADDRESSRAIL_COMMENTS_URL/);
 assert.match(readFileSync("analytics/schema.sql","utf8"),/CREATE TABLE IF NOT EXISTS community_comments/);
});
test("API exposes only configured public site key and rejects unsupported pages",async()=>{
 const db=fakeDb();
 const no=await worker.fetch(request("/api/comments/config"),{VISITS:db});
 assert.equal((await no.json()).enabled,false);
 const yes=await worker.fetch(request("/api/comments/config"),env(db));
 const conf=await yes.json();
 assert.equal(conf.enabled,true);
 assert.equal(conf.siteKey,"site-key");
 assert.equal(conf.moderation,true);
 assert.equal(JSON.stringify(conf).includes("private-turnstile-secret"),false);
 const invalid=await worker.fetch(request("/api/comments?page="+encodeURIComponent("/private/")),env(db));
 assert.equal(invalid.status,400);
});
test("public read returns only approved records for the selected page",async()=>{
 const db=fakeDb();
 const resp=await worker.fetch(request("/api/comments?page=%2Fstudio%2Fchaps%2F"),env(db));
 assert.equal(resp.status,200);
 const body=await resp.json();
 assert.equal(body.page,"/studio/chaps/");
 assert.equal(body.comments[0].name,"Alice");
 assert.match(db.calls[0].sql,/status='approved'/);
 assert.deepEqual(db.calls[0].args,["/studio/chaps/"]);
 assert.equal((await worker.fetch(request("/api/comments?page=%2F"),{})).status,503);
});
test("post requires origin, consent, verified challenge, approved page and safe size",async()=>{
 const db=fakeDb(),config=env(db),token="tok_".padEnd(70,"Z");
 const data={page:"/studio/chaps/",name:"Alex",message:"This simulation helped me learn CHAPS.",
  agree:true,website:"",turnstileToken:token};
 const post=(value,headers={Origin:origin,"Content-Type":"application/json"})=>
  worker.fetch(request("/api/comments",{method:"POST",headers,body:JSON.stringify(value)}),config);
 assert.equal((await post(data,{Origin:"https://attacker.example","Content-Type":"application/json"})).status,403);
 assert.equal((await post({...data,page:"/bad/"})).status,422);
 assert.equal((await post({...data,message:"hi"})).status,422);
 assert.equal((await post({...data,agree:false})).status,422);
 assert.equal((await post({...data,website:"https://spam.invalid"})).status,400);
 assert.equal((await post(data)).status,403);
 assert.equal(db.calls.length,0);
 const previous=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json({success:true,hostname:"dhanapalkulanthaivel23.github.io",
    action:"addressrail_comment"});
  const response=await post({...data,message:"Here is a <script>alert(1)</script> test comment."});
  assert.equal(response.status,202);
  const result=await response.json();
  assert.equal(result.status,"pending");
  assert.equal(db.calls.length,1);
  assert.match(db.calls[0].sql,/status.*pending/);
  assert.equal(db.calls[0].args[0],"/studio/chaps/");
  assert.match(db.calls[0].args[2],/<script>/);
  assert.ok(!JSON.stringify(db.calls[0]).includes("tok_"));
  globalThis.fetch=async()=>Response.json({success:true,hostname:"evil.example",action:"addressrail_comment"});
  assert.equal((await post(data)).status,403);
 }finally{globalThis.fetch=previous;}
});
test("moderation is owner-only and only permits pending to approved or rejected",async()=>{
 const db=fakeDb(),settings=env(db);
 const route="/api/comments/moderation";
 const no=await worker.fetch(request(route),settings);
 assert.equal(no.status,401);
 const headers={Authorization:"Bearer "+"a".repeat(48),"Content-Type":"application/json"};
 const yes=await worker.fetch(request(route,{headers}),settings);
 assert.equal(yes.status,200);
 const change=await worker.fetch(request(route,{method:"POST",headers,body:JSON.stringify({id:12,status:"approved"})}),settings);
 assert.equal(change.status,200);
 assert.match(db.calls.at(-1).sql,/WHERE id=\?2 AND status='pending'/);
 assert.deepEqual(db.calls.at(-1).args,["approved",12]);
 assert.equal((await worker.fetch(request(route,{method:"POST",headers,body:JSON.stringify({id:12,status:"published"})}),settings)).status,422);
});
