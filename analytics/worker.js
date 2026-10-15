/**
 * AddressRail AI's optional privacy-minimising FREE visitor counter.
 * Cloudflare Workers + D1. Does not store IP, user agent, URL queries, session IDs or raw referrers.
 * It counts one attempted visit per browser tab session, not verified unique people.
 * Aggregate breakdowns are approximate: referral headers/UTM can be missing, blocked or spoofed.
 */
const SITE_ORIGIN = "https://dhanapalkulanthaivel23.github.io";
const SOURCES = new Set([
  "Google", "Bing", "GitHub", "ChatGPT", "Perplexity",
  "Gemini", "Claude", "Copilot", "Other AI", "Other search",
  "Other websites", "Direct / Unknown",
]);

const headers = (origin) => ({
  "Access-Control-Allow-Origin": origin === SITE_ORIGIN ? SITE_ORIGIN : "null",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
});
const asJson = (body, status = 200, origin = SITE_ORIGIN) =>
  new Response(JSON.stringify(body), {status, headers:headers(origin)});

function safeSource(value){
  return typeof value === "string" && SOURCES.has(value) ? value : "Direct / Unknown";
}


// Shared, per-page comments. The Worker owns validation, D1 writes and moderation.
// Github Pages only receives public, approved text. Private tokens stay in Worker env.
const COMMENT_PAGES = new Set([
 "/", "/studio/", "/studio/start/", "/studio/journeys/",
 "/studio/payment-intelligence/", "/studio/sepa-sct/", "/studio/sct-inst/",
 "/studio/chaps/", "/studio/ai-lab/", "/studio/open-demo/", "/studio/sdd/", "/studio/fps/", "/studio/bacs/", "/studio/t2/", "/studio/cbpr/", "/studio/cls/",
 "/mt103-address-correction/", "/iso20022-structured-address/",
 "/pacs008-address-validation/", "/cbpr-address-guide/"
]);
const commentReady = env => Boolean(env.VISITS && env.COMMENTS_TURNSTILE_SITE_KEY &&
 env.COMMENTS_TURNSTILE_SECRET_KEY && env.COMMENTS_ADMIN_TOKEN);
