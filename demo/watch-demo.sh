#!/usr/bin/env bash
# demo/watch-demo.sh — "Watch the next deployment" against the live shop, with a bad deploy injected mid-watch.
set -euo pipefail
cd "$(dirname "$0")/.."
export AGENT_SHOP_PORT="${AGENT_SHOP_PORT:-4310}"
cleanup() { pkill -f "tsx demo/shop.ts" 2>/dev/null || true; pkill -f "tsx demo/chaos.ts traffic" 2>/dev/null || true; }
trap cleanup EXIT
cleanup; rm -rf demo/data
npx tsx demo/shop.ts > demo/shop.log 2>&1 &
sleep 1; npx tsx demo/chaos.ts traffic --rps 15 > demo/traffic.log 2>&1 &
sleep 4
( sleep "${INJECT_AFTER_S:-8}"; npm run -s chaos -- deploy v2.16.0 --mode "${MODE:-bad-deploy}" > demo/inject.log 2>&1 ) &
INJECT=$!
AGENT_WATCH_INTERVAL_MS="${AGENT_WATCH_INTERVAL_MS:-1500}" npm run -s watch-deploy -- "Watch the next deployment for one minute. Check checkout success, errors and latency. Investigate any regression and ask me before rolling back." || true
wait "$INJECT" 2>/dev/null || true
