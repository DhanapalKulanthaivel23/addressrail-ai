# AddressRail AI – Gemini Free-Tier Trial Setup

**Status:** The GitHub Pages site works without Gemini. The optional backend is not hosted until the owner creates a service and configures secrets.

## Architecture

```text
GitHub Pages (AddressRail AI UI)
     | browser-only synthetic MT103 / pacs.008 analysis
     | extracted address findings + consent + short-lived Turnstile token
     v
Render HTTPS backend (FastAPI, API key stored server-side)
     | verify Turnstile with Cloudflare
     | enforce limited per-process quotas
     | forward minimal, synthetic postal-address evidence
     v
Google Gemini API (gemini-3.1-flash-lite)
     |
     v
Advisory-only explanation shown in browser
```

The public site **never receives the Gemini secret key**. Do not upload real customer messages or confidential bank data. Gemini free-tier inputs/outputs may be used by Google to improve products. The free quota and pricing may change.

## Step 1: Gemini free-tier key

1. Open [Google AI Studio API keys](https://aistudio.google.com/api-keys).
2. Create a key in a Google Cloud project eligible for Gemini API free tier.
3. Keep the key private. Do not enter it in ChatGPT, JavaScript or GitHub code.
4. Check current free-tier model access/rate limits for `gemini-3.1-flash-lite` in AI Studio.

## Step 2: Cloudflare Turnstile

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/) and add a new widget.
2. Restrict allowed hostname to `dhanapalkulanthaivel23.github.io`.
3. Save its **public site key** and **private secret key** separately.
4. The frontend uses the public site key obtained from `GET /api/config`.
5. The backend calls the Turnstile Siteverify endpoint and requires `success=true`, expected hostname and action `addressrail_ai`.

Turnstile alone does not guarantee a human tester, but it helps protect the Gemini quota from unauthenticated scripted calls. No public Gemini calls are enabled until a Turnstile secret is present.

## Step 3: Deploy on Render (free web service option)

1. Open [Render Dashboard](https://dashboard.render.com/) and sign in.
2. Select **New → Blueprint** and connect the `DhanapalKulanthaivel23/addressrail-ai` GitHub repository. The repository contains `render.yaml`.
3. Review the service name `addressrail-ai-gemini`, free plan, build/start commands and region before approving.
4. Configure **secret environment variables on Render, never GitHub Pages**:
   - `GEMINI_API_KEY`: Gemini API secret
   - `TURNSTILE_SITE_KEY`: Cloudflare **public** site key
   - `TURNSTILE_SECRET_KEY`: Cloudflare secret
5. After credentials are saved, change `ENABLE_AI` from `false` to `true` in the Render service environment and deploy again.
6. Open `https://YOUR-SERVICE.onrender.com/api/health` and `/api/config`. Verify `aiEnabled=true`. The public config displays the site key but must not contain either private key.

**Render is a separate hosting platform**, even when using a free instance. Free services may sleep when idle; quotas, bandwidth and billing policies apply. Do not rely on the free service for production or regulated data.

For manual setup instead of Blueprint:
- Runtime: Python 3
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.app:app --host 0.0.0.0 --port $PORT`
- Health check: `/api/health`
- Plan: Free, if available for your account

## Step 4: Connect the public website

In `web/config.js`, set:

```js
window.ADDRESSRAIL_API_URL = 'https://YOUR-SERVICE.onrender.com';
```

Commit the change. GitHub Pages will redeploy from `main`. This URL is public and contains **no secrets**.

Open https://dhanapalkulanthaivel23.github.io/addressrail-ai/, run a synthetic example, tick consent, complete Turnstile and click **Ask Gemini**.

## Tests and troubleshooting

```bash
python -m pip install -r requirements.txt
python -m pytest -q
node --check web/app.js
```

`GET /api/health` returns a health response. `GET /api/config` exposes only public frontend settings.

- **503 Gemini disabled**: `ENABLE_AI`, `GEMINI_API_KEY`, site key or Turnstile secret is missing.
- **403 challenge failed**: expired/reused Turnstile token, wrong hostname or action.
- **429**: local trial budget exceeded, or upstream Gemini service quota.
- **502**: model not accessible, invalid Gemini result, upstream unavailable.
- **CORS error**: `ALLOWED_ORIGINS` must include the exact scheme/host `https://dhanapalkulanthaivel23.github.io`.

## Public pilot limits

**This is a restricted demonstration, not a production SaaS.** It has process-local counters (reset on restart, unsuitable across replicas) and has no per-user account quota, authentication, paid billing, durable audit history or anti-fraud controls. Deploy public AI only to a small, consenting synthetic-data test group and monitor Google AI Studio quotas. For a larger public audience, add persistent quotas and account-based authentication first.

## Costs and data privacy

Gemini API free tier is offered subject to eligible model/account/region and project rate limits; free-tier data can be used for product improvement. Render also has free-plan limits, and services could incur charges depending on your plan/payment method. Both are separate from GitHub Pages.

Official resources:
- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/billing
- https://ai.google.dev/gemini-api/docs/api-key
- https://developers.cloudflare.com/turnstile/get-started/
- https://render.com/docs/deploy-fastapi
- https://render.com/docs/free
