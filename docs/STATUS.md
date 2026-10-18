# AddressRail AI status

Updated 15 October 2026 (Europe/London).

## Public demonstration
- Home MT103 / ISO 20022 address intelligence demo and four search guides retained.
- 43-context Cross-Rail Intelligence catalogue with five illustrative currencies, basic teaching rules and guest-case handoff.
- NEW three-mode Interactive Payment Journeys: Banking Professional, AI/LLM Specialist and Beginner; curated connections for 43 contexts, six deeper payment lifecycles, 24 distinct fictional outcomes, step-by-step evidence, a scripted non-LLM AI replay, quizzes, JSON reports and private case handoff. See [guide](LEARN-PRESENT-AI-JOURNEYS.md).
- GitHub Actions should verify Node tests, Python tests and Playwright Chromium after each push; inspect the Actions tab for the specific deployment outcome.
- The sitemap now includes Banking Studio, Journeys, Cross-Rail, SEPA SCT, CHAPS and guest-case pages.
- Updated Banking Studio reference destinations for Bacs, CHAPS and Swift gpi.
- EPC 2025 SCT and SCT Inst v1.2 effective 30 September 2026: November 2026 unstructured-address sunset postponed; future rules must be version-specific.

## Deliberate limitations
- Browser guest actions are synthetic; sessionStorage does not offer authenticated shared audit history.
- Public AI workflow comparison is a scripted replay **without a model call**. The separate LangGraph/Gemini agent is local-only and optional.
- No real payments, account verification, scheme XSD/MIG certification, Swift access, sanctions screening, validated settlement or bank data.
- Cloudflare D1/Turnstile/Render/analytics configuration and existing optional main-site Gemini setup are preserved, not changed by the journeys launch. Private Gemini key and deployment configuration may still be required for live AI advisory.
- Historical search index submission claims remain in prior commits; indexing cannot be assumed from a submitted sitemap.

## v2 Learning & Demo Experience (15 October 2026)

- Start Here has five beginner lessons, life-of-payment overview, glossary, and tab-local progress.
- SCT Inst offers educational RT1 **or** TIPS alternatives, unknown outcome, negative status and duplicate-review scenarios.
- CHAPS now includes a liquidity queue / RTGS boundary investigation, presenter script and educational rule IDs.
- Banking AI Guardrails evaluates **eight authored sample claims**, not real model outputs. No LLM invocation, provider keys or bank action.
- Banking Studio shows the release stamp `v2 · 2026-10-15`. GitHub Pages workflow additionally tests public plain, cache-busted, and `?module=chaps` responses after deployment. Browser-private-window observations still depend on local caches.
- Four guides updated for correct postal address element ordering, explicit MT103 legacy context, Sept 2026 EPC v1.2 delay of the Nov 2026 unstructured address deadline, and source/version labels. EPC rules are not Swift CBPR+ rules.

## Community comments (15 October 2026)
All 14 public content pages include a bottom-of-page comments form and a separate discussion stream keyed by canonical page. Comment API, D1 table and Turnstile moderation controls are committed, but **shared comment submission is not live until the site owner deploys the updated Cloudflare Worker, migrates D1 and configures the required private Turnstile/admin secrets**. See [setup](COMMUNITY-COMMENTS.md). This is distinct from the existing tab-local guest cases.
