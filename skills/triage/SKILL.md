---
name: incident-triage
description: The team's runbook for triaging production latency and error-rate incidents on the checkout service. Use whenever an alert fires, a deployment watch fails, or someone asks "what caused X".
---

# Incident triage

If you change the order below, say why in the lesson you propose.

## Order of operations

1. Call `summarize_metrics` for the hour before the alert. Find the breakpoint.
2. Call `list_deploys` for the same window. Line deploy times up against `error_rate` and `p95_ms`.
3. If a deploy lines up, call `get_diff` and read it. Check for the things below.
4. Call `search_logs` after the breakpoint. Find the confirming line. Do not grep to fish.
5. No deploy lines up → check pool saturation and upstream status codes in the logs, then propose `scale` or `investigate-more`. Never `rollback` without a deploy.

## Things that have burned us

In rough order of how often:

- config key present in staging, missing in one region's secret store
- per-row query where there used to be a batch
- synchronous call to inventory inside the checkout request
- new upstream endpoint, no timeout
- retry loop with no backoff

## Write-up

Everything you cite is evidence. One proposal, one owner, one metric to watch. If it was not a deploy, say what it was instead (`db-pool`, `upstream-gateway`), still in one sentence.
