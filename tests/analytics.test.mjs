import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const client = await fs.readFile(new URL('../web/analytics.js', import.meta.url), 'utf8');
const workerSource = await fs.readFile(new URL('../analytics/worker.js', import.meta.url), 'utf8');
const {default:worker} = await import('data:text/javascript;base64,' + Buffer.from(workerSource).toString('base64'));
const origin = 'https://dhanapalkulanthaivel23.github.io';

async function visit(referrer='', search='', counted=false) {
  const calls=[];
  const nodes={'visitor-total':{},'visitor-source-breakdown':{}};
  const session=new Map(counted ? [['addressrail_visit_counted','1']] : []);
  const context={URL,URLSearchParams,window:{ADDRESSRAIL_STATS_URL:'https://counter.example',location:{search}},
    document:{referrer,getElementById:id=>nodes[id]},location:{hostname:'dhanapalkulanthaivel23.github.io'},
    sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({totalVisits:12,last30Days:9,bySource:{Google:8,GitHub:4}})};}};
  vm.runInNewContext(client,context);
  await new Promise(resolve=>setImmediate(resolve));
  return {calls,nodes,session};
}

test('recognizes search, GitHub and identifiable AI referrals',async()=>{
  const cases={Google:'https://www.google.com/search?q=address',Bing:'https://www.bing.com/search',GitHub:'https://github.com/x',
    ChatGPT:'https://chatgpt.com/c/x',Perplexity:'https://www.perplexity.ai/search/x',Gemini:'https://gemini.google.com/app',
    Claude:'https://claude.ai/chat/x',Copilot:'https://copilot.microsoft.com/', 'Other AI':'https://poe.com/',
    'Other search':'https://duckduckgo.com/', 'Other websites':'https://example.com/', 'Direct / Unknown':''};
  for(const [expected,referrer] of Object.entries(cases)) {
    const {calls}=await visit(referrer);
    assert.equal(JSON.parse(calls[0].options.body).source,expected,referrer);
    assert.deepEqual(Object.keys(JSON.parse(calls[0].options.body)),['source']);
  }
});

test('explicit campaign source works even with same-site referrer',async()=>{
  const {calls}=await visit(origin+'/addressrail-ai/','?utm_source=chatgpt');
  assert.equal(JSON.parse(calls[0].options.body).source,'ChatGPT');
});

test('counts once per tab and renders live source totals',async()=>{
  const {calls,nodes}=await visit('', '', true);
  assert.equal(calls.length,1);
  assert.ok(calls[0].url.endsWith('/api/stats'));
  assert.equal(nodes['visitor-total'].textContent,'12');
  assert.match(nodes['visitor-source-breakdown'].textContent,/Last 30 days: 9.*Google 8.*GitHub 4/);
});

test('Worker writes aggregate day and source, rejects foreign origins',async()=>{
  const values=[];
  const env={VISITS:{prepare:sql=>({bind:(...args)=>({run:async()=>values.push({sql,args})})})}};
  const request=new Request('https://counter.example/api/visit',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({source:'Google'})});
  const response=await worker.fetch(request,env);
  assert.equal(response.status,202);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  assert.equal(values.length,1);
  assert.deepEqual(values[0].args,[new Date().toISOString().slice(0,10),'Google']);
  const blocked=await worker.fetch(new Request('https://counter.example/api/visit',{method:'POST',headers:{Origin:'https://example.com'},body:'{}'}),env);
  assert.equal(blocked.status,403);
  assert.equal(values.length,1);
});

test('Worker reads totals and fails closed without a database',async()=>{
  const env={VISITS:{prepare:()=>({all:async()=>({results:[{source:'Google',visits:3},{source:'ChatGPT',visits:2}]}),first:async()=>({visits:4})})}};
  const request=new Request('https://counter.example/api/stats',{headers:{Origin:origin}});
  const response=await worker.fetch(request,env);
  const stats=await response.json();
  assert.equal(stats.totalVisits,5);
  assert.equal(stats.last30Days,4);
  assert.deepEqual(stats.bySource,{Google:3,ChatGPT:2});
  assert.equal((await worker.fetch(request,{})).status,503);
});
