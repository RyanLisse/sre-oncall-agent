# Participant card · Workshop 5 · AI SRE first responder

> Generated from `workshop.json` by `npm run card`. Do not edit by hand.

The slides explain. This card is for doing. Each step says what you do, what you should see, how you check it, and what to do when you are stuck.

## Start

One command starts the lab. Keep that terminal open. Use a second terminal for everything else. The console reloads by itself when you save code; the shop keeps running.

```bash
npm ci
npm start -- --fast
```

- **See:** ✓ Lab running. The console is at http://localhost:4320 and its header shows the shop revision and telemetry buckets.
- **Check:** `curl localhost:4320/api/health` shows `"mode":"healthy"`.
- **Stuck?**
  - Port 4310 or 4320 is already in use: Another copy runs. Stop it with Ctrl+C in its terminal, then run `npm start` again.
  - Node is too old: Install Node 22 or newer. Check with `node --version`.
  - The console header says no telemetry: Wait 20 seconds. The shop writes telemetry every few seconds while traffic runs.

## Core 1 · Investigate the evidence

**Goal:** Break the shop, let the console raise an incident, and check every claim in the diagnosis against the data. Find what the agent cannot see.

Slides: practice slides 32 and 35. Replaces A1 + A6.

### 1.1 Break the shop in your second terminal: `npm run chaos -- deploy v2.15.0 --mode bad-deploy`

- **See:** After about one minute a new incident appears in the console sidebar. You did not open it; the deterministic listener did.
- **Check:** `curl localhost:4320/api/incidents` shows one incident with source "alert".
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

Slides: practice slides 47 and 51. Replaces A5 + A7.

### 2.1 Run the red test: `npx tsx --test test/workshop/tools.test.ts`

- **See:** The test fails: `list_deploys` returns nothing. `npm run bench` fails too: without deploys the agent misses the bad deploy.
- **Check:** Read the failing assertion before you change code. Say in one sentence why it fails.
- **Stuck?** Search for `TODO(A5)` in `src/tools.ts`. There are two places.

### 2.2 Build `list_deploys` in `src/tools.ts` with Claude Code or by hand. Bind the handler AND register the tool.

- **See:** `test/workshop/tools.test.ts` is green.
- **Check:** `npm run typecheck && npm test && npm run bench` all pass. The bench prints `PASS bench`.
- **Stuck?** The tool still returns `[]`: you did only one of the two halves.

### 2.3 Save. In the same incident, ask in chat: `Investigate: checkout errors after the deploy`

- **See:** The lab terminal prints a console reload line. The new diagnosis proposes `rollback` with no data gap, and the banner says Approve or reject “rollback”.
- **Check:** The diagnosis cites `deploys:<id>` for `v2.15.0`. Record it: `npm run progress:note -- "Core 2: …"`
- **Stuck?** Incident gone? You stopped the lab, so the shop is healthy again. Break it again and wait for a new incident.

## Core 3 · Judge the recovery

**Goal:** Rebuild the approval gate, sign the rollback with your name, and decide from the recovery checks whether the incident may close.

Slides: practice slides 60 and 63. Replaces A8 + A9.

### 3.1 Run the red test: `npx tsx --test test/workshop/executor.test.ts`. Rebuild `checkApproval` in `src/executor.ts` (`TODO(A8)`).

- **See:** The test is green. The executor now refuses to act without a named approval for this incident and this proposal.
- **Check:** `npm run typecheck && npm test` pass. The console reloads by itself.
- **Stuck?** Read `test/workshop/executor.test.ts`. It names every case the gate must refuse.

### 3.2 Open your incident. The banner says Approve or reject “rollback”. Type your name. Click Approve, then Execute rollback.

- **See:** The banner says Wait: recovery checks are running. About two minutes later it says LANDED or NOT LANDED.
- **Check:** The half check may fail. The full and double checks must both pass. On NOT LANDED the banner names the failed check, its value and the limit.
- **Stuck?** A button is grey: the banner says which step is allowed now. The server refuses every other button.

### 3.3 LANDED: click Mark mitigated, then Resolve with notes. NOT LANDED: do not close. Read the failed check, then investigate in chat or escalate.

- **See:** After you resolve, the banner says Closed and Execute stays disabled.
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

Run `npm run checkpoint -- core-2`. It makes a separate copy in `.lab/checkpoints/core-2`. Your own files do not change. Compare one file, then copy it yourself if you choose: `diff .lab/checkpoints/core-2/src/tools.ts src/tools.ts`

| Checkpoint | Contains |
| --- | --- |
| `start` | The starter: list_deploys and the approval gate are missing. |
| `core-2` | Core 2 solved: list_deploys works. The approval gate is still missing. |
| `core-3` | All three cores solved. |

## Where everything is

- **Participant:** [Participant card](CARD.md) · [Console](http://localhost:4320) · [Course (concepts, self-paced)](course/index.html) · [Working alone](SOLO.md)
- **Facilitator:** [Facilitator run sheet](FACILITATOR.md) · [Workshop guide](WORKSHOP.md) · [Slides (separate repo)](aetherlink-classroom-slides-w5/workshop5.html)
- **Agent:** [Agent rules](CLAUDE.md) · [Contract](docs/spec.md) · [Bench cases](bench/cases.json) · [Review checklist](REVIEW.md)
