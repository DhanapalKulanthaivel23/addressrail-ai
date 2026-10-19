# AddressRail AI — Payment Rail & Transaction Simulation Platform

**AddressRail AI / AddressTune** is a free, browser-based **Payment Rail Learning Workbench** for exploring synthetic banking transactions, message validation, address quality, fictional network responses, and educational investigations across SWIFT/CBPR+, SEPA, CHAPS, BoE RTGS, T2, FPS, Bacs and related systems.

### Launch the Payment Rail workbench

**🚀 [OPEN THE PAYMENT RAIL WORKBENCH — NO LOGIN REQUIRED](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/workbench/)**

This is the **main product interface**. Select a rail in the left navigation, choose a fictional scenario, inspect the request and response, run supported deterministic checks, explore AddressTune address review, investigate an illustrative AML watchlist match, or simulate REST/MQ/Kafka/file/SFTP handoffs. Every result is for learning only.

| Explore | What the public workbench provides |
|---|---|
| Payment rails | Registry-driven SWIFT/CBPR+, gpi/g4C, SEPA, CHAPS, RTGS, T2, FPS, Bacs and further fictional contexts |
| Transaction testing | Load/replay reproducible synthetic request scenarios and inspect two-stage execution evidence |
| Message checks | Educational payment metadata/address checks; complete FIN/MX parsing and official XSD/usage rules are **not** available in the public workbench |
| AddressTune | Conservative address-review proposals with explicit approval and deterministic recheck |
| AML / compliance | Temporary fictional watchlists and name-match examples, **not** real sanctions clearance |
| Channels | REST, MQ, Kafka, file and SFTP **simulations**, not live brokers or transfers |
| AI | Explicit deterministic fallback; no verified live Gemini model in the public workbench |

**[Public homepage and address analyzer](https://dhanapalkulanthaivel23.github.io/addressrail-ai/)** · **[Payment systems learning content](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/start/)**

### Scope, technology and limitations

The public demo uses React, TypeScript, Vite and a shared registry of fictional payment contexts. It works without an account or a user-provided API key. Input must be fictional or fully anonymised. No messages are sent to SWIFT, EPC, BoE or a real financial institution; no payment is settled. A payment rail listed in the navigation may only have **partial educational support** and is not automatically scheme-compliant.

The private `addressrail-network-core` repository remains separate. It contains more extensive synthetic processing and educational backend components. This public project is **not a full production SaaS, a certified MT/MX converter, an accredited sanctions-screening engine, or a source of financial compliance decisions**.

### Repository visibility and intellectual property

This repository and its Git history are public, with no root open-source licence currently provided. Public visibility permits viewing and platform-supported forking, but does not itself grant a commercial reuse licence for copyrighted original code. Previously published code remains in public history; private/public separation is partial. See the [commercial IP protection guide](docs/COMMERCIAL-IP-PROTECTION.md).

### Developer and testing entry points

- `npm ci` — install public frontend dependencies.
- `npm run build:workbench` — compile and bundle the payment workbench from source.
- `node --test tests/product-registry.test.mjs tests/learning-tools.test.mjs` — deterministic rail and learning-tool checks.
- Browser smoke tests and the Pages release workflow are verified in GitHub Actions.
- [Deployment documentation](docs/DEPLOY.md) and [public implementation status](docs/PUBLIC_PRODUCT_STATUS.md).

## v2 entry points — learn, present and test AI

- **[Start Here](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/start/)** — eight foundational lessons, glossary and tab-private progress.
- **[SCT Inst instant exception lab](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/sct-inst/?scenario=timeout)** — illustrative RT1 **or** TIPS route, rejections and unknown outcomes.
- **[CHAPS liquidity investigation](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/chaps/?scenario=liquidity-hold#case-lab)** — fictional BoE RTGS liquidity hold, evidence and rule IDs.
- **[Banking AI guardrails](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/ai-lab/)** — eight authored claim fixtures, deterministic checks; **not real recorded LLM outputs**.

Release marker **v2 · 15 October 2026** is displayed on Banking Studio. The new page links use separate routes; a browser/CDN cached older /studio/ cannot be diagnosed from GitHub repository state alone. Verified deployment workflow outcome is recorded in GitHub Actions.

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

### Grounded optional AI review

The CBPR+ and SEPA workbench includes opt-in Gemini review with curated retrieval, source citations, a bounded LangGraph workflow, two read-only tools and evidence checks. Human review remains required. See the [AI system card](docs/WORKBENCH-AI-SYSTEM-CARD.md) for data handling, evaluations and limitations.
