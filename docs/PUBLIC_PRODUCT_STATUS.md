# AddressRail public roadmap and change history

**Updated: 18 October 2026.** This is a **public-safe** history of the AddressRail AI demonstration and customer-facing product. It deliberately excludes proprietary network engines, sanctions rules, private repositories, credentials, source-paid guideline files and private tenant data.

### From initial demo to the final customer offering

| Phase | Public evidence | Honest status |
| --- | --- | --- |
| Early demo | MT103/pacs.008 synthetic address quality and report download | Available educational testing scope |
| Multi-rail Payment Studio | Educational banking contexts and example flows | Partial; not all payment standards or backend services certified |
| SaaS concept | Payment intelligence, rule changes, AI-assisted investigation, tenant dashboards and broader payment cycles | Target; not all implemented or cloud deployed |
| Payment API integration | Synthetic private-backend API integration and repo development branches | Requires independently verified deployment/contract tests |
| Customer-ready platform | Authentication, controlled rule packs, exceptions, screening and reconciliation, complete secured hosted SaaS | Not verified as production-ready |

The **target payment journey** is: user uploads a synthetic MT/MX payment → identifies scheme and message version → validates against source-backed rules → optional screening/investigation → synthetic Sender/Receiver outcome → customer status/report. Real settlements, live SWIFT certification and a production AML decision are **not** provided by this public demo.

### How evolution is recorded

- `docs/product_evolution.json`: append-only public change events; historical entries are never rewritten.
- `docs/PUBLIC_PRODUCT_STATUS.md`: this snapshot must be updated with every customer-facing design or functional change.
- `scripts/check_public_evolution.py` and GitHub PR workflow enforce updates on modified public web/frontend/service sources.
- Demo **R1/R2/R3** feature notes are versioned separately from the ISO 20022 message namespaces and any actual network usage rules. Public descriptions must be independently written, with no outside publication links or copied source text.

Original public UI layout and wording remain under user control. This documentation-only update does not touch Cloudflare, GitHub Pages configuration, the website's visitor counter or external accounts.

**Full product design history and release rule-engine details are maintained privately.** The public website must not expose private implementation or confidential integration logic.


## Governance integration scope (18 October 2026)

PR #29 introduces only this public-safe ledger, status, validator, governance tests and workflow. Existing website files, first-party links, public URLs, Payment Studio and Academy remain exactly as on main. Unrelated offline rebranding and its new policy test are deferred together; no existing main-branch tests are removed. No website or Cloudflare deployment is performed by this change.

PUB-006 records an earlier branch intent; it is retained as history. PUB-007 corrects the integration scope. R1/R2/R3 are AddressRail product editions, separate from payment standards releases SR2025/SR2026.

PUB-008 extends the evolution gate to existing backend and packaging directories. Four governance tests verify append-only history, safe statuses and missing-evidence rejection for website and backend changes.

PUB-009 records the merged public synthetic Worker example packaging. Local workerd/D1 contract tests and ten dry-run bundles passed; no external deployment or live network connection occurred. These examples are separate from the private commercial core.

## AR-060 integration increment (18 October 2026)

PARTIAL: typed public registry, grouped navigation and reproducible metadata-check execution in the existing lab. Node regression: 106 passed; private address suite: 67 passed. No scheme certification, full MT/MX mapping, deployed API, live Gemini or complete SaaS claim. See [integration evidence and remaining work](AR-060-INTEGRATION.md).

## AR-061 workbench increment (18 October 2026)

PARTIAL product coverage with a shared React/TypeScript/Vite frontend at `studio/workbench/`. The public registry generates product navigation and tabs; executed checks drive the React Flow graph. IndexedDB stores only the last synthetic draft locally, with recovery/clear and blocked-storage fallback. Unsupported MT/MX conversions are BLOCKED. Correction approval triggers deterministic revalidation without awarding official verified status. Private engines are preserved. Full banking message processing, API deployment, retrieval and live Gemini integration remain pending.

## AR-062 browser screening and channel learning increment (18 October 2026)

PARTIAL: The existing no-login React payment workbench now includes a cross-rail AddressTune review tab, a deterministic fictional-name AML screening tab with small temporary browser-only watchlists, and educational REST/MQ/Kafka/File/SFTP response demonstrations. Screening is not real sanctions or PEP screening, name-match strength is not a statistical probability or legal conclusion, and there is no real broker, file transfer, funds movement, external banking network or live Gemini call. The private Python/Java/Go services are unchanged and not exposed on the public website. The frontend is built from source by CI and the GitHub Pages deployment workflow, rather than serving a stale prebuilt workbench when React source changes. Full message conversion, official CBPR+/SEPA rules and cloud API integration remain pending.

## AR-063 — Payment Rail workbench branded as the primary UI (18 October 2026)

The primary no-login public product is now documented as the [Payment Rail / Transaction Simulation Workbench](https://dhanapalkulanthaivel23.github.io/addressrail-ai/studio/workbench/). Its React UI adopts the homepage's warm ivory background, dark charcoal left navigation, sky-blue action accents and copper highlights without changing payment execution logic. README starts with the workbench and accurately distinguishes browser simulations from real messaging and certification. The legacy homepage and educational routes remain accessible. No new full standards validation, live Gemini, actual MQ, SWIFT settlement or public backend deployment is claimed.
