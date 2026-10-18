# AddressRail AI — Cross-Rail Payment Intelligence Lab (Public Guest v1)

**Guided journeys for professionals, AI experts and beginners:** https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/journeys/ — six deeper simulations, 24 fictional scenarios, 43-context connection explorer, quizzes and scripted AI replay. [Guide](LEARN-PRESENT-AI-JOURNEYS.md).

**Live guest URL:** https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/payment-intelligence/

This is a browser-only, **free, no-login** training product that helps a visitor compare major UK, European and SWIFT payment systems and services; run **small deterministic checks** on synthetic structured JSON examples; inspect educational XML/MT/retail message sketches; correlate fictional UETR events; apply a narrow, evidenced **review-only town-address proposal**; export JSON; and import a case into the **private Guest Case Management** page.

The lab has **43 distinct catalogued services/contexts**. See the [complete 43-row UK/EU and cross-border coverage matrix](UK-EU-PAYMENT-COVERAGE-MATRIX.md), including scheme classifications, messages, references and EUR/GBP/SEK/PLN/DKK teaching currency policies. This is broad *teaching coverage*, not every domestic payment system in every country and not 43 officially conformant parsers or live connectors.

## Coverage and how to interpret it

**International messaging and corporate tracking (6):** SWIFT CBPR+ (cross-border ISO 20022 usage profile), SWIFT gpi Tracker, gpi for Corporates (g4C), legacy SWIFT FIN MT learning, SWIFT Go and SWIFT FileAct. gpi and g4C are tracking/corporate services—not payment clearing/settlement systems.

**United Kingdom (9):** CHAPS, Bank of England RTGS, Faster Payments Service (FPS), Bacs Direct Credit, Bacs Direct Debit, Image Clearing System (cheque images), Confirmation of Payee (CoP), LINK ATM network, and PEXA property-payment processing. CHAPS gross settles in the Bank's RTGS service; Bacs and FPS have different retail processes and net settlement arrangements. CoP is a payee-check overlay, not payment settlement.

**SEPA, euro clearing and Eurosystem (14):** EPC SCT, SCT Inst, SDD Core, SDD B2B, OCT Inst (the **five EPC payment schemes**); Verification of Payee, SEPA Request-to-Pay; EBA CLEARING STEP2 SCT, STEP2 SDD and RT1; Eurosystem TIPS, T2 RTGS and T2S; and EURO1. T2 is **not** the old TARGET2 service. RT1 and TIPS are distinct instant-payment infrastructures. T2S primarily provides securities-versus-cash settlement, not a retail credit transfer scheme.

**Selected European national contexts (13):** France/STET, Spain/SNCE, Italy/BI-COMP, Netherlands/equensWorldline, Lithuania/CENTROlink; Germany/RPS SEPA-Clearer; Sweden/RIX-INST, RIX-RTGS and Swish; Poland/Elixir and Express Elixir; Denmark/retail clearing and DKK TIPS participation. This is a deliberately **non-exhaustive** list; the EU contains euro and non-euro domestic payment systems. The examples preserve SEK, PLN and DKK rather than pretending all European domestic transfers use EUR.

**Cross-border FX settlement (1):** CLS FX settlement context, which uses payment-versus-payment settlement concepts, not a consumer retail scheme.

Each catalog item includes a classification, relevant illustrative message families and a public reference link. National/operator links are background information, not live connection URLs. **Current participation, release rules, compliance profiles and specific fee/limit details must be confirmed from current official material.**

## What works in v1

