# AddressRail AI

A public, independent **payment-address quality demo** for synthetic ISO 20022 `pacs.008` and MT103 messages.

## Try AddressRail AI online

**[Launch the free AddressRail AI demo](https://dhanapalkulanthaivel23.github.io/addressrail-ai/)**

No registration, GitHub account or installation is required. Load a synthetic MT103 or ISO 20022 pacs.008 example, inspect address-quality findings and download a JSON report. Use only synthetic or fully anonymised test data.

Developers who want to host their own instance can follow the [deployment guide](docs/DEPLOY.md).

### What it does
- Load synthetic `pacs.008` or MT103 payment examples, or paste/upload a test message
- Find missing structured town/country fields
- Suggest conservative review-only repairs when the original text explicitly contains a comma-separated town and ISO country code
- Export a JSON report without sending data to a server
- Optionally request Gemini commentary through a separately hosted, secured backend

**Not a production system:** This is not an official Swift, ISO 20022, EPC or CBPR+ validator. MT parsing is intentionally heuristic. The demo does not transmit payments, perform sanctions screening or approve repairs.

## Running the demo locally

Open `web/index.html` with a browser. It loads `web/app.js`. No Python or API key is needed for local checks.

## Optional Gemini backend

**Gemini 3.1 Flash-Lite integration is implemented but disabled until deployed.** GitHub Pages cannot protect Gemini credentials. Never place `GEMINI_API_KEY` in JavaScript, chat or a public repository.

For the free-tier pilot, the backend **fails closed unless Gemini and Cloudflare Turnstile are both configured**. It forwards only small address findings, not the original payment message.

1. Create a Gemini key in [Google AI Studio](https://aistudio.google.com/api-keys).
2. Create a Cloudflare Turnstile widget restricted to `dhanapalkulanthaivel23.github.io`.
3. Deploy the `render.yaml` Blueprint through Render (Free plan if available).
4. Configure `GEMINI_API_KEY`, `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` on the Render service.
5. Enable `ENABLE_AI=true` in the backend environment.
6. Set the **public backend URL only** in `web/config.js` and push to redeploy GitHub Pages.

See **[complete Gemini deployment walkthrough](docs/DEPLOY.md)**. Do not upload confidential customer/bank messages. This is for a limited test group; process-local quotas are **not** adequate protection for a production SaaS. Gemini free-tier eligibility, quota and data-use terms depend on account/model/region.

## Architecture

```text
Browser user → GitHub Pages → JavaScript address checks → JSON findings
                                     |
                                     └→ optional secured FastAPI backend → Gemini
```

## Find AddressRail AI through search

Search-friendly tutorials, canonical links, sitemap, robots rules and free metadata are published on GitHub Pages. Search ranking and AI-answer placement cannot be guaranteed.

- [SWIFT MT103 address correction](https://dhanapalkulanthaivel23.github.io/addressrail-ai/mt103-address-correction/)
- [ISO 20022 structured/hybrid addresses](https://dhanapalkulanthaivel23.github.io/addressrail-ai/iso20022-structured-address/)
- [pacs.008 address validation](https://dhanapalkulanthaivel23.github.io/addressrail-ai/pacs008-address-validation/)
- [CBPR+ postal-address concepts](https://dhanapalkulanthaivel23.github.io/addressrail-ai/cbpr-address-guide/)

Search setup: [Free Google/Bing indexing guide](docs/SEO.md).

## Free public visitor statistics (optional)

The site is prepared to show aggregate **estimated visits** and referral groups such as Google, Bing, GitHub, ChatGPT, Gemini, Claude and Direct/Unknown. Activate it using **Cloudflare Workers Free + D1 Free** as described in [Visitor Analytics Setup](docs/VISITOR-ANALYTICS.md). Until then, the public page explicitly says the counter is not active.

Visitor counts are browser-session estimates, **not validated unique people**. Search engines and AI assistants may omit referral information, and prior visits cannot be counted retroactively. No domain purchases or subscription upgrades are required for the prototype within free-tier limits.

## Release status

This is a **demonstration prototype**, not yet a multi-tenant SaaS product. Authentication, billing, authoritative scheme rule validation, durable audit records, API throttling and commercial integrations are future work.

Project name: **AddressRail AI**. No association with any payment network operator or standards body is implied.
