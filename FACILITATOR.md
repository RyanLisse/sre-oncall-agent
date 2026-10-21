# Facilitator run sheet — Workshop 5 (one day, starts 10:00)

The day has **three core tasks**. Everything else is optional depth. The
slides explain; participants execute from **[CARD.md](CARD.md)** or the hub
(`http://127.0.0.1:4320/hub`). Both are generated from `workshop.json`
(`npm run card`). Change the steps there, never in the generated files.

## Prepare (the evening before)

Use two separate clones. Never present a solved clone as the starter.

| Clone | Checkpoint | Check |
| --- | --- | --- |
| Participant route | `npm run checkpoint -- start` then `cd .lab/checkpoints/start` | the A5 tool and A8 approval exercises are intentionally incomplete; A8 fails closed |
| Solved demo | `npm run checkpoint -- core-3` then `cd .lab/checkpoints/core-3` | `npm run verify` and `npm run test:workshop` pass |

From each clone, create the intended checkpoint, then run its launcher:
`npm run checkpoint -- start` (or `core-3` for the solved demo), followed by
`cd .lab/checkpoints/start` (or `core-3`) and `npm start -- --fast`. Open
`http://127.0.0.1:4320/hub`. Ctrl+C stops only processes started by that
launcher. Run one clone at a time on the default ports; if a port is busy,
only stop your own workshop launcher.

The slides: run `python3 serve.py` in the slides repo, then open
`http://localhost:8080/workshop5.html` (presenter view:
`workshop5-presenter.html`).

## Time boxes

The deck keeps its order and times. The practice slides now carry the
three cores and the optional depth.

| Time | Slide title / section | Block | Expected output |
| --- | --- | --- | --- |
| 10:00–10:50 | Introduction | AI-native SDLC loop, the use case, the console | participants can name the 7 phases |
| 10:50–11:00 | Start the lab | **Start the lab** | checkpoint copy prints ✓ Lab running; hub opens |
| 11:00–11:15 | Break | Break | — |
| 11:28–11:43 | Core 1: Investigate the evidence | **Core 1** (part 1) | shop broken by the participant; incident raised by the listener; data gap on `list_deploys` |
| 11:47–12:00 | Core 1: Check the claims | **Core 1** (part 2) | every reference checked in `demo/data/telemetry.json`; `docs/diagnosis-live.md` |
| 12:00–13:00 | Lunch | Lunch | — |
| 13:30–13:50 | Optional depth: Your guard rule | Go deeper (A4) · catch-up buffer for core 1 | optional |
| 14:00–14:15 | Core 2: Build a change safely | **Core 2** | `test/workshop/tools.test.ts` green |
| 14:15–14:40 | Core 2: Prove it on the live incident | **Core 2** (prove it) | focused tool test + typecheck + `PASS bench`; A8 valid-approval assertion remains expected red until Core 3; `list_deploys` in the trace |
| 14:40–14:55 | Break | Break | — |
| 15:04–15:15 | Optional depth: A bench case and the ratchet | Go deeper (A7) | optional |
| 15:18–15:35 | Core 3: Judge the recovery | **Core 3** (gate + execute) | `test/workshop/executor.test.ts` green; approved with a name; recovery running |
| 15:35–15:50 | Core 3: Close it, or stop safely | **Core 3** (judge + close) | LANDED → mitigated → resolved with notes; or a correct stop on NOT LANDED |
| 15:50–16:00 | Close, skills pack, hackathon bridge | Close | `docs/hackathon-intent.md` is optional depth |

The gaps between boxes are the deck's talk and demo segments.

## Top failure + fix per block

- **Start** — `npm start` stops with a port message: another copy runs. Stop
  only your own workshop launcher; never kill an unknown process. Node too old:
  install Node 22+.
- **Core 1** — no incident: the lab terminal must show traffic lines. Use one
  fault trigger only: click **Bad deploy v2.15.0** in the shop OR run the
  chaos CLI, never both. The shop's checkout counter is local to its process
  and resets with the shop; the console reads persisted SQLite telemetry.
  Never click Reset to force a green counter or treat it as recovery evidence.
  Without
  `--fast` detection takes five minutes. Check `curl 127.0.0.1:4320/api/incidents`.
  References are text, not links: search the data file for the timestamp.
  Offline chat is a scripted summary, not a new model run.
- **Core 2** — the tool returns `[]`: they bound the handler but did not
  register `tool("list_deploys", …)`, or the reverse. The console reloads on
  save (a reload line in the lab terminal); do not restart the launcher to
  reload code. Incident history persists in SQLite, while the shop resets on
  restart. For a fresh repeat, create a new disposable checkpoint; do not
  rebreak a stale incident.
  Core 1 on the starter correctly ends in `investigate-more` with a data gap:
  the agent cannot see the deploy. That gap is the reason for core 2.
- **Core 3** — a button is grey: read the banner. It names the one allowed
  step. The server refuses every other button with 409. Execute is refused:
  the approval needs a name and must match this incident and `rollback`.
  Allow about two minutes for recovery checks; keep the lab running.
- **Catch-up** — `npm run checkpoint -- core-2` makes a separate copy in
  `.lab/checkpoints/core-2`. It never changes the participant's files. They
  compare and copy one file themselves. Never `git checkout <tag> -- <files>`
  over participant work.

## If recovery says NOT LANDED

The console names the failed check, its value and the limit. The full and
double checks must both pass; only the half check may fail. The healthy shop
still emits occasional transient errors, so a correct rollback can end in
`NOT LANDED`. Keep that incident open. Read the failed window and the logs.
Investigate or escalate. Do not execute again to get a green result: the
console allows no second execute. Use this to teach the safe stop.

## Repeat the demo without deleting participant work

Stop the lab with Ctrl+C. Make a new disposable copy with
`npm run checkpoint -- core-3`, then `cd .lab/checkpoints/core-3` and
`npm start -- --fast`. `npm run fixtures` regenerates fixture telemetry only;
it does not reset live telemetry, console history, approvals or lessons.

## No-Claude dry run (agent unavailable)

Every core task is plain TypeScript + `node:test`. Participants do the two
`TODO` markers by hand; `npm run test:workshop` still grades them. The guard
hook is a `node` process and still works when fed stdin:
`echo '{"tool_name":"Edit","tool_input":{"file_path":"…/bench/ratchet.json"}}' | node .claude/hooks/guard.mjs`.
Only a human may run `npm run approve:git`, in their own terminal.

## What the evidence means

The offline runtime proves the scripted integration, not model quality.
`npm run progress` checks files and code patterns; it is not a test runner.
Ask each team to show its own command result or UI action.
