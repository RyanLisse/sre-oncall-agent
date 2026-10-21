# Participant card · Workshop 5 · AI SRE first responder

> Generated from `workshop.json` by `npm run card`. Do not edit by hand.

The slides explain. This card is for doing. Each step says what you do, what you should see, how you check it, and what to do when you are stuck.

## Start

Create the isolated starter from committed HEAD. Keep the lab terminal open. Use a second terminal for everything else.

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

**Goal:** Break the shop, let the console raise an incident, and check every claim in the diagnosis against the data. Find what the agent cannot see.

Slides: Core 1: Investigate the evidence · Core 1: Check the claims. Replaces A1 + A6.

### 1.1 Break the shop once: click `Bad deploy v2.15.0` in the shop OR run `npm run chaos -- deploy v2.15.0 --mode bad-deploy` in your second terminal. Do not do both.

- **See:** After about one minute a new incident appears in the console sidebar. You did not open it; the deterministic listener did.
- **Check:** `curl 127.0.0.1:4320/api/incidents` shows one incident with source "alert".
- **Stuck?** No incident after three minutes: look at the lab terminal. Traffic must print requests. Started without `--fast`? Then detection takes five minutes.

### 1.2 Open the incident. Read the banner at the top, then the diagnosis.

- **See:** The diagnosis proposes `investigate-more` with low confidence. Under Data gaps it says `list_deploys: no deploys in the window`.
- **Check:** Find each reference in `demo/data/telemetry.json`. Then search that file for `v2.15.0`: there WAS a deploy. The agent cannot see it, and it says so.
- **Stuck?** References are text, not links. Search the file for the timestamp.

### 1.3 Challenge the agent in chat: Could this be something other than the deployment?

- **See:** Offline, the agent returns a scripted summary. It is not a new model investigation.
- **Check:** Compare its answer with `ruled_out` and the data gap. A missing signal is unknown, not healthy: that is why the agent does not propose a rollback.
- **Stuck?** Chat refuses your sentence: that is correct for anything that changes the system. Approve, execute and resolve are buttons.

### 1.4 Save the diagnosis in `docs/diagnosis-live.md`. Then record what you checked: `npm run progress:note -- "Core 1: <what you verified>"`

- **See:** One new line at the bottom of `PROGRESS.md`.
- **Check:** Your note names the references you checked, not only that you did it.
- **Stuck?** Do not approve. There is nothing safe to execute yet. Core 2 gives the agent its eyes back.

## Core 2 · Build a change safely and test it

**Goal:** Rebuild the read-only `list_deploys` tool test-first, prove it with the tests and the bench, and watch the diagnosis change.

Slides: Core 2: Build a change safely · Core 2: Prove it on the live incident. Replaces A5 + A7.

### 2.1 Run the red test: `npx tsx --test test/workshop/tools.test.ts`

- **See:** The test fails: `list_deploys` returns nothing. `npm run bench` fails too: without deploys the agent misses the bad deploy.
- **Check:** Read the failing assertion before you change code. Say in one sentence why it fails.
- **Stuck?** Find the single `TODO(A5)` handler stub in `src/tools.ts`. Restore its handler binding AND the MCP registration; the registration has an explanatory comment, not a second TODO marker.

### 2.2 Build `list_deploys` in `src/tools.ts` with Claude Code or by hand. Bind the handler AND register the tool.

- **See:** `test/workshop/tools.test.ts` is green. The A8 valid-approval executor assertion remains red until Core 3.
- **Check:** `npx tsx --test test/workshop/tools.test.ts`, `npm run typecheck` and `npm run bench` pass. The bench prints `PASS bench`. Executor tests remain expected to fail until Core 3 restores the approval gate.
- **Stuck?** The tool still returns `[]`: you did only one of the two halves.

### 2.3 Save. In the same incident, ask in chat: `Investigate: customers report checkout errors`

- **See:** The lab terminal prints a console reload line. The new diagnosis proposes `rollback` with no data gap, and the banner says Approve or reject “rollback”.
- **Check:** The diagnosis cites `deploys:<id>` for `v2.15.0`. Record it: `npm run progress:note -- "Core 2: …"`
- **Stuck?** Incident gone? Incident history persists in SQLite, while the shop resets on restart. Do not restart the launcher to reload code; saving auto-reloads the console. For a fresh repeat, use a new disposable checkpoint copy; do not rebreak a stale incident.

## Core 3 · Judge the recovery

**Goal:** Rebuild the approval gate, sign the rollback with your name, and decide from the recovery checks whether the incident may close.

Slides: Core 3: Judge the recovery · Core 3: Close it, or stop safely. Replaces A8 + A9.

### 3.1 Run the red test: `npx tsx --test test/workshop/executor.test.ts`. Rebuild `checkApproval` in `src/executor.ts` (`TODO(A8)`).

- **See:** The test is green. The executor now refuses to act without a named approval for this incident and this proposal.
- **Check:** `npm run verify` and `npm run test:workshop` pass before a human approves the rollback. The console reloads by itself.
- **Stuck?** Read `test/workshop/executor.test.ts`. It names every case the gate must refuse.

### 3.2 Open your incident. The banner says Approve or reject “rollback”. Type your name. Click Approve, then Execute rollback.

- **See:** The banner says Wait: recovery checks are running. About two minutes later it says LANDED or NOT LANDED.
- **Check:** The half check may fail. The full and double checks must both pass. On NOT LANDED the banner names the failed check, its value and the limit.
- **Stuck?** A button is grey: the banner says which step is allowed now. The server refuses every other button.

### 3.3 LANDED: click Mark mitigated, then Resolve with notes. NOT LANDED: do not close. Read the failed check, then investigate in chat or escalate.

- **See:** After you resolve, the next-step detail says Resolved and directs you to the notes and lesson. Execute stays disabled.
- **Check:** `lessons/lessons.md` has a new entry with your name and the incident id. Record it: `npm run progress:note -- "Core 3: …"`
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
