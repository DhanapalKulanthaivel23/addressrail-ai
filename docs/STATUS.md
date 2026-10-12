# AddressRail AI status

Updated 12 October 2026 (Europe/London).

- Public GitHub Pages demo and four search guides deployed.
- Cloudflare D1 VISITS binding and visitor-counter Worker verified; /api/stats returned HTTP 200 and the live website displayed 2 visits.
- Referral classification corrected for Gemini; five analytics tests added to CI and passed before PR #1 merged.
- Google Search Console ownership verified through the published HTML file; sitemap submission accepted, but report currently says Couldn't fetch. The sitemap opens publicly in Safari. MT103 guide indexing request accepted into Google's priority crawl queue.
- Bing ownership verification completed; sitemap is submitted and Processing, with no reported errors or warnings. Indexing itself is not confirmed.
- Gemini remains disabled: private API key and backend hosting/Turnstile setup are outstanding.
- REST address engine, SaaS tenants/accounts, MQ, Kafka and SFTP remain future development. The current backend provides optional AI explanations only.
- Existing demo preserved; no purchases or paid-plan changes.
