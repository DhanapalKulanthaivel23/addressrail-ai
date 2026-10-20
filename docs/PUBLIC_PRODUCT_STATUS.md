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

## Workbench palette delivery correction (18 October 2026)

Refresh committed workbench build assets from the latest AR-063 source, preserving the warm ivory, charcoal and soft-blue homepage theme and AR-062 learning tools. Set the initial page canvas and browser theme to warm ivory as well.

## Protected Gemini workbench integration (18 October 2026)

PARTIAL: optional Ask Gemini after synthetic CBPR+, SCT, SCT Inst, SDD Core and SDD B2B checks uses the existing Render endpoint with explicit consent, Turnstile verification and server quotas. Only the rail, executed stages and bounded finding codes are sent, excluding payment fields. Successful provider/model provenance is shown separately from unchanged deterministic execution; failures remain explicit fallback. No knowledge retrieval is invoked and no RAG citations are fabricated. Human review is required and AI cannot apply corrections or authorise payments.

Validation: TypeScript/Vite build, 23 Python tests, 111 JavaScript tests, existing browser regression suite and mocked-provider five-rail browser coverage pass locally. Mocked tests do not establish a real Gemini call. GitHub Pages publication and the Render backend revision require post-merge verification; this entry does not claim either deployment has completed.

## Grounded workbench AI concepts (19 October 2026)

PARTIAL: the same protected Render endpoint now runs a bounded LangGraph review with typed read-only finding-definition and curated-source tools for all five workbench rails. Local lexical TF-IDF retrieval provides versioned original summaries to a schema-constrained Gemini request. Independent checks reject unsupported citation IDs, changed finding codes and selected unsafe claims. Provider failures and rejected output remain explicitly deterministic fallback. The UI distinguishes retrieved context from cited sources and offers a local review acknowledgement that does not approve payments.

A five-rail evaluation corpus measures retrieval hit@3 and structural/safety contracts, complemented by adversarial and browser tests. Default evaluation uses authored fixtures, not live AI. A separately gated manual genuine-provider workflow is available; its existence does not establish a passed live evaluation. No semantic-accuracy, real bank processing, protected-group fairness, autonomous tool selection or production governance claim is made. See [system scope, evaluation and limitations](WORKBENCH-AI-SYSTEM-CARD.md).


## PUB-017 — 43-context protected public-safe Gemini learning coverage (20 October 2026)

The React Workbench now offers opt-in Gemini review after synthetic checks for **all 43 registered educational contexts**, rather than just CBPR+ and four SEPA contexts. Frontend controls derive from the same payment product registry; backend rail identifiers derive from an expanded curated public-safe knowledge catalogue. Each of the other 38 contexts has its own conservative educational summary linked to this public catalogue, with no claim of official rules, rail participation, clearing outcomes or certified MT/MX conformance. Existing five narrower curated sources remain available. Only the rail, executed stages and small deterministic finding codes leave the browser after explicit consent and Turnstile; prompt/response guardrails, rate limits and human review remain.

The private R1/R2/R3 knowledge archive **does not move into the public repo and is not transmitted to free-tier Gemini**. A public-context reference is only a general learning summary, not the private archive or an official scheme implementation guideline. This change does not deploy or connect the private source repository, verify actual production payment APIs, certify all 43 payment contexts, or demonstrate a live provider invocation by itself. Tests cover catalogue parity, validation boundaries, retrieval isolation and mocked browser flows.

## PUB-018 — Fail-closed ISO message version catalogue (20 October 2026)

A public feature branch adds explicit registration of installed ISO base XSDs `pacs.008.001.13` and `pacs.008.001.14`, with tests and a dedicated CI check. Other `pain.*`, `pacs.*` and `camt.*` versions remain unregistered until independently sourced and checksum-pinned; no SWIFT MT full syntax check or scheme conformance is claimed. This is version inventory groundwork, not a complete standards implementation or certification, and does not copy private network rules into the public repository. Merge and deployment remain conditional on passing CI.

## PUB-019 — Exact RAG source-version filter (20 October 2026)

The investigation TF-IDF knowledge store now supports an optional **exact** source metadata version filter, while retaining existing effective-date/rail filters. Synthetic regression fixtures distinguish SR2025 and SR2026 source versions, reject invalid filters and avoid treating an effective year as scheme applicability. This internal retrieval feature does not yet wire a scheme version selector into every UI/API call or constitute live Gemini, embeddings, complete licensed standards ingestion or official banking rule validation. Merge remains contingent on CI.

