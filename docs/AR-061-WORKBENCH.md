# AR-061 — Shared interactive workbench

18 October 2026. Product coverage remains **PARTIAL**.

`apps/workbench` is an additive React/TypeScript/Vite frontend. It compiles to the existing GitHub Pages tree at `web/studio/workbench/`, linked from Banking Studio. The existing pages and private Python, Java and Go implementations are retained. A workspace migration is unnecessary for this single public package; the existing npm lockfile is retained.

The UI uses Tailwind CSS, Lucide React and React Flow. Configuration comes from AR-060's typed product registry. There is one editor/control/flow implementation for all registered products. Two executed steps are shown, RECEIVED and CHECKED; an input scenario timeline is not presented as executed banking infrastructure. Clicking nodes or arrows shows actual input/output, message type, findings, result, fixed synthetic timestamp and correlation.

Payment input is the existing synthetic JSON contract, not an official MT/MX wire format. Baseline and error fixtures, validation, output inspection, report/message downloads and explicitly approved original-evidence town correction are functional. Revalidation reports internal findings and never awards scheme certification. Unsupported MT/MX conversion returns BLOCKED with no fabricated output. No external network request or real banking broker is introduced.

IndexedDB stores only the latest synthetic draft, with clear, validated recovery and in-memory fallback when storage is blocked. Never enter real customer records. AI transparency shows deterministic findings, proposed correction, revalidation status and explicit DETERMINISTIC_FALLBACK; model and retrieval are absent and no sources/scores are invented.

## Verification

Strict TypeScript and Vite build pass. `tests/workbench-browser.mjs` exercises fixtures, negative findings, blocked conversions, approved repair/revalidation, graph nodes/arrows, AI status, IndexedDB recovery/clear, invalid input, blocked storage and a 390px viewport. Existing browser smoke and site acceptance remain required. CI rebuilds committed assets and rejects differences. Source maps are disabled; only public educational engine code enters the bundle.

## Limits

Anonymous REST definitions, Postman/Newman, comprehensive message mappings, all requested platform modules, standards release schemas/rules, private-engine adapters, Gemini/RAG execution and Cloudflare deployment remain pending. Empty registry API/version/release entries are deliberate scope boundaries. No new product is declared DONE.

AR-060 PR #31 merged as `15115eceeddb62aeec9b344c486265a76544c1f5`; all six PR checks and the main Pages deployment passed. The deployed engine file SHA-256 matched the reviewed source (`9d82c566f469b8f5cb6ce8aa807b05f4732e11be257472b9e8715b329636ab55`). The broader retained private suite ran 252 tests, with 27 optional integrations skipped.

The append-only evolution gate also covers `apps/` source changes, so source-only frontend changes require ledger and status evidence.
