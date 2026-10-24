# Facilitator run sheet — Workshop 5 (one day, starts 10:00)

The day practises the **AI software delivery lifecycle** through three
required core tasks. Claude Code is the development assistant; the runtime
SRE agent is the application being changed. Only skills, hooks, subagents and
additional bench cases are optional depth. Participants execute from
**[CARD.md](CARD.md)** or the hub
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

After the short AI-SDLC introduction, have participants create the starter
and run `claude` in terminal 1, then submit the read-only assistant prompt in
[CARD.md](CARD.md) after the lifecycle introduction and before code edits.
In terminal 2, from the original clone root, configure supported SDK access as
described in that guide, enter the same starter, then run `npm ci`,
`npm run fixtures`,
`npm run model:check` and `npm start -- --fast`. The Agent SDK is separate
from interactive CLI login; do not promise a subscription login proves SDK
access.

The slides: run `python3 serve.py` in the slides repo, then open
`http://localhost:8080/workshop5.html` (presenter view:
`workshop5-presenter.html`).

## Teach from the task

Welcome the group with the AI-SDLC learning goal. Keep welcome and W4 recap
within five minutes. Ask for one useful lesson or surprise from W4 and the
check that would catch it next time. Take two or three short answers.
Connect structured output, tool evidence and human decisions to today's full
delivery cycle; do not repeat W4 demonstrations. W4 attendance is not a
prerequisite for the solo route.

Start with the AI SDLC: why code alone is not enough, the lifecycle stages,
the evidence participants will produce, and the decisions humans keep.
Then introduce Claude Code as the development assistant and the shop as the
practice system. Do not open with installation or a checkout demonstration.
For each core, name the lifecycle stage, what participants will do, why it
is needed, and what will prove it.
Explain only the concept needed for the next action. Show one example,
then let participants use it. The card and hub put these explanations next
to the steps under **Before you act**.

| Task | Why now | Explain at first use | Evidence to collect |
| --- | --- | --- | --- |
| Core 1: specify from evidence | A plausible diagnosis is not permission to change software. | Telemetry, references and data gaps before drafting an intent; human acceptance before planning. | `docs/diagnosis-live.md` plus a human-accepted `intent.md` with observable checks. |
| Core 2: design, build and verify | Core 1 defines the outcome; each repair needs a reviewed plan. | Human starter baseline; review a plan before repairing `list_deploys`, then review a gate plan before repairing `checkApproval`; check the same incident and run full verification. | `docs/plan.md`, a meaningful diff, the actual trace, focused checks and full verification results. |
| Core 3: review, release and learn | Tests do not accept or release their own change. | Start with actual diff review, then human PR/release decision, runtime observation and next-task review. | `docs/verify/sdlc.md` records review, release or `RELEASE BLOCKED`, runtime result and next task. |

Do not insert optional skills, hooks, subagents or extra bench-case work
between these tasks. The human baseline, code review, release decision and
runtime observation are required work, not optional Git-gate material. Explain
concepts just before their first use. Return to the opening SDLC map during
the final reflection, using the work participants actually did.

## Time boxes

Before the day, prepare the learner repositories using
[docs/sdlc-git.md](docs/sdlc-git.md). GitHub learner repositories need the
published upstream `workshop/start` branch and Actions enabled; a main-only
fork is not enough. Keep the inherited CI and review gates intact. Missing
repository access is a release blocker, not a reason to simulate a merge.

Use the 32-slide core route through **Show the completed lifecycle**. The 7
slides after it are reference only. The rest
is reference material or a separate follow-up, not another required session.

| Time | Slide title / section | Block | Expected output |
| --- | --- | --- | --- |
| 10:00–10:30 | Welcome, W4 recap, AI-SDLC introduction, then Claude Code | Welcome and recap: five minutes maximum. Purpose, lifecycle, outputs and human decisions first; then assistant and practice system | participants can state the required artifacts and choose one delivery skill to improve |
| 10:30–11:00 | Start the lab and check your starting point | Setup and preflight | starter and Claude Code ready; SDK preflight passes or access blocker is recorded |
| 11:00–11:15 | Break | Break | — |
| 11:15–11:40 | Core 1: observe the evidence | Detection, one fault, references and data gaps | diagnosis checked against telemetry; `docs/diagnosis-live.md` |
| 11:40–12:00 | Core 1: accept intent | Draft and human review of observable outcome | accepted `intent.md` and decision recorded |
| 12:00–13:00 | Lunch | Lunch | — |
| 13:00–13:20 | Core 2: baseline and plan review | Human-owned baseline; smallest plan against intent | meaningful repair diff is possible; reviewed `docs/plan.md` |
| 13:20–14:10 | Core 2: repair the tool | Review the small plan, restore the registered handler, then check the same incident | focused tool test, typecheck, bench and actual trace recorded |
| 14:10–14:40 | Core 2: repair the gate and verify | Review the gate plan, repair `checkApproval`, then run the complete checks | executor test, full verification, workshop and hook checks pass; results recorded |
| 14:40–14:55 | Break | Break | — |
| 14:55–15:15 | Core 3: review the actual diff | Inspect the staged and untracked files against intent and `REVIEW.md` | findings verified by a human |
| 15:15–15:35 | PR and release decision | Human-owned learner-repo PR, current-head checks and review | merge decision recorded, or `RELEASE BLOCKED` with exact reason |
| 15:35–15:50 | Runtime observation | Briefly inspect actual model label, trace and recovery; avoid a long button demo | observed result or blocker recorded; NOT LANDED stays open |
| 15:50–16:00 | Next task and SDLC evidence | Review one next task; show the record; revisit the chosen delivery skill and bridge to W6–W7 | `docs/verify/sdlc.md` shows artifacts, checks, human decisions, runtime and next task |

Close by connecting this cycle to the next workshops. W6 starts one small
part of the participant's existing personal or team use case. W7 reviews,
finishes and presents the same scope. The shop is not a required project.

Protect the delivery and review blocks; timebox the runtime button
demonstration. Use practice time for catch-up, not more definitions.
INC-1001 is a fixture ID; live incidents have their own IDs. Offline output
is scripted and is not model-quality evidence. Real model wording varies:
teach the verified trace, missing evidence and gaps, not exact sentences.

## Top failure + fix per block

Participants working independently follow [SOLO.md](SOLO.md) and the same
card. They record self-review as a limitation and never bypass a required
external reviewer. Missing access or review becomes `RELEASE BLOCKED`.

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
  compare and copy one file themselves. Core 2 is an intermediate catch-up
  point with the read-only tool solved and the A8 gate still cut. Core 3 is
  the solved reference. Neither proves participant-authored work. Never
  `git checkout <tag> -- <files>` over participant work.

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
model evidence. The code exercises use TypeScript and `node:test`; the
required route also includes evidence, intent, planning, review and release
decisions. Participants do the two `TODO` markers by hand;
`npm run test:workshop` still grades them. The guard
hook is a `node` process and still works when fed stdin:
`echo '{"tool_name":"Edit","tool_input":{"file_path":"…/bench/ratchet.json"}}' | node .claude/hooks/guard.mjs`.
Deterministic investigation commands must use `--model offline`. Only a human
may run `npm run approve:git`, in their own terminal.

## What the evidence means

The offline runtime proves the scripted integration, not model quality.
`npm run progress` checks files and code patterns; it is not a test runner.
Ask each team to show its own command result or UI action.
