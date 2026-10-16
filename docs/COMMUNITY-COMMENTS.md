# AddressRail AI — Moderated comments on every page

The **14 public content pages** have a bottom-of-page **Comments & discussion** section. Each URL gets its **own thread**: comments on CHAPS do not appear on SEPA or the homepage.

## Current status — important
GitHub Pages is static. Publishing frontend files **does not activate a shared database**. The new UI loads approved comments and submits comments only after the Cloudflare Worker and D1 migration are deployed and bot-protection secrets are configured. Without that setup, the form clearly reports that submissions are unavailable rather than pretending to save comments. Never claim real public posting until the steps below work against the live Worker.

The shared backend extends the **existing** `analytics/worker.js` and its existing `VISITS` D1 binding. It retains visitor statistics. It never commits private API keys.

## Activate public comments

1. Confirm the existing Cloudflare account owns the Worker configured in `web/config.js` as `ADDRESSRAIL_COMMENTS_URL`. The public URL has no credentials; if your Worker has a different URL, change this public setting.
2. Create a Cloudflare **Turnstile** site for `dhanapalkulanthaivel23.github.io`. Keep its **private secret** outside GitHub and use its public **site key**. Turnstile must allow the widget action `addressrail_comment`.
3. Use the existing D1 database linked to the `VISITS` binding. If following the repo's existing `analytics/wrangler.example.toml`, copy it to ignored `analytics/wrangler.toml` and fill in the D1 ID from your Cloudflare account.
4. Add the new comments table **without deleting the visits table**:

   ```bash
   npx wrangler d1 execute addressrail-visits --remote --file=analytics/schema.sql --config analytics/wrangler.toml
   ```

5. Set these **Worker-only** secrets/variables using the Cloudflare dashboard or Wrangler (do not put actual values in `web/config.js`, GitHub commits, or any page):

   ```bash
   npx wrangler secret put COMMENTS_TURNSTILE_SITE_KEY --config analytics/wrangler.toml
   npx wrangler secret put COMMENTS_TURNSTILE_SECRET_KEY --config analytics/wrangler.toml
   npx wrangler secret put COMMENTS_ADMIN_TOKEN --config analytics/wrangler.toml
   ```

   The site key is public but supplied via a Worker binding. Generate a random **at least 32 character** moderator token, keep it private and back it up securely.

6. Deploy the modified Worker:

   ```bash
   npx wrangler deploy --config analytics/wrangler.toml
   ```

7. Confirm activation with:

   ```bash
   curl 'https://addressrail-visitors.dhanapalkav.workers.dev/api/comments/config'
   curl 'https://addressrail-visitors.dhanapalkav.workers.dev/api/comments?page=%2Fstudio%2Fchaps%2F'
   ```

   The first must report `enabled:true`; the second should report an array of approved comments. Test a form submission from your published GitHub Pages URL, complete Turnstile and confirm it reports **pending review**.

## Approve or reject comments

The public form does not expose owner moderation credentials. The admin API uses a server-held token, supplied only from your own terminal or administration system.

```bash
export COMMENTS_API='https://addressrail-visitors.dhanapalkav.workers.dev'
read -r -s -p 'Moderation token: ' COMMENT_ADMIN_TOKEN; echo
curl -fsS -H "Authorization: Bearer $COMMENT_ADMIN_TOKEN" \
  "$COMMENTS_API/api/comments/moderation"
```

After reviewing the pending IDs, approve (or use `"rejected"`):

```bash
curl -fsS -X POST "$COMMENTS_API/api/comments/moderation" \
  -H "Authorization: Bearer $COMMENT_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"id":123,"status":"approved"}'
unset COMMENT_ADMIN_TOKEN
```

Approved entries appear publicly on their originating page after **Refresh comments** (or page refresh). Submissions are never auto-published. Public users do **not** need accounts.

## Security and privacy

- Each record stores only display name, comment text, page path, submission timestamp and moderation status. The database does not store email, password, raw IP or bank data. The hosting provider and Turnstile may have their own operational logs.
- Users agree to public display of their comment and should never submit account numbers, real SWIFT messages, or confidential company information.
- The frontend uses `textContent` rather than executable HTML to display comments.
- Server validation limits page paths, display names (2–50 characters), comment length (10–1000), body size, origin, consent and Cloudflare Turnstile challenge action/hostname.
- Browser Origin and CAPTCHA make abuse harder but **are not authentication**. Monitor spam and maintain moderation. Consider durable rate limiting before a high-volume public rollout.
- Only approved comments are public. Pending/rejected comments require a clear owner retention/deletion policy. You can permanently delete unwanted records directly in the Cloudflare D1 admin console or Wrangler; data privacy compliance remains the operator's responsibility.
- Only the owner should hold `COMMENTS_ADMIN_TOKEN`. Rotate it if leaked. Cloudflare secrets and D1 access rights are separate from this public GitHub Pages repository.

## Development and tests

```bash
node --check web/comments.js
node --check analytics/worker.js
node --test tests/comments.test.mjs
```

The browser smoke tests exercise the comment-section DOM across all pages. They intentionally do not post real comments or solve a live CAPTCHA.

## Compact comment form

The form contains a comment box and Submit button. Posts use the display label Visitor; there is no separate name field or consent checkbox. Submission expresses the intent to post for moderation. Turnstile runs automatically with interaction-only appearance; a challenge appears only when required. Server-side verification, origin checks, honeypot and moderation remain enforced. Successful submission shows only Submitted.
