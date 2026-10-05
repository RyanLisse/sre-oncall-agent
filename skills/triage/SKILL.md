---
name: incident-triage
description: The team's runbook for triaging production latency and error-rate incidents on the checkout service. Use whenever an alert fires, a deployment watch fails, or someone asks "what caused X".
---

# Incident triage

If you change the order below, say why in the lesson you propose.

## Order of operations

1. Pull deploys for the hour before the alert. Do not open the log first.
2. Line deploy timestamps up against `error_rate` / `p95_ms`. State the gap ("deploy 03:43, errors move 03:45").
3. If a deploy lines up: pull the diff, read it. Check for the things below.
4. Then grep the log to confirm. Do not grep to fish.
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
