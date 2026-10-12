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

export default {
  async fetch(request, env){
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, {status:204, headers:headers(origin)});
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
