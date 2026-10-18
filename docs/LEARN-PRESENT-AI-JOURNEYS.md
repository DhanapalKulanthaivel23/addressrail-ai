# AddressRail AI — Learn, Present & Explore Banking AI

**Live URL:** referenced documentation

## One engine, three experiences

1. **Banking professionals:** Choose *Banking professional*. Use the full-screen presentation layout, map the entities involved, step through messages and explain why a scheme, operator, tracker and settlement system are not interchangeable. Export the synthetic scenario when presenting.
2. **AI/LLM specialists:** Choose *AI / LLM specialist*. Compare deterministic findings and evidence with a **scripted hypothetical LLM explanation**. The public page does not call a model. Explore the separately runnable [local Python LangGraph agent](../ai-agents/investigation/README.md) to study actual optional model calls and guarded validation.
3. **Beginners:** Choose *New to banking*. Select a payment context, read the distinction, follow each sender → receiver → message step, inject an exception, run limited validation and answer the learning question. Six quiz completions may be remembered **only within that tab**.

No registration, credentials, payments, bank connection, certified rules engine, official participant messages or external model usage. All generated data is fictitious. Do not enter real data.

## Coverage layers

- **43 introductory contexts:** the existing catalogue includes separate schemes, settlement infrastructures, overlays, networks and processing systems. The connections explorer uses **curated educational links**, not an exhaustive real network-graph, live participant directory or automatic routing algorithm. If no connection is curated, it explicitly says so. See the [43-context coverage matrix](UK-EU-PAYMENT-COVERAGE-MATRIX.md).
- **Six deep journeys:** CBPR+/gpi (messaging and tracking), EPC SCT (scheme versus CSM), SCT Inst (scheme with RT1 or TIPS *as alternative routes*), CHAPS/BoE RTGS (gross settlement), UK Faster Payments (customer processing versus settlement), Bacs (Direct Debit focus; Direct Credit explained as distinct).
- **24 synthetic scenarios:** four per journey, including illustrative success and three distinct exception outcomes. A failure trace ends at the exceptional stage, without fictitious downstream acknowledgements.
- **Message and evidence viewer:** each step describes *who sends*, *who receives* and *what is exchanged*. A generated message is deliberately incomplete; FPS and Bacs show conceptual records rather than invented ISO 20022 or production Standard 18 submissions.
- **Validation and cases:** limited deterministic checks run in the browser. Deep links take a context into the existing Cross-Rail validator with an applicable example fault. Scenario reports can be exported as JSON and handed to one-time same-tab Guest Case Management. Validation of a toy record cannot prove the fictional lifecycle status, scheme conformance or settlement.
- **AI replay:** compares a deterministic finding with a **prewritten model of what an evidence-grounded assistant could explain**, plus required human intervention and prohibitions. No LLM result, performance metric, sanctions decision or automatic payment action is implied.

## How to demo

Select **Banking professional**, choose CHAPS, run *Liquidity queue / hold*, walk through originator, participant, messaging and RTGS, and inspect the missing settlement evidence. Use full-screen mode to present.

Select **AI / LLM specialist**, choose *SCT Inst → Unknown outcome*, inspect the missing response and compare deterministic status versus hypothetical assistant commentary. Do not present the replay as actual Gemini output; explain the danger of blind retries.

Select **New to banking**, choose *Bacs Direct Debit → Mandate missing*, advance to the failure stage, test validation (missing mandate), inspect its conceptual message and answer the quiz. Review Bacs Direct Credit separately in the catalogue.

## Payment domain control notes

- CHAPS is the sterling payment system and Bank of England RTGS is the gross settlement infrastructure; do not assume an instruction transmitted over Swift is settled.
- SCT Inst is a Euro payment scheme; RT1 and TIPS are distinct infrastructures, not one required chain.
- Bacs Direct Debit mandate-based collection differs from Bacs Direct Credit submission. Dates, cut-offs, reporting and responsibility vary.
- FPS is a UK retail system; a customer-facing near-real-time response differs from underlying interbank settlement.
- CBPR+ is cross-border messaging; gpi tracking is not a separate clearing or settlement rail.
- For the current EPC schemes in **October 2026**, 2025 SCT and SCT Inst rulebook **v1.2** took effect on **30 September 2026**. The EPC postponed the previously announced November 2026 end date for unstructured postal addresses; no replacement deadline is asserted. Consult the current SCT rulebook and SCT Inst rulebook before introducing release-specific validations.

## Further enhancements (not implemented yet)

Role-tailored curricula with many lessons, downloadable slide decks, a fully comprehensive 43-rail scheme-rule parser, live XSD and scheme MIG validation, actual LLM evaluations and RAG, recorded lab certificates, shared identity and multi-tenant deployments, and commercial-grade evidence/settlement integrations remain future scope.

## Tests

```bash
node --test tests/journeys.test.mjs
node --test tests/*.test.mjs
# browser workflow installs Playwright Chromium and runs both static-site smoke tests
```

Maintainers: GitHub Actions runs the unit suites and browser journeys after changes to this public workspace.

## v2 guided entry points

The public Start Here has five beginner lessons and a glossary; SCT Inst and CHAPS have enhanced browser-only exception workbenches.

Professional presenters can share a `/studio/journeys/?mode=professional&rail=chaps&scenario=liquidity-hold` link. Each guided journey shows a timed three-minute presentation script and `SIM-*` (authored scenario) / `DEMO_*` (toy input-check) IDs. These **are not real payment scheme rule identifiers**.

AI specialists can try the guardrail playground, comparing fictional payment evidence with eight authored candidate claims and deterministically rejected assertions. No live model is called. The local LangGraph optional Gemini agent remains separate.
