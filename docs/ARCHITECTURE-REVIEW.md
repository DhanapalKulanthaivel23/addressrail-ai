# AddressRail AI continuation review

Reviewed 12 October 2026, Europe/London. Source: all 31 files on main, the complete handover, CI, the live website and the signed-in Cloudflare dashboard.

## Verified current state

- The GitHub Pages demo is live and its simplified visitor section displays the total and last-30-days/source breakdown.
- Cloudflare Worker addressrail-visitors has D1 binding VISITS connected to addressrail-visits. Active version 8b105a60 is the visitor-counter deployment. GET /api/stats returned HTTP 200 with totalVisits=2, last30Days=2 and Direct / Unknown=2. Loading the public site in this browser recorded a real tab visit and displayed the updated aggregate.
- PR #1 fixes Gemini attribution previously captured by Google's broader hostname rule, and gives explicit utm_source priority. Five local analytics tests passed; GitHub CI passed before merge. Tests cover referral groups, tab-session deduplication, dashboard rendering, aggregate D1 writes, origin rejection and stats failures.
- Existing Python tests cover the optional Gemini API, not the payment parser. The current repository has eight Python test functions. Earlier references to 19 parser tests do not describe the current test file.
- Google Search Console and Bing ownership verification/sitemap submission have not been confirmed. The sitemap lists the homepage and four guides.

## Architecture and functional gaps

1. The live address analyzer exists only in web/app.js. The FastAPI backend provides health, public config and Gemini explanation; it does not offer a shared deterministic payment-validation API. REST, MQ, Kafka and SFTP cannot yet call a common engine.
2. The MT parser uses a heuristic regular expression and treats field options as similar line groups. Option A identifiers and numbered option F addresses require distinct handling. It must not label identifier fields as postal addresses or silently imply full MT103 validation.
3. ISO 20022 recognition checks element names and has no authoritative schema/version validation. Multiple transactions are flattened without stable transaction/party identifiers. Country checking uses a small 12-country set, so other valid countries receive review flags.
4. Repair suggestions depend on comma-separated town/country text. Confidence is not independently calibrated. No approved repair workflow or structured/hybrid export exists.
5. Gemini is disabled and no private key has been created. The backend correctly keeps keys server-side and checks Turnstile hostname/action, but quotas are process-local and reset on restart. It has no durable global budget or tenant authentication. Request body size is checked after parsing, and retained IP quota entries are not bounded.
6. There are no SaaS accounts, tenant records, durable jobs, audit events, API-key lifecycle, approval queue or production connectors. Render configuration is a free-plan template, not proof of a hosted service.

## Ordered development plan

### A. Finish search ownership and Gemini account setup

Verify the exact GitHub Pages URL-prefix property in Google Search Console, publish its verification artifact inside web/, submit sitemap and inspect a guide URL. Verify/import into Bing and submit the same sitemap. Acceptance: consoles visibly show verified ownership and successful sitemap submission. Account sign-in is user-assisted; legal acceptance and security-sensitive access require approval.

Complete Google AI Studio setup, verify free eligibility and keep billing disabled. Create a restricted Gemini key and store it only in backend secret settings. Configure Turnstile for the GitHub Pages hostname and deploy the free backend after validating account limits. Acceptance: /api/config exposes public settings only; missing/expired challenges are rejected; one synthetic explanation works; quota and failure paths are tested. No paid service or real payment data.

### B. Establish the shared address engine on a feature branch

Extract parser/rule logic into a separately tested core, with stable transaction/party IDs and versioned report schemas. Add country-code reference data, separate MT field-option handlers, explicit unsupported-format findings, evidence spans and review-only proposals. Keep the existing public demo until parity checks pass. Acceptance: synthetic fixture tests exercise structured, hybrid, unstructured and malformed input, multiple transactions, supported MT variants, international country codes and preservation of original fields.

### C. Add controlled repair and REST

Expose a validation API over the shared engine, with request size limits, idempotency and no automatic payment submission. Persist original/proposed changes, reviewer decisions and audit events. Acceptance: approved output changes only approved fields; rejected/uncertain proposals leave the original unchanged; retries do not duplicate jobs.

### D. SaaS foundation

Add organisation/tenant isolation, OIDC login, scoped/revocable API keys, persistent usage limits, database migrations and backup/restore tests. Acceptance: cross-tenant reads/writes fail in integration tests and quotas persist across restarts. Billing remains disabled under the free-only constraint.

### E. Enterprise adapters

Add REST, Kafka, IBM MQ and SFTP/batch adapters over the same job/engine interface. Include bounded concurrency, retries, dead-letter handling, correlation IDs and result delivery. Develop with local test doubles or legitimately free components; do not present an untested connector as complete. Acceptance: duplicate delivery, restart, poison-message and timeout tests; equivalent reports across transports.

### F. Release gates

Benchmark address accuracy on labelled synthetic/reference fixtures, perform security and accessibility reviews, measure load behaviour, document data retention, and test deployment/restore. Provide a bank-hosted deployment option. Do not claim authoritative SWIFT/CBPR+ certification without licensed/current rule validation and independent evidence.

## Constraints retained

Free tiers only; no purchases, paid plans, credentials in chat/GitHub, real banking data sent to AI, or disruption to the working demo. Source attribution is approximate and depends on available referrers/explicit campaign tags. Do not add artificial referral visits to make the public dashboard look populated.
