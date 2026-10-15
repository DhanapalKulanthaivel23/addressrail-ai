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

## Interactive banking journeys — three audiences

**[Open the free Learn / Present / Banking AI Journeys](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/journeys/)**

One no-login browser workspace for **banking professionals** presenting payment products, **AI specialists** explaining deterministic controls versus evidence-bounded hypothetical LLM assistance, and **beginners** studying participants, messages and settlement. It includes a clickable curated connections explorer for the 43 existing catalogue entries; **six deeper payment journeys** (CBPR+/gpi, SEPA SCT, SCT Inst, CHAPS/BoE RTGS, FPS, Bacs Direct Debit); **24 fictional scenarios**; incremental sender/receiver/message timelines; deterministic checks; a *scripted, non-LLM* AI replay; six quizzes; JSON exports and guest-case import.

These are educational examples, not current bank connectivity, formal scheme conformance or a real executed AI model. [See guide](docs/LEARN-PRESENT-AI-JOURNEYS.md).

## Explore SWIFT CBPR+, gpi, g4C and UK/EU payment systems

**[Open the free Cross-Rail Payment Intelligence Lab](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/payment-intelligence/)**

A browser-only, no-login learning lab with **43 distinct payment scheme, infrastructure, overlay and network contexts**. An illustrative currency picker supports **EUR, GBP, SEK, PLN and DKK** where appropriate; domestic examples use their own currency. Covers SWIFT CBPR+, gpi, g4C; CHAPS, BoE RTGS, FPS, Bacs and other UK systems; EPC SEPA SCT, SCT Inst, SDD Core/B2B and OCT Inst; STEP2, RT1, TIPS, T2, EURO1; selected Swedish, Polish, Danish and national euro processing services; and CLS FX settlement concepts.

See the [complete 43-context UK/EU payment coverage matrix](docs/UK-EU-PAYMENT-COVERAGE-MATRIX.md). Choose fictional exception scenarios, run basic educational metadata checks, inspect deliberately incomplete ISO 20022 and MT examples, trace example UETR events, review a narrowly evidenced address-town proposal, download a synthetic report, and import its findings into the **existing private guest case workflow**.

**Not official XSD/MIG or scheme conformance, live tracking, sanctions screening or settlement.** Every case stays in your own browser tab and is not sent to a shared backend.

[Coverage and safety documentation](docs/PAYMENT_INTELLIGENCE.md)

## Try the public payment case demo — no login

**[Open the free guest case-management workspace](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/open-demo/)**

Anyone with the link can inspect synthetic SEPA SCT, SCT Inst and CHAPS cases, create a fictional case, assign an example owner, add notes and submit a **training-only** decision. No account, password, MFA, Keycloak instance, API key, installation or payments backend is needed. Each visitor's actions stay within their own browser tab; this is **not** a shared multi-user service, real tenant isolation, live AI or genuine case approval.

[Public guest demo guide](docs/GUEST_DEMO.md)

## Running the demo locally

Open `web/index.html` with a browser. It loads `web/app.js`. No Python or API key is needed for local checks.
