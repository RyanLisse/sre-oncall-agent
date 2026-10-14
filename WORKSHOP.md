# Workshop 5 — build the AI SRE agent (AI-native SDLC)

The team path through this repo. You build the agent piece by piece, test
first, with Claude Code as the builder — and you learn the AI SDLC loop on the
way: **Intent → Spec → Design/controls → Build → Test/evals → Gate →
Maintain.**

Everything runs offline. No API key needed: the scripted runtime
(`src/runtime.ts`) drives the same tools as a real model. A real model is
optional (`AGENT_MODEL=<name>`).

## Setup

```bash
git clone <repo-url>            # the URL your facilitator gives you
cd sre-oncall-agent
git checkout workshop/start
npm ci && npm run fixtures
npm test                        # green: the main suite
npm run test:workshop           # red: the exercises (by design)
npm run console                 # http://localhost:4320
```

`workshop/start` has four pieces removed (the TODO(A3/A4/A5/A8) markers —
`npm run workshop:check` lists them). `npm test` stays green; the red tests
live in `test/workshop/`. `npm run progress` shows which assignments already
have evidence.

Behind? Catch up with `git checkout w5-step-N -- <files>` — each tag is the
solved state after assignment N (see the table). `git diff w5-step-N w5-step-M`
shows exactly one step.

## Two gates — don't confuse them

- **Runtime gate** — a diagnosis needs a NAMED approval before the executor
  may act: `npm run approve -- <incident> --by <name>` or the console buttons.
  Record: `approvals/<inc>.approval.json`.
- **SDLC gate** — a `fix/*` branch may only be pushed after a named human ran
  `npm run approve:git -- <name> <branch> "<reason>"` **in their own
  terminal**. The guard hook (`.claude/hooks/guard.mjs`) denies it inside the
  agent; `npm run check:approval` verifies it. Record:
  `approvals/approvals.jsonl`.

| # | Assignment | Catch-up | tag |
|---|---|---|---|
| A1 | Setup check | — (install only) | `w5-step-0-setup` |
| A2 | Write your team intent.md | `git checkout w5-step-1-intent -- intent.md` | `w5-step-1-intent` |
| A3 | Spec + contract green | `git checkout w5-step-2-spec-contract -- src/contract.ts src/runtime.ts src/prompts.ts src/cli.ts console/index.html test/contract.test.ts docs/spec.md` | `w5-step-2-spec-contract` |
| A4 | Wire and prove the controls | `git checkout w5-step-3-design-controls -- src/chat.ts .claude/hooks/guard.mjs` | `w5-step-3-design-controls` |
| A5 | Build a read-only tool | `git checkout w5-step-4-build-tool -- src/tools.ts` | `w5-step-4-build-tool` |
| A6 | Diagnose a live incident | `git checkout w5-step-5-diagnose -- docs/diagnosis-live.md` | `w5-step-5-diagnose` |
| A7 | Pass the bench. Add a case. | `git checkout w5-step-6-eval -- bench/cases.json` | `w5-step-6-eval` |
| A8 | The gate: approve with your name | `git checkout w5-step-7-gate -- src/executor.ts approvals/` | `w5-step-7-gate` |
| A9 | Maintain + your hackathon intent.md | `git checkout w5-step-8-maintain -- lessons/lessons.md docs/hackathon-intent.md` | `w5-step-8-maintain` |

## A1 — Setup check

**Goal:** everything installed, the console up, Claude Code connected.

- `npm ci && npm run fixtures`
- `npm test` → all green; `npm run test:workshop` → red on the A3/A4/A5/A8 tests
- `npm run console` → open `http://localhost:4320`, then `curl localhost:4320/api/health`
- `claude` in this directory → `/status` shows the guard + progress hooks

## A2 — Write your team intent.md

