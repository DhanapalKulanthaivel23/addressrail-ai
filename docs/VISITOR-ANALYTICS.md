# AddressRail AI — FREE Visitor Counter and Referral Breakdown

This is an optional **zero-purchase** setup: GitHub Pages + Cloudflare Workers Free + Cloudflare D1 Free. No purchased domain, billing integration or paid analytics provider required.

**Status:** The source code is committed but the counter will display **Not active** until you create a free Cloudflare Worker/D1 database and set its public Worker URL in `web/config.js`. This is intentional: we never invent visit totals.

## What appears on your public page?

- Approximate total browser-tab visits since activation
- Visits in the last 30 days
- Breakdown for Google, Bing, GitHub, ChatGPT, Claude, Gemini, Perplexity, Copilot, other AI, other searches, other websites and Direct / Unknown
- No personal names, IP addresses, browser fingerprints, customer addresses, payment messages, or cookies are stored by the counter database

**Accuracy:** These are **approximate browser-tab sessions**, not unique people. A visit is sent once per tab session via `sessionStorage`; other tabs can count again. Javascript-blocking, tracking blockers, cached pages, bots, UTM/referrer spoofing, network errors or deleted storage can affect counts. Many AI assistants or searches don't send referrals, so their visitors appear as **Direct / Unknown**. We cannot reliably tell every ChatGPT/LLM referral from a direct visit. Historical visits before activation cannot be reconstructed.

## One-time setup (free plan only)

1. Create a **free Cloudflare account** at documented source if you don't have one.
2. Install Node.js locally if unavailable. In your local checkout of this GitHub repository, run:

   ```bash
   npx wrangler login
   npx wrangler d1 create addressrail-visits
   ```

3. In the CLI output, note the `database_id`. Copy `analytics/wrangler.example.toml` to `analytics/wrangler.toml` and replace only `database_id`. The database ID is not a secret, but do not commit account credentials or tokens.
4. Create the aggregate table:

   ```bash
   npx wrangler d1 execute addressrail-visits --remote --file=analytics/schema.sql
   ```

5. Deploy the Worker:

   ```bash
   npx wrangler deploy --config analytics/wrangler.toml
   ```

6. Copy the publicly accessible Worker URL displayed by Cloudflare, typically
   `documented source`.
7. Edit the public `web/config.js` file in GitHub (or your local checkout):

   ```js
   window.ADDRESSRAIL_STATS_URL = 'documented source';
   ```

   **Do not modify** `window.ADDRESSRAIL_API_URL` unless you are separately deploying the optional Gemini backend.

8. Commit/push and wait for the successful GitHub Pages deployment. Visit documented source in a new tab and check the visitor total.

## How to check that the counter is working

```bash
curl documented source
```

The Worker should return JSON containing `totalVisits`, `last30Days` and `bySource`. It returns `503` if the database binding is missing. A browser POST from the allowed GitHub Pages origin increments a single aggregated source/day row.

## Data and security limits

- The Worker verifies the browser `Origin` to discourage cross-site use. **Origin is not authentication**. A sophisticated attacker or automated caller can still inflate counters, so these are not financial-grade audience metrics.
- Only aggregate day/source/count values are stored. The Worker doesn't persist raw referer strings or IP addresses. Hosting providers may have their own operational logs.
- The endpoint returns aggregate counts **publicly**. Don't use it for protected business information.
- The browser does not collect or send payment-message contents to analytics.
- The free Workers/D1 service has daily usage limits; Cloudflare can reject requests after the included quota. This design has no automated upgrade to a paid service. Consult current limits: documented source
- The counter is a lightweight estimate, not a certified count of unique human visitors.

## Why not Google Analytics alone?

Google Analytics 4 is also free at ordinary usage levels, and Google Search Console and Bing Webmaster Tools are free. They are useful for detailed search reporting, but displaying Google Analytics totals publicly requires API access/authentication and extra configuration. Our dedicated Cloudflare Worker offers simple public aggregate counts and visible referral breakdowns with no GA tracking cookie.

## Search visibility and attribution

1. Register the GitHub Pages URL as a **URL-prefix property** in Google Search Console: documented source
2. Upload the verification HTML file to the published `web/` directory if prompted, then verify.
3. Submit `documented source`.
4. Set up free Bing Webmaster Tools at documented source and verify the same URL-prefix site.
5. Share campaign links with `utm_source=github`, `utm_source=linkedin`, etc. Identifiable sources count only when the referrer or recognised UTM source survives the browser/navigation.

**Note:** SEO does not guarantee rankings or inclusion in AI-generated answers. Publishing technical guides and an accurate sitemap helps discovery, not guaranteed placement.