function validPage(value){return typeof value==="string"&&COMMENT_PAGES.has(value);}
function cleanText(value,max){
 if(typeof value!=="string"||value.length>max*2)return "";
 return value.normalize("NFC").replace(/[\u0000-\u001F\u007F-\u009F]/g," ").trim().slice(0,max);
}
async function verifyCommentChallenge(token,env){
 if(typeof token!=="string"||token.length<20||token.length>2048)return false;
 try{
  const payload=new URLSearchParams({secret:env.COMMENTS_TURNSTILE_SECRET_KEY,response:token});
  const r=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{
   method:"POST",body:payload,signal:AbortSignal.timeout(9000)
  });
  if(!r.ok)return false;
  const answer=await r.json();
  return answer.success===true && answer.hostname==="dhanapalkulanthaivel23.github.io" &&
   answer.action==="addressrail_comment";
 }catch{return false;}
}
async function readCommentJson(request){
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")||""))
  throw new Error("Expected JSON");
 if(Number(request.headers.get("content-length")||0)>4200)throw new Error("Too large");
 const body=await request.text();
 if(body.length>4200)throw new Error("Too large");
 return JSON.parse(body);
}
function adminAllowed(request,env){
 const token=env.COMMENTS_ADMIN_TOKEN;
 return typeof token==="string"&&token.length>=32 &&
  request.headers.get("Authorization")==="Bearer "+token;
}
async function handleComments(request,env,url,origin){
 const path=url.pathname;
 if(path==="/api/comments/config"&&request.method==="GET")
  return asJson({enabled:commentReady(env),
   siteKey:commentReady(env)?env.COMMENTS_TURNSTILE_SITE_KEY:"",
   moderation:true,maxLength:1000,requiresLogin:false},200,origin);
 if(path==="/api/comments"&&request.method==="GET"){
  const page=url.searchParams.get("page");
  if(!validPage(page))return asJson({error:"Unknown project page"},400,origin);
  if(!env.VISITS)return asJson({error:"Comments storage is unavailable"},503,origin);
  try{
   const rows=await env.VISITS.prepare(
    "SELECT id,name,message,created_at FROM community_comments WHERE page=?1 AND status='approved' ORDER BY created_at DESC,id DESC LIMIT 50"
   ).bind(page).all();
   return asJson({page,comments:rows.results||[],moderated:true},200,origin);
  }catch{return asJson({error:"Comments have not been activated"},503,origin);}
 }
 if(path==="/api/comments"&&request.method==="POST"){
  if(origin!==SITE_ORIGIN)return asJson({error:"Comments can only be submitted from AddressRail AI"},403,origin);
  if(!commentReady(env))return asJson({error:"Comments are not accepting submissions yet"},503,origin);
  let data;try{data=await readCommentJson(request);}catch{return asJson({error:"Invalid or oversized comment"},400,origin);}
  const page=data?.page, name=cleanText(data?.name,50), message=cleanText(data?.message,1000);
  if(!validPage(page)||name.length<2||message.length<10||message.length>1000||
     data?.agree!==true)
   return asJson({error:"Enter a name, a 10–1000 character comment, and accept the public posting notice"},422,origin);
  // Honeypot. Bots should receive no information about detection.
  if(data?.website)return asJson({error:"Submission could not be accepted"},400,origin);
  if(!await verifyCommentChallenge(data?.turnstileToken,env))
   return asJson({error:"Human verification failed. Please try again."},403,origin);
  try{
   const created=new Date().toISOString();
   await env.VISITS.prepare(
    "INSERT INTO community_comments (page,name,message,created_at,status) VALUES (?1,?2,?3,?4,'pending')"
   ).bind(page,name,message,created).run();
   return asJson({submitted:true,status:"pending",
    message:"Thanks! Your comment was received and will appear after moderation."},202,origin);
  }catch{return asJson({error:"Comment submission is temporarily unavailable"},503,origin);}
 }
 if(path==="/api/comments/moderation" && (request.method==="GET"||request.method==="POST")){
  if(!adminAllowed(request,env))return asJson({error:"Not authorised"},401,origin);
  if(!env.VISITS)return asJson({error:"Database unavailable"},503,origin);
  if(request.method==="GET"){
   try{
    const rows=await env.VISITS.prepare(
     "SELECT id,page,name,message,created_at,status FROM community_comments WHERE status='pending' ORDER BY created_at,id LIMIT 100"
    ).all();
    return asJson({pending:rows.results||[]},200,origin);
   }catch{return asJson({error:"Moderation unavailable"},503,origin);}
  }
  let data;try{data=await readCommentJson(request);}catch{return asJson({error:"Invalid JSON"},400,origin);}
  if(!Number.isSafeInteger(data?.id)||data.id<1||!["approved","rejected"].includes(data?.status))
   return asJson({error:"Invalid moderation instruction"},422,origin);
  try{
   const result=await env.VISITS.prepare(
    "UPDATE community_comments SET status=?1 WHERE id=?2 AND status='pending'"
   ).bind(data.status,data.id).run();
   return asJson({updated:Boolean(result.meta?.changes)},200,origin);
  }catch{return asJson({error:"Moderation failed"},503,origin);}
 }
 return asJson({error:"Not found"},404,origin);
}

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:headers(origin)});
    if (url.pathname.startsWith("/api/comments")) return handleComments(request,env,url,origin);
    if (!env.VISITS) return asJson({error:"Visitor database not configured"},503,origin);
    if (url.pathname === "/api/visit" && request.method === "POST"){
      // Avoid collecting cross-origin posts from other websites. Not authentication or anti-bot protection.
      if(origin !== SITE_ORIGIN) return asJson({error:"Origin not allowed"},403,origin);
      if((Number(request.headers.get("content-length"))||0)>1024) return asJson({error:"Payload too large"},413,origin);
      let data; try {data=await request.json();} catch {return asJson({error:"Invalid JSON"},400,origin)}
      const source = safeSource(data?.source);
      const day = new Date().toISOString().slice(0,10);
      try {
        await env.VISITS.prepare(
          "INSERT INTO visits (day,source,count) VALUES (?1,?2,1) ON CONFLICT(day,source) DO UPDATE SET count=count+1"
        ).bind(day,source).run();
        return asJson({recorded:true},202,origin);
      } catch {return asJson({error:"Counter temporarily unavailable"},503,origin)}
    }
    if(url.pathname === "/api/stats" && request.method === "GET"){
      try {
        const [all,recent] = await Promise.all([
          env.VISITS.prepare("SELECT source, SUM(count) AS visits FROM visits GROUP BY source ORDER BY visits DESC").all(),
          env.VISITS.prepare("SELECT SUM(count) AS visits FROM visits WHERE day>=date('now','-29 days')").first(),
        ]);
        const sources=Object.fromEntries(all.results.map(row=>[row.source,Number(row.visits)]));
        const total=Object.values(sources).reduce((a,b)=>a+b,0);
        return asJson({totalVisits:total,last30Days:Number(recent?.visits||0),bySource:sources,
          definition:"Approximate browser-tab sessions since counter activation; not unique people.",
          limitations:"Some search engines and AI assistants hide referral sources. Counts can be blocked, spoofed or inflated."},200,origin);
      } catch {return asJson({error:"Stats temporarily unavailable"},503,origin)}
    }
    return asJson({error:"Not found"},404,origin);
  },
};
