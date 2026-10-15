# AddressRail AI backlog implementation matrix (15 October 2026)

This is a transparency ledger for the user-supplied AR-101 through AR-507 stories. It distinguishes **fully/meaningfully implemented in a synthetic educational context**, **partial**, and **not done**. An implemented item may still require external standards review or human-device accessibility sign-off. No regression green result is equivalent to ISO/scheme conformance.

| Ticket(s) | Status | What exists and important gap |
|---|---|---|
| AR-101 | Implemented | One generated 20-page top navigation, current-page marker, mobile horizontal scroll. |
| AR-102 | Partial | URL/localStorage role persistence and context-specific guidance across pages; detailed role-specific show/hide inside every separate lab not implemented. |
| AR-103 | Implemented | Three audience paths on home, validator at #demo, preserves #home. |
| AR-104 | Implemented | Studio has a single dated What's new details panel. |
| AR-105 | Partial | Footer release stamp and Pages plain/query cache check; manual private-window sign-off still necessary. |
| AR-106 | Partial | On-deploy Playwright across 27 URLs and key deep links, not every possible query permutation or browser Back scenario. |
| AR-107 | Implemented (education) | SDD, FPS, Bacs, T2, CBPR+, CLS have distinct pages/canonical/sitemap, not certified engines. |
| AR-201 | Partial | Educational postal-address XML order corrected, no licensed ISO XSD validation executed. |
| AR-202 | Implemented (examples) | ISO page contains unstructured/hybrid/structured styles; no schema conformance claim. |
| AR-203 | Implemented (guide) | Source-backed MT103 CBPR+ migration milestone with contingency caveat, synthetic Option 50F. |
| AR-204 | Implemented (dated) | Shared Swift/EPC/BoE timeline and source links in four requested pages, owner named. |
| AR-205 | Implemented | Common provenance/version/review date on every page. |
| AR-206 | Implemented | Prefilled GitHub content-error issue route; owner must enable issues/template support. |
| AR-207 | Implemented | Uniform real/rule-subset/simulated three-line box on every page. |
| AR-301, AR-302 | Partial | Browser synthetic-XML paste and basic rule IDs/paths on SCT/SCT Inst/CHAPS, not a full ISO parser or reliable PII detector. |
| AR-303 | Not done | ISO base XSD browser validation and licensed schemas need specialist implementation/review. |
| AR-304 | Partial | Six guided journeys and six additional rail overview pages have 3-minute scripts; not all 43 catalogue contexts. |
| AR-305 | Partial | SDD Core/B2B public conceptual lab covers mandate/pain.008/pacs.003 and 6 simulated exceptions; not full scheme message validation/refund logic. |
| AR-306 | Implemented (education) | FPS, Bacs, T2, CBPR+ dedicated synthetic failure cases, messages, scripts. |
| AR-307 | Implemented (education) | Compare 2–4 detailed rails, sources, shareable URL and print. |
| AR-308 | Partial | Guided journeys have copy URL and printable outcome; other labs export JSON but not all have one-page print. |
| AR-309 | Implemented (education) | SCT Inst late negative reply after timeout and reconciliation trace, synthetic only. |
| AR-401 | Not done | Real recorded model outputs cannot be invented; needs actual controlled LLM runs and provenance. |
| AR-402, AR-403 | Implemented (authored examples) | Four adversarial inputs, per-rule outcome table, 8 original fixtures; not real LLM resistance benchmark. |
| AR-404, AR-405, AR-406 | Implemented (reference) | Twelve use cases with risk/controls/metrics, SVG local-only architecture, UK/EU governance notes. |
| AR-407 | Partial | Shared AI-use suggestions and caution panels on primary labs, not each of 43 contexts. |
| AR-408 | Completed decision (NO) | See BYOK risk analysis; no direct browser key input built. |
| AR-501, AR-502 | Implemented (first three cards) | SCT Inst, SCT, CHAPS consistent actors/messages/settlement/AI/5 quizzes; six others have overview cards but no 5-question quiz. |
| AR-503 | Implemented (education) | Side-by-side success/failure on journeys and 3 template cards. |
| AR-504 | Implemented | Eight lessons cover SDD, RTGS and Swift; still synthetic. |
| AR-505 | Partial | 72-term site-wide searchable keyboard disclosure, but not every term is automatically linked to a lab and every inline occurrence is not tooltipified. |
| AR-506 | Implemented | Tab-local self-reported progress bar/next/reset with storage-failure catch. |
| AR-507 | Implemented | Shared level metadata on all 20 content pages. |

## Acceptance test tracking

The user-provided test approach is reproduced as a coverage matrix in [QA-APPROACH.md](QA-APPROACH.md). Node/unit tests + Playwright Chromium browser smoke run in GitHub Actions. The expanded acceptance checks include navigation on every page, 27 URL/deep-link combinations, 360/768/1280/1920 dimensions, blocked storage, rail failures, comparison, glossary, user-created XML rule results and agent simulation.

**Not accepted as complete without further testing:** full G-02 link crawl, G-05 minimum all tap targets, G-06 axe/assistive-tech browser audits, G-09 1MB file and wrong-file permutations, G-10 full security/privacy audit, G-11 Lighthouse real-mobile LCP/CLS/offline, all specified browsers (Edge/Firefox/Safari and mobile devices), user exploratory sessions, expert standards sign-off, and licensed base ISO XSD conformance.

The critical defect standard applies across all stories: **Never display an unknown/pending/rejected synthetic payment as settled.** Actions status is not an official scheme outcome.
