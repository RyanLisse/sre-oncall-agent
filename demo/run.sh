#!/usr/bin/env bash
# demo/run.sh — the full loop against the live shop, end to end, in ~2 minutes.
#
#   npm run demo                 (bad-deploy scenario, rollback path)
#   npm run demo -- slow         (latency AS A DEPLOY: still a rollback — the deploy explains it)
#   npm run demo -- slow degrade (latency WITHOUT a deploy: agent proposes scale; executor refuses)
#   npm run demo -- errors degrade (mystery errors, no deploy: investigate-more; nothing to execute)
#
# What it does:
#   1. start the shop + traffic         4. investigate → diagnosis + pending approval
#   2. let a healthy baseline form      5. executor WITHOUT approval → refused
#   3. inject the fault (a "deploy")    6. approve as $USER → executor rolls back + fresh evidence
#                                       7. watch → LANDED; a human closes
set -euo pipefail
cd "$(dirname "$0")/.."
MODE="${1:-bad-deploy}"; HOW="${2:-deploy}"
export AGENT_SHOP_PORT="${AGENT_SHOP_PORT:-4310}"
export AGENT_DEMO_DATA="${AGENT_DEMO_DATA:-demo/data}"
BASELINE_S="${BASELINE_S:-40}"; FAULT_S="${FAULT_S:-30}"; RECOVER_S="${RECOVER_S:-25}"

cleanup() { pkill -f "tsx demo/shop.ts" 2>/dev/null || true; pkill -f "tsx demo/chaos.ts traffic" 2>/dev/null || true; }
trap cleanup EXIT
cleanup; rm -rf "$AGENT_DEMO_DATA" demo/incidents approvals/*.approval.json lessons/proposed/*.md 2>/dev/null || true

step() { printf '\n\033[1m── %s\033[0m\n' "$*"; }

step "1/7 shop + traffic"
npx tsx demo/shop.ts > demo/shop.log 2>&1 & 
sleep 1; npx tsx demo/chaos.ts traffic --rps 15 > demo/traffic.log 2>&1 &
sleep 2; curl -s "http://localhost:$AGENT_SHOP_PORT/health"; echo

step "2/7 healthy baseline (${BASELINE_S}s)"; sleep "$BASELINE_S"

if [ "$HOW" = "degrade" ]; then
  step "3/7 inject fault: degrade to $MODE (no deploy record)"
  npm run -s chaos -- degrade --mode "$MODE"
else
  step "3/7 inject fault: deploy v2.15.0 in mode $MODE"
  npm run -s chaos -- deploy v2.15.0 --mode "$MODE"
fi
sleep "$FAULT_S"

step "4/7 alert fires → investigate"
case "$MODE" in
  bad-deploy) ALERT="Error rate 12% for 5 min on checkout (threshold 2%)";;
  slow)       ALERT="p95 latency 3000 ms for 5 min on checkout (threshold 2000 ms)";;
  *)          ALERT="Error rate 5% for 5 min on checkout (threshold 2%)";;
esac
npm run -s live -- --alert "$ALERT" --out demo/incidents/live.json
npm run -s investigate -- demo/incidents/live.json | sed -n '/── diagnosis/,$p'

step "5/7 executor without approval"
npm run -s execute -- demo/incidents/live.json || true

step "6/7 approve as ${USER}, then execute"
npm run -s approve -- demo/incidents/live.json --by "$USER" | head -2
FIX_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
if npm run -s execute -- demo/incidents/live.json; then
  step "7/7 watch it land (${RECOVER_S}s of recovery first)"; sleep "$RECOVER_S"
  npm run -s live -- --alert "post-fix snapshot" --out demo/incidents/after.json > /dev/null
  npm run -s watch -- demo/incidents/live.json --metric error_rate --fix-at "$FIX_AT" --after demo/incidents/after.telemetry.json || true
else
  step "7/7 executor refused — correct for a non-rollback proposal. A human takes the proposed action by hand."
fi

printf '\nartefacts: demo/incidents/ · approvals/ · lessons/proposed/ · demo/shop.log · demo/traffic.log\n'
