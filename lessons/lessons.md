# lessons.md — reviewed incident log

Append-only, by PR. The agent READS entries whose `#tag` matches the alert
class, and PROPOSES new entries into `proposed/`. A human moves them here.
When one `#tag` reaches three entries, a human can promote the pattern into
[`references/<tag>.md`](../references/README.md) and link it from the entries.

Format per entry (Anthropic, "Claude on call"): what happened / root cause /
fix / gotcha.

## INC-0931 · 2026-09-12T02:14:00Z · #bad-deploy

- **what happened:** checkout 500s two minutes after a payments config deploy
- **root cause:** new provider env var not present in the EU region secret store
- **fix:** rollback d-4612, then re-deploy with the secret in place
- **gotcha:** query the data first, then theorize. Config tells you what could go wrong; metrics tell you what did.
- **watch metric:** error_rate

## INC-0944 · 2026-09-20T14:02:00Z · #latency

- **what happened:** p95 tripled during a marketing campaign, no deploy
- **root cause:** inventory DB connection pool (12) saturated
- **fix:** pool → 32 and a queue-depth alert
- **gotcha:** latency without errors and without a change is nearly always capacity. Check pool saturation in the logs before anything else.
- **watch metric:** p95_ms
