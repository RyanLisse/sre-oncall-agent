# AI SRE first responder on the Claude Agent SDK

An alert fires. The agent reads the lessons for that failure class, pulls the
metrics, the deploy history and the logs, and posts one diagnosis with a
reference behind every claim and ONE proposed next step. A human decides.
After the human acts, the agent watches the metric land — and says so if it
does not.

The agent **cannot** roll back, scale, flip a flag or page anyone. That is
not a missing feature. It is the design, taken from
[`anthropics/oncall-kit`](https://github.com/anthropics/oncall-kit):
*the agent gathers evidence, proposes, verifies and communicates; humans
decide what to mitigate and when.*

You can run the whole project offline. The offline runtime is a scripted
investigator that runs the same tools against the same fixtures. Its output
demonstrates the pipeline; it is not model evidence.

Follow **[SOLO.md](SOLO.md)** for the step-by-step tutorial. This README is
the reference.

![The on-call loop: alert → investigation → recovery](docs/diagrams/01-architecture.svg)

Four diagrams explain the design (`docs/diagrams/`, regenerate with
`npm run diagrams`): the loop above, [the contract](docs/diagrams/02-contract.svg),
[the lessons loop](docs/diagrams/03-lessons.svg) and [the ratchet](docs/diagrams/04-ratchet.svg).
A five-minute narrated explainer is at `docs/video/explainer.mp4`
(rebuild with `npm run video`).

## Set up

```
git clone <this repo>
cd sre-oncall-agent
npm install
npm run fixtures
npm run verify
```

`npm run verify` runs the type check, 35 tests and the bench ratchet. It
ends with `PASS bench`.

## The loop, in five commands

```
npm run investigate -- fixtures/incidents/bad-deploy.json          # 1 · diagnose, draft an approval, propose a lesson
npm run approve     -- fixtures/incidents/bad-deploy.json --by you  # 2 · a NAMED human signs (or: npm run reject)
#                                                                    # 3 · a human (or a separate gated system) applies the fix
npm run watch       -- fixtures/incidents/bad-deploy.json \
    --metric error_rate --fix-at 2026-10-05T03:52:00Z \
    --after fixtures/telemetry/after-rollback.json                   # 4 · three bounded checks: LANDED or NOT LANDED
#                                                                    # 5 · review lessons/proposed/INC-1001.md → PR into lessons/lessons.md
```

Add `--dry-run` to step 1 to skip the approval draft and the lesson proposal.

## Run with a real model (optional)

```
export ANTHROPIC_API_KEY=sk-ant-...        # shell only, never in a file
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model sonnet
```

The model gets the same three read-only tools through an in-process MCP
server, the same `lessons.md` slice, and the same JSON-schema output
contract. A run costs a few cents. `--max-turns` and `--max-budget-usd` bound
the loop.

## What the model can and cannot do

| Can | Cannot |
| --- | --- |
| `search_logs`, `summarize_metrics`, `list_deploys` (read-only, capped) | call any tool that changes the system — none exists |
| read lessons for the matching `#tag` | read the whole `lessons.md` (grows unbounded by design) |
| propose `rollback` / `scale` / `flag-off` / `investigate-more` / `no-action` | execute any of them |
| write `lessons/proposed/<id>.md` | append to `lessons/lessons.md` |
| draft `approvals/<id>.approval.json` as *pending* | sign it — `decided_by` must be a named human |

![The lessons loop](docs/diagrams/03-lessons.svg)

## The contract (what code checks after the model answers)

![The model proposes. Code checks.](docs/diagrams/02-contract.svg)

- `evidence` has ≥1 line; each line is `logs:<ts>`, `metrics:<ts>`, `deploys:<id>` or `lessons:<id>`.
- A strong proposal (`rollback`, `scale`, `flag-off`) needs **two sources**. One signal is a hunch.
- `rollback` needs a `deploys` line — you cannot undo a change you did not find.
- `low` confidence may only propose `investigate-more`.
- `summarize_metrics` and `list_deploys` must appear in the tool trace; a cited source whose tool was never called fails.
- `incident_id` must match the input. `draft_only` and `human_approval_required` are the literal `true`.

## Files

```
SOLO.md                       step-by-step tutorial
src/contract.ts               Incident · Verdict · Recommendation · schema · evidence rules
src/telemetry.ts              the fictional production system: logs, metrics, deploys (pure queries)
src/tools.ts                  the three read-only tools, as an in-process MCP server
src/prompts.ts                standing orders (ASD-STE100-ish) and the per-incident prompt
src/lessons.ts                lessons.md: read by #tag, propose-only writes, promotion candidates
src/agent.ts                  the query() loop, trace extraction, trace ↔ evidence check
src/router.ts                 parse → validate → attach owner
src/approval.ts               the approval record a human signs; isApproved() for executors
src/watch.ts                  "watch it land": baseline + three bounded checks
src/bench.ts                  held-out replay + ratchet
src/runtime.ts                real SDK or the offline scripted investigator
src/cli.ts                    investigate · approve · reject · watch
fixtures/generate.mjs         deterministic telemetry for five scenarios
fixtures/incidents/           the alerts, incl. adversarial + malformed
bench/cases.json              expected proposal + severity per scenario
bench/ratchet.json            the floor CI enforces (only goes up)
docs/diagrams/                four SVG swimlane diagrams + the script that draws them
docs/video/                   the explainer video + the script that renders it
lessons/lessons.md            reviewed incident log (two seed entries)
lessons/proposed/             where the agent writes; humans promote
approvals/                    pending/approved/rejected records
.claude/agents/               the same investigator as a Claude Code subagent
course/                       interactive HTML course (open course/index.html)
docs/sources.md               what each idea was taken from
```

## Resources

Every idea in this repo has a primary source. Per-source "taken / deliberately not taken" is in [`docs/sources.md`](docs/sources.md).

### The video that started it
- Owain Lewis — [I Built A Claude DevOps Agent To Run My Software Factory](https://www.youtube.com/watch?v=l6GpUvPOVpM) (2026-10-05). The framing: agents are superhuman at searching data for one problem; humans decide; "watch the next deployment for N minutes".
- DevOps Toolkit — [Claude Code: AI Agent for DevOps, SRE, and Platform Engineering](https://www.youtube.com/watch?v=h-6LP133o6w). The wish for an agent that *watches* and notifies; bounded here as `watch`.

### Anthropic — the rules
- [`anthropics/oncall-kit`](https://github.com/anthropics/oncall-kit) (Apache-2.0, reference implementation) — read [`skills/triage/SKILL.md`](https://github.com/anthropics/oncall-kit/blob/main/skills/triage/SKILL.md) and [`CLAUDE.md`](https://github.com/anthropics/oncall-kit/blob/main/CLAUDE.md), not just the README. Never the detector · no auto-mitigation · no unreviewed memory · every claim linked · lessons by tag · the six-line diagnosis · rule 5a · rule 9 (three checks) · ≥70% / zero harmful.
- [Claude on call: how Claude Tag serves as Anthropic's first responder for CI/CD failures](https://claude.com/blog/ai-ci-cd-on-call) (2026-08-18) — `lessons.md` entry format; "query the data first, then theorize"; deterministic alerting, agentic triage.
- [Claude Tag on-call webinar](https://www.anthropic.com/webinars/claude-tag-on-call-a-new-teammate-in-your-incident-channel) — companion to the blog.
- [Claude Cookbook: Build an SRE incident response agent with Claude Managed Agents](https://platform.claude.com/cookbook/managed-agents-sre-incident-responder) ([notebook](https://github.com/anthropics/claude-cookbooks/blob/main/managed_agents/sre_incident_responder.ipynb)) — `request_approval` as a custom tool the application answers; Skills for runbook conventions. Live session: [Cooking with Claude](https://www.anthropic.com/webinars/cooking-with-claude-how-to-build-an-sre-incident-response-agent) (2026-06-25).
- [Agent SDK: the site-reliability agent](https://github.com/anthropics/claude-cookbooks/blob/main/claude_agent_sdk/03_The_site_reliability_agent.ipynb) — the same problem on the local SDK (the runtime this repo uses).
- [How we made claude.ai 3x faster in two weeks](https://claude.dev/blog/how-we-made-claude-ai-faster/) (2026-09-23) — every benchmark is a CI guardrail with a one-way ratchet; prove a proxy tracks the real metric before climbing it.
- [`anthropics/code-migration-kit-with-claude-code`](https://github.com/anthropics/code-migration-kit-with-claude-code) — "you don't fix the code, you fix the process"; recurring failures indict a rule; ban by configuration, not by request.
- [Claude Agent SDK](https://docs.claude.com/en/docs/agent-sdk/overview) · [TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript) · [MCP in the SDK](https://code.claude.com/docs/en/mcp).

### Google SRE
- [AI in SRE: where and how Google is deploying agentic AI to improve operations](https://cloud.google.com/blog/products/devops-sre/how-google-sre-is-using-agentic-ai-to-improve-operations) (2026-05-28) and the whitepaper [AI in SRE Practice](https://goo.gle/4uUxy4y) — RCA is one area of several; playbooks improve from use; anomaly detection over static thresholds (→ the `noisy-alert` scenario).
- [SRE book](https://sre.google/sre-book/table-of-contents/) · [SRE workbook](https://sre.google/workbook/table-of-contents/) — the discipline the agent slots into.

### Base repo and writing
- [`RyanLisse/aetherlink-day5-n8n-to-agent`](https://github.com/RyanLisse/aetherlink-day5-n8n-to-agent) — the shape: contract → runtime port → trace → validate → route → memory; `Result` over `throw`; the SOLO.md format; the HTML course build.
- [ASD-STE100](https://www.asd-ste100.org/) — the controlled-language spec the prompts, `SOLO.md` and the narration aim at (~80%): short sentences, one instruction each, one term per thing.

## Safety

All data is fictional. Nothing is sent, deployed, rolled back, scaled or
paged. The agent has three read-only tools and no network. Every verdict has
`draft_only: true` and `human_approval_required: true`.
