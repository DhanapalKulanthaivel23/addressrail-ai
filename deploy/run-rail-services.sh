#!/usr/bin/env bash
# Start eleven distinct localhost-only Go rule teaching services.
# Not Swift/clearing connectivity, not a production Kubernetes deployment.
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp_dir="$(mktemp -d)"
declare -a pids=()
cleanup() {
  for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done
  rm -rf "$tmp_dir"
}
trap cleanup EXIT INT TERM
(cd "$repo_root/rail-engine" && go build -o "$tmp_dir/raild" ./cmd/raild)
rails=(CBPR GPI G4C SCT SCT_INST SDD CHAPS FPS BACS T2 CLS)
port=8110
for rail in "${rails[@]}"; do
  RAIL_ENGINE_RAIL="$rail" RAIL_ENGINE_PORT="$port" "$tmp_dir/raild" > "$tmp_dir/$rail.log" 2>&1 &
  pids+=("$!")
  printf 'Started synthetic %-9s at http://127.0.0.1:%d/healthz (PID %d)\n' "$rail" "$port" "$!"
  port=$((port+1))
done
echo "Press Ctrl+C to stop all local rail teaching services."
wait