1. Select a payment service, geography or search term from the 43-context catalogue. The dashboard handles no-result searches without loading a stale rail. Select an illustrative transaction currency: **EUR, GBP, SEK, PLN or DKK** for global/CLS examples, fixed GBP for UK, EUR for SEPA/euro contexts, and fixed local SEK/PLN/DKK for the modelled Swedish, Polish and Danish national contexts.
2. Choose one of **nine fictional scenarios**: baseline, missing structured town, invalid IBAN, invalid BIC, missing UETR, missing response, liquidity hold, missing debit mandate or status/event conflict. If a fault does not apply to the selected service, a notice explains that it is not a modeled check.
3. Optionally edit the **synthetic-only** JSON representation. The demo refuses records not explicitly marked synthetic and limits input size to 18 KB. Do not paste real payment data.
4. Run rule checks. The toy rules cover basic IBAN check digits, BIC form, UETR syntax for SWIFT tracking contexts, selected party fields and deterministic evidence consistency. They **do not** verify external registers, XSDs, scheme rulebooks, sanctions, settlement, routing or payment truth.
5. If an original three-part synthetic address **explicitly** contains a city while the structured town field is empty, the lab proposes copying that city. **Nothing is applied automatically**; an explicit click and re-validation are required. No city is fabricated.
6. Preview **incomplete educational message examples** for `pacs.008`, `pacs.009 CORE/COV`, `pacs.002`, `pacs.004`, `pacs.003`, `pain.001`, `pain.008`, `camt.056`, `camt.029`, `camt.053`, `camt.054`, plus a legacy MT103 learning sketch and conceptual JSON for tracking/non-ISO retail contexts. Versions are illustration choices, **not CBPR+ SR26 or EPC/BoE/T2 MIG validation**.
7. View a UETR-based match of **fictional local events** (never a real SWIFT Tracker result), inspect evidence and download a labelled synthetic JSON investigation report.
8. **Explicitly send a bounded synthetic report** through `sessionStorage` to the free guest case-management page, open a case in an illustrative organisation and add reviewer notes/decisions. The original synthetic payment status is never modified by the review.

## Privacy, cost and connectivity

The public page is static GitHub Pages HTML, CSS and JavaScript. No account, Keycloak server, MFA, shared API key, database, external Gemini request or payment endpoint is used. It does **not** call SWIFT, EPC, T2, Bacs, Faster Payments, CHAPS or real payment participants. Inputs and guest-case notes stay in **browser tab session storage only** when a visitor chooses the one-time handoff and case workflow; exported files are saved to their own device. Visitors are not synchronised with one another. The original public Address Intelligence/Gemini service is unaffected.

The source code is publicly readable, so credentials **must never** be placed in it—even when the demo is anonymous and free.

## Limits and next engineering work

Coverage does **not** mean production validations or completed bank integrations. Missing features include scheme-specific official XSD/MIG libraries, CBPR+ yearly rule sets, official SWIFT APIs and message security/HSM, real gpi/g4C API credentials and trackers, UK scheme proprietary message parsers, centrally versioned EPC/SR release tests, real participant reference checks, authoritative settlement proof, DLP, sanctions screening and authenticated bank workflows. The synthetic case activity is not an immutable audit trail.

A possible future phase is a **versioned, independently tested rules-package catalogue** with explicit scheme/release IDs, plus a separate optional authenticated enterprise trial. Neither is needed for the current free demo.

## Run tests

From the GitHub repository root with Node 22 or later:

```bash
node --check web/studio/payment-intelligence/catalog.mjs
node --check web/studio/payment-intelligence/engine.mjs
node --check web/studio/payment-intelligence/messages.mjs
node --check web/studio/payment-intelligence/handoff.mjs
node --check web/studio/payment-intelligence/lab.mjs
node --test tests/payment-intelligence.test.mjs tests/open-demo.test.mjs
```

GitHub Actions runs every JavaScript test using `node --test tests/*.test.mjs`, the existing Python suite, and a dedicated Chromium/Playwright smoke workflow for desktop and mobile UI behaviour, JSON downloads, empty-search handling, private cross-page import and visitor isolation. The browser workflow runs on GitHub-hosted free tooling; it does not add production dependencies or collect user data.

## Primary reference material

- SWIFT — ISO 20022 / CBPR+
- SWIFT gpi for Corporates developer reference
- European Payments Council payment schemes
- Bank of England — CHAPS and RTGS
- Pay.UK payment systems
- ECB — TARGET services
- EBA CLEARING
- Sveriges Riksbank — RIX
- KIR — Polish payment clearing
- Danmarks Nationalbank — payments infrastructure
