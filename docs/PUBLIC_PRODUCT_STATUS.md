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
- Future vendor **product** release changes and Swift/ISO **scheme** release changes must stay distinct. Public descriptions may link original sources but should not copy licensed materials.

Original public UI layout and wording remain under user control. This documentation-only update does not touch Cloudflare, GitHub Pages configuration, the website's visitor counter or external accounts.

**Full product design history and release rule-engine details are maintained privately.** The public website must not expose private implementation or confidential integration logic.
