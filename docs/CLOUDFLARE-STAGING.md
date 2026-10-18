# Free Cloudflare synthetic staging preview

Live preview: referenced documentation

Deployed through the owner's authenticated Cloudflare dashboard on 17 October 2026, from main commit `c7eaf2be03c430e5b730a0a7e4fe98538e95031f`.

This serves the existing static `web/` application, with root-relative internal links, a visible synthetic-only staging notice, and `noindex, nofollow` headers. It is **not** the deployed Java/Go/Python/Kafka/PostgreSQL SaaS. The marker `/staging.json` identifies the exact source commit and explicitly reports `backend_deployed: false` and `tenant_saas_ready: false`.

Build a fresh upload directory with:

```sh
python deploy/build_staging.py /path/to/new/staging-static
```

Use Cloudflare Workers & Pages → Upload static files → select that directory, retaining auto-trailing-slash HTML handling and 404-page handling. The directory contains only the existing public static site; no repository secrets, backend files or credentials. The account dashboard identifies static-only Worker requests as served at no charge. No paid plan was selected.

## Verified live

- Homepage, Studio, payment-intelligence and guest-case routes returned HTTP 200.
- `X-Robots-Tag: noindex, nofollow` is present.
- Browser address analysis found two parties and one address needing review from the existing synthetic sample.
- The enabled Export JSON control downloaded an actual report with product, messageType, ruleset, status, summary, parties, warnings and disclaimer fields.
- Optional Gemini backend is unreachable from this preview; visitor statistics and shared comments are unavailable. These optional services were not enabled or represented as working SaaS features.

## Still required for backend deployment

Owner requires **free hosting only**. No eligible Linux runtime/account access has yet been supplied. The project needs a persistent host with sufficient capacity for JVM, Kafka, Go, Python and PostgreSQL, secured ingress and identity. Do not use GitHub Actions as a permanent backend or upgrade a cloud plan without authorization. Oracle Always Free is a candidate subject to actual account eligibility/capacity, not a deployed or guaranteed service.
