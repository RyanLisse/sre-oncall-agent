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

## The contract (what code checks after the model answers)

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
lessons/lessons.md            reviewed incident log (two seed entries)
lessons/proposed/             where the agent writes; humans promote
approvals/                    pending/approved/rejected records
.claude/agents/               the same investigator as a Claude Code subagent
course/                       interactive HTML course (open course/index.html)
docs/sources.md               what each idea was taken from
```

## Where the ideas come from

- **Owain Lewis, "I Built A Claude DevOps Agent To Run My Software Factory"** — the framing: agents are superhuman at searching data for one specific problem; humans decide; watch a rollout for N minutes.
- **`anthropics/oncall-kit` + "Claude on call" (claude.com)** — the rules: never the detector, no auto-mitigation, no unreviewed memory, every claim linked, `lessons.md` by tag, the diagnosis format, three bounded checks, shadow period, ≥70% / zero harmful validation gate.
- **Claude Cookbook, "SRE incident responder"** — `request_approval` as a tool the *application* answers. We moved the gate one step further out: no mutating tool at all; the approval record is what an executor reads.
- **"How we made claude.ai 3x faster"** — every benchmark is also a CI guardrail with a number that only ratchets one way. `bench/ratchet.json`.
- **Google SRE, "AI in SRE"** — RCA is one of several areas; playbooks improve from incident usage; anomaly detection over static thresholds (the `noisy-alert` scenario).
- **`anthropics/code-migration-kit`** — "you don't fix the code, you fix the process": recurring failures indict a rule → `promotionCandidates()`.

Details and what was deliberately *not* adopted: `docs/sources.md`.

## Safety

All data is fictional. Nothing is sent, deployed, rolled back, scaled or
paged. The agent has three read-only tools and no network. Every verdict has
`draft_only: true` and `human_approval_required: true`.
