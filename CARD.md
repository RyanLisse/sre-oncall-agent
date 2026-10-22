# Participant card · Workshop 5 · AI SRE first responder

> Generated from `workshop.json` by `npm run card`. Do not edit by hand.

Start with the task and its reason. Read each concept just before you use it. Then act, check the result, and record your evidence. The slides follow this same route.

## Start

Create the isolated starter from committed HEAD. Keep the lab terminal open. Use a second terminal for everything else.

**Why:** Use an isolated local copy so you can break the demo without touching real customers or another participant's work.

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
npm start -- --fast
```

- **See:** ✓ Lab running. Hub: http://127.0.0.1:4320/hub · Console: http://127.0.0.1:4320 · Shop: http://127.0.0.1:4310.
- **Check:** `curl 127.0.0.1:4320/api/health` shows `"mode":"healthy"`.
- **Stuck?**
  - Port 4310 or 4320 is already in use: Another copy runs. Stop only your own workshop launcher with Ctrl+C in its terminal. Never kill an unknown process.
  - Node is too old: Install Node 22 or newer. Check with `node --version`.
  - The console header says no telemetry: Wait 20 seconds. The shop writes telemetry every few seconds while traffic runs.

## Core 1 · Investigate the evidence

**What you do:** Break the shop, let the console raise an incident, and check every claim in the diagnosis against the data. Find what the agent cannot see.

**Why:** A plausible explanation is not permission to change a service. Find the missing signal before proposing a fix.

**What proves it:** A saved diagnosis with checked references and the list_deploys data gap.

Slides: Core 1: Investigate the evidence · Core 1: Check the claims. Replaces A1 + A6.

### 1.1 Break the shop once: click `Bad deploy v2.15.0` in the shop OR run `npm run chaos -- deploy v2.15.0 --mode bad-deploy` in your second terminal. Do not do both.

**Before you act:** Telemetry is recorded service data. The listener opens an incident when server metrics cross a fixed limit; no model makes that decision.

- **See:** After about one minute a new incident appears in the console sidebar. You did not open it; the deterministic listener did.
- **Check:** `curl 127.0.0.1:4320/api/incidents` shows one incident with source "alert".
- **Stuck?** No incident after three minutes: look at the lab terminal. Traffic must print requests. Started without `--fast`? Then detection takes five minutes.

### 1.2 Open the incident. Read the banner at the top, then the diagnosis.

**Before you act:** An evidence reference points to an observation. A data gap means unknown, not proof that nothing happened.

- **See:** The diagnosis proposes `investigate-more` with low confidence. Under Data gaps it says `list_deploys: no deploys in the window`.
- **Check:** Find each reference in `demo/data/telemetry.json`. Then search that file for `v2.15.0`: there WAS a deploy. The agent cannot see it, and it says so.
- **Stuck?** References are text, not links. Search the file for the timestamp.

### 1.3 Challenge the agent in chat: Could this be something other than the deployment?

**Before you act:** Offline chat follows a fixed script. It does not run a fresh model investigation.

- **See:** Offline, the agent returns a scripted summary. It is not a new model investigation.
- **Check:** Compare its answer with `ruled_out` and the data gap. A missing signal is unknown, not healthy: that is why the agent does not propose a rollback.
- **Stuck?** Chat refuses your sentence: that is correct for anything that changes the system. Approve, execute and resolve are buttons.

### 1.4 Save the diagnosis in `docs/diagnosis-live.md`. Then record what you checked: `npm run progress:note -- "Core 1: <what you verified>"`

**Before you act:** A progress note records a check you performed. It is history, not a test result by itself.

- **See:** One new line at the bottom of `PROGRESS.md`.
- **Check:** Your note names the references you checked, not only that you did it.
- **Stuck?** Do not approve. There is nothing safe to execute yet. Core 2 gives the agent its eyes back.

## Core 2 · Build a change safely and test it

**What you do:** Rebuild the read-only `list_deploys` tool test-first, prove it with the tests and the bench, and watch the diagnosis change.

**Why:** Core 1 found a deployment the agent cannot read. Repair that evidence path instead of guessing the cause.

**What proves it:** Passing tool test, typecheck and bench; the same live incident now cites the deployment.

Slides: Core 2: Build a change safely · Core 2: Prove it on the live incident. Replaces A5 + A7.

### 2.1 Run the red test: `npx tsx --test test/workshop/tools.test.ts`

**Before you act:** A red test exposes the missing behaviour. The bench checks scripted outcomes across fixed scenarios, not model quality.

- **See:** The test fails: `list_deploys` returns nothing. `npm run bench` fails too: without deploys the agent misses the bad deploy.
- **Check:** Read the failing assertion before you change code. Say in one sentence why it fails.
- **Stuck?** Find the single `TODO(A5)` handler stub in `src/tools.ts`. Restore its handler binding AND the MCP registration; the registration has an explanatory comment, not a second TODO marker.

### 2.2 Build `list_deploys` in `src/tools.ts` with Claude Code or by hand. Bind the handler AND register the tool.

**Before you act:** MCP exposes named tools. The handler reads data; its binding and registration make that read-only result available.

- **See:** `test/workshop/tools.test.ts` is green. The A8 valid-approval executor assertion remains red until Core 3.
- **Check:** `npx tsx --test test/workshop/tools.test.ts`, `npm run typecheck` and `npm run bench` pass. The bench prints `PASS bench`. Executor tests remain expected to fail until Core 3 restores the approval gate.
- **Stuck?** The tool still returns `[]`: you did only one of the two halves.

### 2.3 Save. In the same incident, ask in chat: `Investigate: customers report checkout errors`

**Before you act:** A trace records the tools used for a diagnosis. Re-investigation lets you compare the same incident before and after the repair.

- **See:** The lab terminal prints a console reload line. The new diagnosis proposes `rollback` with no data gap. The next-step banner asks you to read the evidence before a named approval or rejection.
- **Check:** The diagnosis cites `deploys:<id>` for `v2.15.0`. Record it: `npm run progress:note -- "Core 2: …"`
- **Stuck?** Incident gone? Incident history persists in SQLite, while the shop resets on restart. Do not restart the launcher to reload code; saving auto-reloads the console. For a fresh repeat, use a new disposable checkpoint copy; do not rebreak a stale incident.

## Core 3 · Judge the recovery

**What you do:** Rebuild the approval gate, sign the rollback with your name, and decide from the recovery checks whether the incident may close.

**Why:** The agent must not authorize its own action. A successful rollback is not proof that the service recovered.

**What proves it:** Passing gate tests plus a justified human closure, or a documented NOT LANDED stop with the incident left open.

Slides: Core 3: Judge the recovery · Core 3: Close it, or stop safely. Replaces A8 + A9.

### 3.1 Run the red test: `npx tsx --test test/workshop/executor.test.ts`. Rebuild `checkApproval` in `src/executor.ts` (`TODO(A8)`).

**Before you act:** The approval gate validates a named human decision for this incident and proposal. The starter fails closed until you rebuild it.

- **See:** The test is green. The executor now refuses to act without a named approval for this incident and this proposal.
- **Check:** `npm run verify` and `npm run test:workshop` pass before a human approves the rollback. The console reloads by itself.
- **Stuck?** Read `test/workshop/executor.test.ts`. It names every case the gate must refuse.

### 3.2 Open your incident and read the diagnosis and evidence. Type your name. Click Approve, then Execute rollback.

**Before you act:** Rollback restores the prior deployment. Recovery checks capture measured values against a frozen limit; execution success alone is insufficient.

- **See:** The banner asks you to wait for execution and all three recovery checks. About two minutes later, inspect LANDED or NOT LANDED and the recovery table.
- **Check:** The half check may fail. The full and double checks must both pass. On NOT LANDED the banner names the failed check, its value and the limit.
- **Stuck?** A button is grey: the banner says which step is allowed now. The server refuses every other button.

### 3.3 LANDED: click Mark mitigated, then Resolve with notes. NOT LANDED: do not close. Read the failed check, then investigate in chat or escalate.

**Before you act:** LANDED means the full and double checks passed. Mitigated and resolved are separate human decisions. NOT LANDED or unknown means stop.

- **See:** After you resolve, the next-step detail says Resolved and directs you to the notes and lesson. Execute stays disabled.
- **Check:** If resolved, `lessons/lessons.md` has your name and the incident id. If NOT LANDED, confirm the incident remains open and retain the failed check. Record your actual outcome: `npm run progress:note -- "Core 3: …"`
- **Stuck?** Never execute again to get a green result. NOT LANDED is a correct, safe stop.

## Go deeper (optional)

| # | Task | Do |
| --- | --- | --- |
| A2 | Write your team intent.md | Fill `intent.md`: who the agent serves, the boundary, and three checks a stranger can verify. The design-control-loop skill can interview you. |
| A3 | Read the contract | Write `docs/spec.md` for the evidence rules in `src/contract.ts`. Run `npx tsx --test test/contract.test.ts` and break one rule on purpose. |
| A4 | Add your own guard rule | Add one deny rule of your own to `.claude/hooks/guard.mjs` BY HAND (the agent may not edit hooks). Prove it with a deny line in `approvals/audit.jsonl`. Write `docs/decisions/D01-*.md`. |
| A7 | Add a bench case | Add one case to `bench/cases.json`, run `npm run bench`. Ask the agent to lower `bench/ratchet.json` and watch the guard deny it. |
| A8b | The git gate | Ask the agent to push `fix/<your-name>`: denied. Your neighbour runs `npm run approve:git -- <their-name> fix/<your-name> "<reason>"` in their own terminal. |
| A9b | Your hackathon intent.md | Write `docs/hackathon-intent.md` for the agent you build next. Hand off with the `/handoff` skill. |

## Behind? Catch up without losing your work

Run `npm run checkpoint -- core-2` or `npm run checkpoint -- core-3` from any starter copy. Each creates a separate current-HEAD worktree under `.lab/checkpoints/` and refuses to overwrite an existing destination. Your files remain unchanged. Never copy runtime data, approvals, progress, or lesson history.

| Checkpoint | Contains |
| --- | --- |
| `start` | The committed-HEAD starter has the A5 tool exercise and a fail-closed A8 approval gate. |
| `core-2` | Core 2 retains the solved read-only tool and the fail-closed A8 approval gate. |
| `core-3` | Core 3 is the solved committed HEAD with no exercise cuts. |

## Where everything is

- **Participant:** [Participant card](CARD.md) · [Console](http://127.0.0.1:4320) · [Course (concepts, self-paced)](course/index.html) · [Working alone](SOLO.md)
- **Facilitator:** [Facilitator run sheet](FACILITATOR.md) · [Workshop guide](WORKSHOP.md) · [Slides (separate repo)](aetherlink-classroom-slides-w5/workshop5.html)
- **Agent:** [Agent rules](CLAUDE.md) · [Contract](docs/spec.md) · [Bench cases](bench/cases.json) · [Review checklist](REVIEW.md)
