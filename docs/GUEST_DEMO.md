# AddressRail AI — public guest case demo

**Live URL:** referenced documentation

Open it from any browser. Visitors can enter the case workspace **without an account, password, MFA, API key, Keycloak installation, or local server**. Give the URL to a prospective client, colleague or learner.

## What guests can try

- Start with an optional *fictional display alias* (not a login or authenticated identity).
- Switch between two **illustrative organisations** (only a client-side filter, not true data isolation).
- Inspect sample synthetic payment exceptions from SEPA SCT, SCT Inst RT1/TIPS and CHAPS.
- Create another synthetic case from a prebuilt scenario, inspect recorded fictional events, and read a deterministic explanation and recommendation.
- Assign a fictional case owner, add a synthetic note, move a case through `OPEN`, `IN_REVIEW`, `ESCALATED`, and `CLOSED`.
- Record `APPROVED_FOR_TRAINING` or `REJECTED_FOR_TRAINING` for a training case; export one case as synthetic JSON; reset the workspace.

**This demo has no payment initiation, settlement, bank connections, live LLM or real user identity checks.** A training decision never changes the recorded synthetic payment status and is not bank authorisation.

## Storage and sharing

This is a **static GitHub Pages application**. Synthetic cases and notes are stored using browser `sessionStorage`, only in the current browser tab. They survive a page refresh within that tab, but are not synced with other visitors, Quarkus, LangGraph, the Enterprise Security Lab, GitHub, Cloudflare D1 or Render. A visitor who opens the same public link from another device starts with their own seeded examples. Clearing the tab's session storage or using **Reset demo data** resets the workspace.

**Do not enter real personal, bank, customer, payment, sanction or proprietary information.** Client-side browser storage is not a secure enterprise database.

## Why there is no Keycloak, shared API key or MFA

Keycloak is a useful *optional* identity provider for an **authenticated** SaaS pilot, but the goal of this page is deliberately **anonymous/guest access**. Requiring Keycloak to log in would add identity configuration and contradict the no-password public-link experience. No authentication service, MFA configuration or token is necessary for the guest UI.

Public source code does **not** make published secrets safe. A GitHub Pages frontend cannot keep a Gemini, Keycloak administration, database, payment network or other backend key confidential. Do not hardcode such keys, even example shared keys, into a public page.

If the product later requires persistent **shared cases across visitors**, account identity, audit, or enterprise role enforcement, that needs a separate hosted backend, authentication/abuse protection appropriate to the data, and actual tenant isolation. Those capabilities **are not claimed** by the guest page. The existing separate local Enterprise Security Lab remains available for testing authenticated behaviour without disturbing this open demonstration.

## Development and checks

The core state machine lives in `web/studio/open-demo/core.mjs`, UI in `index.html`, `demo.css` and `lab.mjs`. All functionality is browser-side. To run tests:

```bash
node --check web/studio/open-demo/core.mjs
node --check web/studio/open-demo/lab.mjs
node --test tests/open-demo.test.mjs
```

No additional dependencies, secret credentials or hosting charges are required.
