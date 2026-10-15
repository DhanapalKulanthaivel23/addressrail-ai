# AddressRail AI — QA approach and acceptance matrix

**Source:** User-supplied testing approach, 15 October 2026. This file preserves the attached plan's test IDs and acceptance intent. It is a specification, **not a claim that every test already passes**. Automation that exists is linked to existing Playwright and node test suites.

## 1. Approach
- **Levels:** smoke every deploy (target 10 minutes), functional per page, responsive UI, accessibility, privacy/security, content accuracy and exploratory audience sessions.
- **Browsers to cover:** Chrome, Edge, Firefox, Safari, iOS Safari and Android Chrome.
- **Viewports:** 360 / 768 / 1280 / 1920 px.
- **Conditions:** private window, blocked storage, slow 3G, 200% zoom, offline after load.
- **Test data:** entirely synthetic; no genuine payment credentials or customer details.

## 2. Global tests for all 21 page/deep-link URLs
| ID | Test and expected result | Initial automation |
|----|----|----|
| G-01 | Each URL HTTP 200; one H1; title and canonical match; no JS errors | Playwright site-acceptance |
| G-02 | All anchors resolve, no bad internal/external links, external noopener | Pending external/nightly crawl |
| G-03 | mode/module/scenario/case/beginner/rail deep links select and safely fall back | Playwright site-acceptance (selected routes) |
| G-04 | Same nav, correct active page, Studio route works | Playwright site-acceptance |
| G-05 | No sideways scroll at 360; scrollable code/tables; minimum 44px targets | Playwright sample viewport checks |
| G-06 | Keyboard, skip link, focus/tooltips, axe with no serious results | Partial; axe and assistive tech pending |
| G-07 | Synthetic disclaimer, review date/version, no fake certification | Shared-shell unit + Playwright |
| G-08 | Storage blocked, progress reset, expected persistence | Playwright blocked-storage |
| G-09 | Empty/malformed/1MB input/wrong file/double-click friendly errors | Existing tests partial |
| G-10 | No unauthorised model calls/secrets/XSS | Existing deterministic API tests; security review pending |
| G-11 | Mobile LCP <2.5s, CLS <0.1, offline after load | Lighthouse CI pending |
| G-12 | Fresh published plain+query version stamp within 15 minutes | GitHub Pages freshness workflow |

## 3. Page case IDs (full specification from the attached checklist)
- **HOME-01–10:** structured/unstructured/MT103 parser, no invented address, upload/empty errors, deterministic JSON, Gemini consent, before/after, resilient visitor stats.
- **STU-01–07:** audience routes, all eight modules and invalid fallback, failure stage stopping, quiz and replay, roadmap status, single NEW banner and anchors.
- **START-01–05:** tab-private completion/reset, glossary interaction, five-stage diagram, links and three-user comprehension trial.
- **J-01–12:** modes, fullscreen/ESC, all 43 contexts, 24 scenarios, sender/receiver, evidence, reproducible rules, JSON export, once-only case handoff, scripted AI and six quizzes.
- **P-01–08:** 43/8 filter, 43 contexts, nine scenarios, JSON validation/error/reset, address proposal, incomplete XML message downloads, UETR, report/handoff.
- **C-01–08:** IBAN, BIC, amount edge cases, escaping, four messages and status boundaries, tabs/copy/download.
- **I-01–06:** four instant scenarios x RT1/TIPS, unknown vs reject, case export, deep link and rulebook date.
- **K-01–06:** pacs.008/009 CORE, invalid amount, liquidity hold and unknown, hash deep link, operator references.
- **A-01–07:** eight authored claims, own-claim guardrails, paraphrase gaps, injection, no network, qualified ALLOW, deep links.
- **U-01–10:** names/XSS, counters, filters, synthetic cases, one-time handoff, state transitions, notes, decisions, tab isolation/export/reset.
- **D-01–07:** guide title/meta/H1/canonical, XML sequence, MT103 50F, links, dates/status and expert review.

## 4. Synthetic test data
- **Valid IBAN:** GB82 WEST 1234 5698 7654 32; DE89 3704 0044 0532 0130 00; FR14 2004 1010 0505 0001 3M02 606.
- **Invalid IBAN:** DE88 3704 0044 0532 0130 00; DE89 3704 0044 0532 0130 0; BR1800360305000010009795493C1 (valid-looking, not SEPA).
- **Valid BIC:** DEUTDEFF; DEUTDEFF500. **Invalid BIC:** DEUTDEF; DEUT12FF.
- **Amounts:** valid 0.01, 1234.56, 999999999.99; invalid 0, -5, 12.345, 1,5, abc.
- **UETR:** eb6305c9-1f7f-49de-aed0-16487c27b42d; invalid version example eb6305c9-1f7f-39de-aed0-16487c27b42d; and not-a-uuid.
- **XSS:** <img src=x onerror=alert(1)> and "><script>alert(1)</script>.
- **Address:** 10 High Street, London, GB; no-comma: 10 High Street London.

## 5. Automation still required
Playwright deep-link/selector/storage tests; axe-core/Lighthouse CI; nightly link checker; licensed ISO base-schema validation with vetted schemas; visual regression at 360/1280; limited Gemini backend consent/origin/quota contracts; live cache-busted post-deploy checks.

## 6. Exit criteria
G-01/G-03 + one path per lab + HOME-01/A-01/U-05 pass; no critical/high bugs; axe no serious errors; date/version status verified; **critical** if a simulated UNKNOWN/REJECTED payment is shown as SETTLED.

## 7. Exploratory audience tests (human, 30 min)
Expert: present SCT Inst timeout and share link in 3 minutes. AI expert: reject unsupported claim and explain uncovered cases in <5 minutes. Learner: complete start path and correctly explain who/what/success-vs-failure/AI help.

**Noncoverage disclosure:** Several acceptance cases need licensed schemas, real browser/device farms, external link scans and human expert review; no result is inferred without execution.

## Expanded module coverage
Six dedicated rail URLs (SDD, FPS, Bacs, T2, CBPR+, CLS) extend the original 14-page/21-URL baseline to **20 content pages and 27 URL/deep-link combinations**. The original attached test IDs remain the acceptance baseline; check new cases and links in the same global suite.
