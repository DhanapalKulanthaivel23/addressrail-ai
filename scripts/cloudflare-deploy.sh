#!/usr/bin/env bash
set -euo pipefail
# All inputs come from environment settings, never interpolated into shell source.
for name in CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID D1_DATABASE_ID AR_INTERNAL_TOKEN AR_DEMO_API_KEY GATEWAY_URL; do
  test -n "${!name:-}" || { echo "Missing $name"; exit 1; }
done
[[ "$CLOUDFLARE_ACCOUNT_ID" =~ ^[a-fA-F0-9]{32}$ ]] || { echo 'Invalid account ID'; exit 1; }
test "${#AR_INTERNAL_TOKEN}" -ge 32 && test "${#AR_DEMO_API_KEY}" -ge 32
test "$AR_INTERNAL_TOKEN" != "$AR_DEMO_API_KEY"
node -e 'const u=new URL(process.env.GATEWAY_URL);if(u.protocol!=="https:"||!/^ar-gateway\.[a-z0-9-]+\.workers\.dev$/.test(u.hostname)||u.pathname!=="/"||u.search||u.hash||u.username||u.password)throw Error("Expected ar-gateway workers.dev origin")'
node scripts/cloudflare-config.mjs
root=cloudflare/payment-microservices
secret_dir=$(mktemp -d)
trap 'rm -rf "$secret_dir" "$root/wrangler.gateway.deploy.toml"' EXIT
export SECRET_DIR="$secret_dir"
node --input-type=module <<'JS'
import {writeFileSync} from 'node:fs';
const internal={INTERNAL_TOKEN:process.env.AR_INTERNAL_TOKEN};
for(const [name,value] of Object.entries({internal,gateway:{...internal,API_KEY:process.env.AR_DEMO_API_KEY}}))writeFileSync(`${process.env.SECRET_DIR}/${name}.json`,JSON.stringify(value),{mode:0o600});
JS
./node_modules/.bin/wrangler d1 execute DB --config "$root/wrangler.gateway.deploy.toml" --remote --file "$root/schema.sql"
for role in bank swift-network cbpr gpi sepa-clearing sepa rtgs chaps t2 gateway; do
  conf="$root/wrangler.$role.toml"
  secret_file="$secret_dir/internal.json"
  if [ "$role" = gateway ]; then conf="$root/wrangler.gateway.deploy.toml"; secret_file="$secret_dir/gateway.json"; fi
  ./node_modules/.bin/wrangler deploy --config "$conf" --secrets-file "$secret_file"
done
# A failing smoke test fails deployment reporting; it does not roll back previous Workers.
node scripts/cloudflare-smoke.mjs
