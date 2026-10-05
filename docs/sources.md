# Sources, and what we took from each

Only the primary sources are listed. The video that started this is a demo
wrapper; the rules come from the artifacts it points at.

| Source | Taken | Deliberately not taken |
| --- | --- | --- |
| Owain Lewis, [I Built A Claude DevOps Agent To Run My Software Factory](https://www.youtube.com/watch?v=l6GpUvPOVpM) (2026-10-05) | agent investigates logs/metrics/deploys and *recommends*; "watch the next deployment for N minutes"; agents over-index on one signal → two-source rule | his demo rolls back behind an approve button *inside the same agent*; his downtime figures (internally inconsistent) |
| [`anthropics/oncall-kit`](https://github.com/anthropics/oncall-kit) (Apache-2.0, reference implementation) | "Claude is never the detector"; "No auto-mitigation, period"; "No unreviewed memory"; capability binding (`telemetry.ts` is the binding); `lessons.md` read by #tag, never whole; the six-line diagnosis format; rule 5a (confirm the symptom is still present before blaming a change); rule 9 (three checks, not a polling loop; verify through the same door); page vs morning-log; four incident states where every arrow is human; Validate gate ≥70% and zero harmful | Slack/Claude Tag runtime; routines; the weather report; the five-phase mining setup (out of scope for a tutorial — the bench is the Validate phase only) |
| [Claude on call (claude.com blog, 2026-08-18)](https://claude.com/blog/ai-ci-cd-on-call) | lessons.md entry format (what happened / root cause / fix / gotcha); "query the data first, then theorize"; "alerting is deterministic, escalation is deterministic + agentic" | median-14-minutes figures (vendor claim); the separate rollout agent with the engineer's permissions |
| [Claude Cookbook: SRE incident responder](https://platform.claude.com/cookbook/managed-agents-sre-incident-responder) | `request_approval` as a custom tool the application answers; Skill = team runbook conventions outside the system prompt | `open_pull_request` + `merge_pull_request` in the same agent (we have no mutating tools; `approval.ts` is the record an executor reads) |
| [How we made claude.ai 3x faster](https://claude.dev/blog/how-we-made-claude-ai-faster/) (2026-09-23) | every benchmark is a CI guardrail with a one-way ratchet; prove a proxy metric tracks the real one before climbing it; every PR behind a flag, every thread a named owner | nothing — but note the scale (150 threads, 3000 PRs) is not a solo-dev scale |
| [Google: AI in SRE](https://cloud.google.com/blog/products/devops-sre/how-google-sre-is-using-agentic-ai-to-improve-operations) (2026-05-28) | RCA is one area of several; playbooks improve from use during incidents; anomaly detection beats static thresholds → the `noisy-alert` scenario ("the threshold may be too tight") | TimesFM / platform specifics |
| [`anthropics/code-migration-kit-with-claude-code`](https://github.com/anthropics/code-migration-kit-with-claude-code) | "you don't fix the code — you fix the process"; recurring failures indict a rule → `promotionCandidates()` in `lessons.ts`; sign-off = kicking off the next phase; ban by configuration not by request (our tool list *is* the ban) | the migration pipeline itself |
| DevOps Toolkit, [Claude Code: AI Agent for DevOps, SRE, and Platform Engineering](https://www.youtube.com/watch?v=h-6LP133o6w) | the wish: an agent that *watches* something and notifies — bounded here as `watch` with three checks | tool review content (2025-era) |
| [`RyanLisse/aetherlink-day5-n8n-to-agent`](https://github.com/RyanLisse/aetherlink-day5-n8n-to-agent) (base repo) | the shape: contract → runtime port (SDK or offline fake) → trace → validate → route → memory; `Result` instead of throw; the SOLO.md step format; the HTML course build | the support-triage domain and subagents |

## Writing style

Prompts and docs aim for ~80% ASD-STE100: short sentences, one instruction
each, active voice, one term per thing (always "proposal", never also
"recommendation" in the prompt). The agent's own output format is a fixed
six-line template so a fresh reader can land on it cold.
