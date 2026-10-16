import assert from 'node:assert/strict';
export async function smoke(base,key,fetcher=fetch){
 assert.ok(key,"API key required");
 const url=new URL(base);
 assert.equal(url.protocol,'https:');assert.equal(url.pathname,'/');assert.ok(!url.username&&!url.password&&!url.search&&!url.hash);
 const call=async(path,body,auth=key)=>{
   const r=await fetcher(new URL(path,url),{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'content-type':'application/json',...(auth?{'x-api-key':auth}:{})},...(body?{body:JSON.stringify(body)}:{})});
   return {status:r.status,data:await r.json()};
 };
 assert.equal((await call('/health')).data.service,'gateway');
 assert.equal((await call('/v1/gpi/payments',{synthetic:true},'invalid-smoke-key')).status,401);
 assert.equal((await call('/v1/not-a-route',{})).status,404);
 assert.equal((await call('/v1/gpi/payments',{synthetic:false})).status,400);
 const r=await call('/v1/gpi/payments',{synthetic:true,messageType:'pacs.008',receiverBic:'BANKDEFF',currency:'EUR',reference:'AR-SMOKE',uetr:crypto.randomUUID()});
 assert.equal(r.status,200);assert.equal(r.data.simulated,true);assert.equal(r.data.settlementAttested,false);assert.equal(r.data.trackingStatus,'ACSP');assert.equal(r.data.networkResponse.networkAck,'SIMULATED_ACCEPTED');
 console.log('Smoke passed: health, authentication, routing, synthetic guard, GPI → SWIFT → bank. Consumed 2 demo quota units.');
}
if(process.argv[1]?.endsWith('/cloudflare-smoke.mjs'))await smoke(process.env.GATEWAY_URL,process.env.AR_DEMO_API_KEY);
