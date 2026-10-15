# AR-408 — Bring-your-own-key (BYOK) AI mode security spike

**Reviewed:** 15 October 2026. **Decision: NO for public direct-browser provider-key mode.**

The current AddressRail AI deployment is a public static GitHub Pages application with no authenticated users. Asking visitors to paste a provider API key into a JavaScript application creates unacceptable risks of accidental disclosure via malicious extensions, browser debugging, untrusted third-party scripts, XSS, copied troubleshooting output or user misunderstanding. "Keep only in memory" reduces persistence risk but is not sufficient to protect a key that the JavaScript runtime can read.

**Not implemented:**
- No input fields for Gemini/OpenAI/provider credentials.
- No localStorage/sessionStorage/IndexedDB persistence of API tokens.
- No querystring parameters containing keys.
- No browser-side provider API calls using visitor keys.
- No usage-cost assumptions, claims of guaranteed privacy, or transfer of banking customer data.

## Requirements before reconsidering

1. Independent app-security review, CSP and dependency governance with XSS and supply-chain tests.
2. A trusted, authenticated proxy with explicit per-user rate caps, usage transparency and revocation.
3. Provider policies and financial-data handling review; strict synthetic-only input for a public trial.
4. Logging controls, no secret logging, short-lived credentials (where supported) and cost protection.
5. A consent screen explaining provider processing, retention, billing and selected model.
6. Adversarial and data-leakage evaluations, not only phrase-based rule matching.
7. A service-specific architecture with suitable keys isolated from GitHub Pages and source control.

**Alternative for current demonstrations:** the existing deterministic browser guardrail playground and optional separately configured server-side Gemini backend. Its server secrets are not embedded in GitHub Pages. Recorded model outputs under AR-401 require genuine calls with recorded provenance; invented text must remain labelled *authored example*.

**Decision owner:** AddressRail AI maintainer with an application security reviewer prior to any change.
