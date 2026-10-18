# AR-060 — Complete AddressRail SaaS Demo Integration

18 October 2026. **PARTIAL**. This is the first integration increment, not a completed SaaS release.

The public checkout is `AddressRail/addressrail-ai`. The separate top-level `addressrail-ai` checkout has existing uncommitted documentation and is untouched. Private main was refreshed to `04b233c`; public main was refreshed to `050d4c7`. No proprietary source or fixtures were copied into the public project.

## Verified inventory through AR-059

| Component | Existing evidence | Boundary |
| --- | --- | --- |
| Public website | Static Payment Studio, Academy, cross-rail intelligence lab, guest cases, rail workbenches | Retained existing URLs and implementation |
| Public message catalogue | Worker message recognition and per-scheme workflow support | Recognition is separate from processing |
| Public Worker examples | Ten Worker bundles, synthetic flows, D1 orchestration and local runtime tests | Public deployment not established |
| Private AR-022–030 | Lifecycle evidence, returns, notifications, durable outbox and transport workers | Retained privately; broker simulation does not establish connectivity |
| Private AR-031–041 | Address extraction, evidence review, persistence, candidate previews and local REST | Retained privately; no official scheme certification |
| Private AR-042–047 | Optional Gemini provider, evaluation and provider safety tests | Mock/provider tests do not prove a configured live provider |
| Private AR-048–055 | Synthetic admission, native MX, version registry, CBPR subsets/lifecycle and REST | Implemented subsets; complete MT/MX support not established |
| Private AR-056–059 | Local no-login workbench, unified inspection, validation report and three fictional samples | Local interfaces, not public hosting |

The initially stale local ledger ended at AR-021. Refreshing origin revealed the existing AR-022–059 changes; no historical events were recreated. R1 FOUNDATION, R2 PAYMENT ENHANCEMENTS and R3 ADVANCED PAYMENTS are product editions. SR2025/SR2026 are separate research profiles. No third standards release was inferred.

## Implemented increment

`web/studio/shared/product-registry.mts` defines typed product configuration derived from the existing public rail catalogue and fixtures. The existing lab now generates grouped, expandable product navigation and capability details from that registry. Unsupported transformations remain PENDING; absent deployed API entries generate no Postman requests. Empty version/release lists mean no versioned standards validation is declared by this public metadata demonstration.

`demo-engine.mts` executes the existing public metadata validator through a bounded versioned JSON contract. It runs without DOM, credentials, storage or network access. It records only the RECEIVED and CHECKED stages it actually executes, including payloads, findings, fixed synthetic timestamps and correlation. Input timeline claims remain illustrative scenario evidence. The private Python/Java/Go engines are unchanged; this is not an adapter claiming their execution.

TypeScript source is canonical. `npm run build:demo` regenerates the checked-in `.mjs` files for the existing buildless GitHub Pages frontend. This incremental integration retains the current framework; React/Vite/Tailwind/React Flow and workspace migration remain pending.

## Validation

- `node --test tests/*.test.mjs`: 106 passed, including real local Worker/D1 tests, after enabling loopback access.
- `../.venv/bin/python -m unittest discover -s tests -p 'test_address_*.py'`: 67 private address tests passed with loopback access.
- Registry scenarios: reproducible execution, no input mutation, unsupported product/scenario rejection, size bounds and conservative metadata.
- Vitest contract tests: approved original-evidence correction revalidated and cross-product payload rejection.
- Playwright browser smoke passed on desktop/mobile, including grouped navigation, inspectable execution evidence and existing export/guest-case interactions.
- Site acceptance passed: 20 pages, 7 deep links, blocked-storage recovery and 360/768/1280/1920 viewport checks.
- Strict TypeScript compilation and 2 Vitest contract tests passed. The patched Vitest dependency installation reported zero vulnerabilities. CI uses Node 22; local Node 23 is outside Vitest’s declared support range.
- Remote CI and deployment evidence are recorded only when actually verified.

## Remaining work

Full product navigation including AddressTune/AML/transport modules, applicable top tabs, unified message editors and actual conversion mappings, registry-backed anonymous APIs and Postman/Newman, private-engine JSON adapters, execution-driven graph arrows, IndexedDB recovery, AI retrieval transparency and live configured-provider evaluation remain PARTIAL/PENDING. No capability is upgraded to DONE by this increment. No authentication, paid services, secrets or real banking connectivity were introduced.
