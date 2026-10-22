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

In the first five minutes, have participants create the starter and run
`claude` in terminal 1, then submit the read-only prompt in
[docs/claude-code.md](docs/claude-code.md) before theory or edits. In terminal
2, from the original clone root, configure supported SDK access as described
in that guide, enter the same starter, then run `npm ci`, `npm run fixtures`,
`npm run model:check` and `npm start -- --fast`. The Agent SDK is separate
from interactive CLI login; do not promise a subscription login proves SDK
access.

The slides: run `python3 serve.py` in the slides repo, then open
`http://localhost:8080/workshop5.html` (presenter view:
`workshop5-presenter.html`).

## Teach from the task

Start with the shop and the failing checkout, not a glossary. For each core,
ask what participants will do, why it is needed, and what will prove it.
Explain only the concept needed for the next action. Show one example,
then let participants use it. The card and hub put these explanations next
to the steps under **Before you act**.

| Task | Why now | Explain at first use | Evidence to collect |
| --- | --- | --- | --- |
| Core 1: investigate | A plausible diagnosis is not permission to act. | Telemetry before the fault; references and data gaps before reading the diagnosis; progress notes before recording evidence. | Checked references and the missing deployment signal. |
| Core 2: repair the tool | Core 1 found data the agent cannot read. | Repo rules and a small plan before editing; MCP beside the handler and registration; trace and bench before checking the repair. | Tool test, typecheck and bench pass; the same incident cites the deploy. |
| Core 3: judge recovery | A diagnosis cannot approve its own action. | Named approval before rebuilding the gate; frozen recovery checks before judging the result; closure notes only after LANDED. | Passing gate tests and a justified closure, or a documented safe stop. |

Do not insert the optional skills, hooks, subagents or Git-gate material
between these tasks. The deck labels that material **Optional depth** after
the closing recap. If a team chooses an extension, explain its concept just
before that extension. Name the full SDLC loop during the final reflection,
using the work participants actually did.

## Time boxes

Use the main route through **Close: show what you can now prove**. The rest
is reference material or a separate follow-up, not another required session.

| Time | Slide title / section | Block | Expected output |
| --- | --- | --- | --- |
| 10:00–10:30 | The shop and the problem | What, why, outputs, human boundaries | participants can explain the task and why evidence comes first |
| 10:30–11:00 | Start the lab | **Start the lab** | checkpoint copy prints ✓ Lab running; hub opens |
| 11:00–11:15 | Break | Break | — |
| 11:15–11:37 | Core 1: Investigate the evidence | Brief, detection, one fault, evidence concepts | shop broken once; listener raises an incident; explain the data gap |
| 11:37–12:00 | Core 1: Check the claims | **Core 1** (check and record) | references checked in `demo/data/telemetry.json`; `docs/diagnosis-live.md` |
| 12:00–13:00 | Lunch | Lunch | — |
| 13:00–13:22 | Core 2: Why this change | Scope, plan, tool boundary, trace and bench beside the code | each pair states its change and proof |
| 13:22–14:10 | Core 2: Build a change safely | **Core 2** | `test/workshop/tools.test.ts` green |
| 14:10–14:40 | Core 2: Prove it on the live incident | **Core 2** (prove it) | focused tool test + typecheck + `PASS bench`; A8 assertion remains expected red until Core 3; `list_deploys` in the trace |
| 14:40–14:55 | Break | Break | — |
| 14:55–15:25 | Human gate, then Core 3: Judge the recovery | Gate concept, implementation, tests, human action | executor and full checks green; named approval and separate execution |
| 15:25–15:50 | Recovery result, then Core 3: Close it, or stop safely | Read the frozen checks before deciding | LANDED → mitigated → resolved with notes; or a correct stop on NOT LANDED |
| 15:50–16:00 | The AI-native loop; Close: show what you can now prove | Reflect on the work, then stop | each team shows its evidence and explains its decision |

Use practice time for catch-up, not more definitions. In the scenario slide,
INC-1001 is a fixture ID; live incidents have their own IDs. Offline output
is scripted and is not model-quality evidence. Real model wording varies:
teach the verified trace, missing evidence and gaps, not exact sentences.

## Top failure + fix per block

- **Start** — `npm start` stops with a port message: another copy runs. Stop
  only your own workshop launcher; never kill an unknown process. Node too old:
  install Node 22+.
- **Core 1** — no incident: the lab terminal must show traffic lines. Use one
  fault trigger only: click **Bad deploy v2.15.0** in the shop OR run the
  chaos CLI, never both. The shop UI counters cover this browser's checkout
  requests over the last 30 seconds, not the terminal's traffic. Its chart
  covers 60 seconds. The console reads server telemetry from
  `demo/data/telemetry.json`; incident history is stored separately in SQLite.
  Never click Reset to force a green counter or treat it as recovery evidence.
  Without
  `--fast` detection takes five minutes. Check `curl 127.0.0.1:4320/api/incidents`.
  References are text, not links: search the data file for the timestamp.
  Offline chat is a scripted summary, not a new model run.
- **Core 2** — the tool returns `[]`: inspect the registered
  `tool("list_deploys", …)` and its handler binding. The starter preserves the
  registration but its handler is an empty stub. The console reloads on save
  (a reload line in the lab terminal); do not restart the launcher to reload
  code. Incident history persists in SQLite, while the shop resets on restart.
  For a fresh repeat, create a new disposable checkpoint; do not rebreak a
  stale incident.
  Offline Core 1 output uses `investigate-more` with a data gap as the
  deterministic starter example. Real-model output varies; check its actual
  trace, deploy references and gaps. A failed contract or fabricated citation
  means preserve the output and stop, not assume the same diagnosis.
- **Core 3** — a button is grey: read the banner. It names the one allowed
  step. The server refuses every other button with 409. Execute is refused
  when the named approval does not match this incident and the actual
  proposal. Do not assume every model response proposes rollback.
  Allow about two minutes for recovery checks; keep the lab running.
- **Catch-up** — `npm run checkpoint -- core-2` makes a separate copy in
  `.lab/checkpoints/core-2`. It never changes the participant's files. They
  compare and copy one file themselves. Never `git checkout <tag> -- <files>`
  over participant work.

## If recovery says NOT LANDED

The console names the failed check, its value and the limit. The full and
double checks must both pass; only the half check may fail. In the seeded
rollback example, occasional transient errors can still produce
`NOT LANDED`. Keep that incident open. Read the failed window and the logs.
Investigate or escalate. Do not execute again to get a green result: the
console allows no second execute. Use this to teach the safe stop.

## Repeat the demo without deleting participant work

Stop the lab with Ctrl+C. Make a new disposable copy with
`npm run checkpoint -- core-3`, then `cd .lab/checkpoints/core-3` and
`npm start -- --fast`. `npm run fixtures` regenerates fixture telemetry only;
it does not reset live telemetry, console history, approvals or lessons.

## Explicit offline fallback (agent unavailable)

Use `npm start -- --fast --offline`; state clearly that it is a fallback, not
model evidence. Every core task is plain TypeScript + `node:test`. Participants do the two
`TODO` markers by hand; `npm run test:workshop` still grades them. The guard
hook is a `node` process and still works when fed stdin:
`echo '{"tool_name":"Edit","tool_input":{"file_path":"…/bench/ratchet.json"}}' | node .claude/hooks/guard.mjs`.
Deterministic investigation commands must use `--model offline`. Only a human
may run `npm run approve:git`, in their own terminal.

## What the evidence means

The offline runtime proves the scripted integration, not model quality.
`npm run progress` checks files and code patterns; it is not a test runner.
Ask each team to show its own command result or UI action.
