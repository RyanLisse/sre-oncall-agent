# Workshop 5 advanced route: all nine assignments

Optional reference for historical `workshop/start` and checkpoint tags.
Use [WORKSHOP.md](WORKSHOP.md) for the default three-task route.

The team path through this repo. You build the agent piece by piece, test
first, with Claude Code as the builder — and you learn the AI SDLC loop on the
way: **Intent → Spec → Design/controls → Build → Test/evals → Gate →
Maintain.**

Everything runs offline. No API key needed: the scripted runtime
(`src/runtime.ts`) drives the same tools as a real model. A real model is
optional (`AGENT_MODEL=<name>`).

## Setup

Keep this guide open on the repository's default branch in your browser.
The starter branch and checkpoint tags contain older copies of the guide.
Use those refs for code, not for the current instructions.

```bash
git clone <repo-url>            # the URL your facilitator gives you
cd sre-oncall-agent
git checkout workshop/start
git switch -c my/workshop-5
npm ci
npm run fixtures
npm test                        # green: the main suite
npm run test:workshop           # red: the exercises (by design)
npm run console                 # http://localhost:4320
```

`workshop/start` has five cut markers across A3, A4, A5 and A8 —
`npm run workshop:check` lists them. `npm test` stays green; the red tests
live in `test/workshop/`. `npm run progress` shows which assignments already
have evidence.

Work on your own branch. Do not push to the shared `workshop/start` branch.
The empty console is correct at A1. The shop is an HTTP API, not a storefront.
Open the console at `http://localhost:4320`. The shop health response is at
`http://localhost:4310/health` once you start the shop in A6.

Behind? First commit your work, or use `git stash push -u -m "before catch-up"`.
Then use the exact tag and file list in the table below. The command replaces
those files and stages them. Read `git diff --cached` before you continue.
The numeric tag suffix is not the assignment number: A3 uses `w5-step-2-spec-contract`.
Do not copy approvals or lessons from a solved state. Make your own records.

`npm run progress` checks for files and code patterns. It does not run tests
or prove that the UI works. Record the commands and results yourself:
`npm run progress:note -- "A3: contract tests passed; dry run accepted"`.
Only write that note after you have run those checks.

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
| A8 | The gate: approve with your name | `git checkout w5-step-7-gate -- src/executor.ts` | `w5-step-7-gate` |
| A9 | Maintain + your hackathon intent.md | `git checkout w5-step-8-maintain -- docs/hackathon-intent.md` then write your own resolution notes | `w5-step-8-maintain` |

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
`test/contract.test.ts` too. Changing only `src/contract.ts` leaves these
verdicts incomplete. The console must
still render a diagnosis — run one in
`npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run`.
Run only the A3 tests while you build: `npx tsx --test test/workshop/contract.test.ts`.
Other assignment tests remain red until you implement those assignments.
Restart the console after code changes. It does not reload source files.

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

- First finish A3, A4 and A5. Restart the console to load your changes.
- Terminal 1: `npm run console` (keep it running).
- Terminal 2: `npm run shop` (keep it running).
- Terminal 3: `npm run traffic` (keep it running).
- Terminal 4: `npm run chaos -- deploy v2.15.0 --mode bad-deploy`.
- The console raises the incident (deterministic listener) after the error
  rate stays above 2% for about 5 minutes (`AGENT_LISTEN_WINDOW_MIN=1` for a
  faster demo). Live incident IDs differ from the fixture's `INC-1001`.
  Open the incident. The trace shows tool names and inputs, not returned IDs.
  Read the references in the diagnosis and find the matching entries in
  `demo/data/telemetry.json`. References are text, not clickable links.
- In chat, challenge it: *"Could this be something other than the deployment?"*
- Offline chat returns a scripted summary, not a new model investigation.
  Compare `ruled_out` and `would_change_my_mind` in the diagnosis.
- Save the diagnosis to `docs/diagnosis-live.md` (template header there).

The default detection window is five minutes. For a one-minute demo, stop
the console with Ctrl+C, then use the command for your shell:

| Shell | Console command |
| --- | --- |
| bash or zsh | `AGENT_LISTEN_WINDOW_MIN=1 npm run console` |
| PowerShell | `$env:AGENT_LISTEN_WINDOW_MIN='1'; npm run console` |
| cmd | `set "AGENT_LISTEN_WINDOW_MIN=1" && npm run console` |

This changes detection only. Recovery checks still take about two minutes.
If no incident opens, check that traffic and the shop are running and that
the console header shows telemetry. An empty incident list is not proof of health.

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

Restart the console after you change the executor. Keep traffic running
during execution. The watch takes about two minutes. The half check can fail,
but the full and double checks must both pass. The healthy demo still has
occasional transient errors. A successful rollback can therefore end in
`NOT LANDED`. Read the final result. If it says `NOT LANDED`, do not mark the
incident mitigated. Inspect the failed metric window and logs, then investigate
or escalate. Do not execute rollback again just to get a green result.
`LANDED` does not close the incident. You mark it mitigated, then resolve it
with your name and notes in A9.

**Optional second half — the git gate.** Branch `fix/<your-name>` off your
work and ask the agent to push it: the guard hook denies that tool call.
The hook does not intercept raw git commands in a human terminal. Your *neighbour* — a
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

`w5-step-8-maintain` is the pinned solved workshop reference. `main` may
include later changes. Verify both rather than assuming they are identical.
Every step tag is an ancestor of the next, so a diff shows exactly one
assignment.