## PUB-020 — MT/MX-first workbench (20 October 2026)

The first Workbench screen now offers **SWIFT FIN MT** and **ISO 20022 MX** message review. Pasted text remains in the browser. The bounded format checker handles FIN block/tag presence, basic MT103 reference/amount syntax, XML well-formedness, pain/pacs/camt namespace recognition and basic BIC shape. Safe suggested repairs (missing MT terminator or casing an existing BIC) are previewed and applied only after a user click, with local revalidation. No payment facts are invented. The protected RAG/Gemini option sends only allowlisted format and finding codes through Turnstile/consent; it never receives pasted raw message content. Existing JSON simulation remains reachable through the secondary Workbench link.

**Known gaps:** not arbitrary-message correction; no comprehensive licensed FIN field rules, on-page pinned ISO XSD engine, scheme profile checks or certified business outcomes. Other syntactic or semantic errors may require manual intervention. Live Gemini access remains conditional on configuration, quota and user consent; mock CI is not a live-provider accuracy claim. This is an educational synthetic-only interface.

## PUB-021 — FX message recognition and MT/MX Gemini routing fix (20 October 2026)

The MX editor recognises four-letter ISO 20022 business areas including archived `fxtr.014.001.05` rather than rejecting everything outside pain/pacs/camt. Local FX V05 checks flag missing or unexpected first-level instruction sections and incorrectly shaped AnyBIC values. The browser does not execute the official FX XSD, CLS-specific rules or full ISO validation. The protected MT/MX AI endpoint now follows the existing retrieval/LangGraph explanation path rather than the legacy address-review Gemini endpoint, with curated FX archive source context. Raw pasted messages remain browser-local; only allowlisted finding codes are transmitted with user consent. A configured Gemini key, Turnstile, provider response and backend deployment are still required for live AI explanations. These changes do not certify the user's sample or infer missing trade data.

## PUB-022 — Inline MT/MX review in main Workbench (20 October 2026)

The MT/MX validator is no longer presented as a separate initial application shell. It is now the first, prominently highlighted navigation button above **Products** in the existing Workbench sidebar. Clicking it renders the two MT/MX choices, local review and optional protected RAG/Gemini explanation directly in the same content workspace, while the SWIFT/SEPA/UK navigation stays visible. The existing payment scenario testing, AML and transport tools remain accessible and unchanged. This is a user-interface integration only: no new schema-backed FX/SWIFT coverage, real-message acceptance, or live AI guarantee is implied.

## PUB-023 — Cleaner MT/MX error review screen (20 October 2026)

Keep the MT/MX validator in the existing Workbench sidebar and its two MT/MX cards in the main area. Remove long technical notices, unsupported internal validation-status codes and provider branding from the message-review screen. Show human-readable error titles, precise FIN/XML element paths, concise cause and context-specific fix guidance. When a safe text-only correction exists, it still requires explicit approval and recheck. An optional vendor-neutral AI recommendation button remains protected by external-AI consent and verification; pasted raw message data is not included in requests. The underlying checks remain an educational subset, not comprehensive standards or scheme conformance.

## PUB-024 — Field-level message error findings and specific AI evidence (20 October 2026)

MT103 and MT202 now have basic required FIN field, payment amount/date and charge-option checks, with fail-closed handling of unsupported MT identifiers. Exact-version MX shape-check subsets cover pacs.008.001.13/.14, pain.001.001.09, camt.053.001.14 and the prior fxtr.014.001.05 structural checks. An intentionally invalid example reveals the error, field path, reason and suggested correction immediately. For unsupported versions, the UI explicitly reports missing rules rather than accepting them. No generic AI explanation request is offered for clean local findings; real findings pass only strict path metadata and approved codes into RAG, never pasted content. When an external model fails or is unavailable, deterministic guidance can still identify the affected fields. **Scope limit:** These are educational targeted checks, not full official FIN field catalogs, XSD execution, release-specific banking scheme validation, certified correctors or settlement evidence.

## PUB-025 — Concise checks-passed result with extracted message facts (20 October 2026)

On local MT/MX checks with no findings, the message review displays a concise checks-passed state and actual message metadata available in the submitted text (type/reference/amount/currency/date), instead of generic model-generated recommendations or an AI review panel. The summary is computed in the browser; it does not send raw content to the backend, invent absent fields or imply the payment settled. Error-bearing messages continue to show locations, explanations and optional AI guidance. Passing these limited format checks is not comprehensive FIN, XSD or payment-scheme conformance.