**Goal:** one page a stranger could hold you to. Fill `intent.md`: who the
agent serves, the boundary (read-only; propose, never mutate; humans close),
and **three checks a stranger can verify** (e.g. "chat refuses 'roll back
now'", "a verdict without evidence refs is rejected"). The
`design-control-loop` skill can interview you onto the page.

## A3 — Spec + contract green

**Goal:** rebuild the evidence rules **and** add the `customer_impact` field,
test-first. `test/workshop/contract.test.ts` is red now. Write down the
contract in `docs/spec.md`, then make it pass in `src/contract.ts`
(`TODO(A3)`). `customer_impact` is required, so add it to the offline
verdicts in `src/runtime.ts` and the verdict fixtures in
`test/contract.test.ts` too. With only `src/contract.ts` changed, `npm test`
shows 5 failures and the dry run prints `FAIL contract`. The console must
still render a diagnosis — run one in
`npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run`.

## A4 — Wire and prove the controls

**Goal:** chat refuses mutations again (`src/chat.ts`, `TODO(A4)`), and the
guard hook enforces your own rule. `.claude/hooks/guard.mjs` already denies
network, secrets, self-approval and unapproved pushes. **You** add one rule
(by hand — the agent may not edit hooks): deny agent edits to
`bench/ratchet.json`. Prove it: `test/workshop/guard.test.ts` turns green and
`approvals/audit.jsonl` shows a deny. Write the decision down in
`docs/decisions/D01-*.md`.

## A5 — Build a read-only tool

**Goal:** `list_deploys` works end to end. Implement the handler binding and
register the tool in `src/tools.ts` (`TODO(A5)`) until
`test/workshop/tools.test.ts` is green. Proof in the console: run an
investigation and see `list_deploys` in the trace.

## A6 — Diagnose a live incident

**Goal:** the full loop on live telemetry.

- Terminal 1: `npm run shop` (the checkout service, `localhost:4310`)
- Terminal 2: `npm run traffic`, then `npm run chaos -- deploy v2.15.0 --mode bad-deploy`
- The console raises the incident (deterministic listener) after the error
  rate stays above 2% for about 5 minutes (`AGENT_LISTEN_WINDOW_MIN=1` for a
  faster demo). Open it: read the diagnosis and match every evidence ref to
  the trace line of the tool that produced it.
- In chat, challenge it: *"Could this be something other than the deployment?"*
- Save the diagnosis to `docs/diagnosis-live.md` (template header there).

## A7 — Pass the bench. Add a case.

**Goal:** the bench is the regression gate.

- `npm run bench` → `PASS bench (5/5)` (or better)
- Add one case to `bench/cases.json` (new incident shape or an adversarial
  alert). `npm run bench` again.
- Ask the agent to lower `bench/ratchet.json` `min_rate` → your guard rule
  from A4 denies the edit. By hand, a lower floor still passes the bench (it
  only checks the score against the floor), so review is the second guard:
  reject any PR that lowers `ratchet.json`. The floor only goes up.

## A8 — The gate: approve with your name

**Goal:** the executor verifies a signed approval before it acts. Rebuild
`checkApproval` in `src/executor.ts` (`TODO(A8)`) until
`test/workshop/executor.test.ts` is green. Then in the console: Approve with
your name → Execute → watch the three verified checkouts → **LANDED** → mark
mitigated. And confirm chat still refuses *"roll back now"* — a button, not a
sentence.

**Optional second half — the git gate.** Branch `fix/<your-name>` off your
work and try to push it: the guard hook denies the push. Your *neighbour* — a
named human — runs `npm run approve:git -- <their-name> fix/<your-name>
"<reason>"` in their own terminal; `npm run check:approval` then passes. The
agent may never run that command itself.

## A9 — Maintain + your hackathon intent.md

**Goal:** close the loop. Resolve the incident in the console with real notes
→ they land in `lessons/lessons.md` with provenance. Review
`lessons/proposed/` (agent-written, unreviewed). Then write
`docs/hackathon-intent.md`: the intent.md for the agent you build next.
Hand the day off to the next agent or teammate with the `/handoff` skill —
it writes a clipboard-ready `HANDOFF.md`.

## Solved states

`w5-step-8-maintain` equals `main`'s behaviour — same tests pass, same bench.
Every step tag is an ancestor of the next, so a diff shows exactly one
assignment.
