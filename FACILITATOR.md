# Facilitate Workshop 5

Use one route for everyone: [three core tasks](WORKSHOP.md).
Keep [PARTICIPANT.md](PARTICIPANT.md) beside the console.
Give coding agents [AGENTS.md](AGENTS.md). Participants do not manage Git branches.

## Prepare the package before class

1. Use a clean, reviewed checkout of this version with Node.js 22+ and Git.
2. Run `npm ci`, `npm run verify`, and `npm run test:workshop`.
3. Run `npm run workshop:pack -- --output ../workshop5-pack` with a new output path.
4. Distribute `starter.zip` and keep `checkpoint.zip` for explicit catch-up.
   Both come from the same committed version. Keep the generated manifest.
5. Extract each into separate fresh folders. Read WORKSHOP-PACKAGE.md in each.
6. In the starter, run `npm start`. Confirm shop health and an empty console.
   Run the focused tools test in a second terminal. Expect the two A5 failures.
7. Stop the starter launcher. In the checkpoint, run `npm start` and the same
   tools test. Expect green. Rehearse Core task 3, including safe-stop wording.

The first start installs missing dependencies. Prepare while npm is available.
The offline runtime needs no API key. Use Node with `node:sqlite` support.
Follow launcher errors for missing runtimes or occupied ports. Stop only your
own processes. Do not close another team's console.

Do not distribute an arbitrary GitHub source ZIP as the starter. It has no
core exercise cut or label. The historical `workshop/start` branch is different:
its controls are deliberately incomplete.

## Run the day

| Time | Facilitate | Accept as evidence |
| --- | --- | --- |
| 10:00–10:45 | Welcome, use case, SDLC, short demo | Agent role and human boundary |
| 10:45–11:00 | Extract starter, run `npm start` | Empty console, shop health, expected A5 failures |
| 11:00–11:15 | Break and setup help | — |
| 11:15–12:00 | Core 1: show a reference, then teams read evidence and write intent | Three references and verifiable intent checks |
| 12:00–13:00 | Lunch | — |
| 13:00–14:10 | Core 2: show the test, then teams implement the tool | Red-to-green result and verification |
| 14:10–14:40 | Core 3: inject fault and inspect diagnosis | Live ID, trace, references, chat refusal |
| 14:40–14:55 | Break | Keep a running demo supervised |
| 14:55–15:35 | Core 3: human gate and recovery review | Human closure after LANDED, or safe stop |
| 15:35–15:50 | Compare results, handoff, optional depth | Observed result, unknowns, next owner |
| 15:50–16:00 | Questions and close | Saved work and evidence |

For a short demo use `npm start -- --fast`. Announce one-minute detection.
The default is five minutes. Neither setting shortens recovery or changes
the pass rule. Inject the bad deploy separately, once, from the second terminal.
Restart after source edits; the launcher does not hot-reload code.

The slides retain optional contract, hook, bench, Git gate, and hackathon
material. Skip optional implementation until all teams finish the core.
[The advanced run sheet](FACILITATOR-ADVANCED.md) applies only to old tags.

## Help without erasing evidence

| Symptom | Next safe action |
| --- | --- |
| Node or install error | Follow the launcher error. Verify Node and npm access. |
| Port busy | Stop the copy you own. Run only one default-port launcher. |
| A5 already green | Read the package label. Open the starter or label checkpoint work. |
| Tool test still red | Check handler binding and MCP registration. |
| No incident | Read shop health and traffic logs. Wait the configured detection window. |
| Core 2 blocked | Save and stop the starter. Open a fresh checkpoint folder. |
| Execute disabled | Read Next step. Pending, rejected, attempted, or resolved incidents cannot execute. |
| NOT LANDED or unknown | Inspect the failed check and logs. Keep open. Accept a documented safe stop. |

## Rehearse a safe stop

Three fresh checkouts are not enough. Full and double metric checks must
both pass. Only half may fail. Healthy traffic has transient errors, so a
successful rollback can correctly end NOT LANDED.

For example, values `0`, `0.0125`, `0` against `0.005` fail the full check.
Show the failed value and limit. Ask what the team should inspect or who
should receive an escalation. Do not repeat rollback to get green.

## Repeat with a fresh copy

Stop the launcher, retain the old folder, and extract a new checkpoint copy.
Never delete participant databases, approvals, or lessons. The launcher archives
existing live telemetry before a new shop starts; it does not reset history.
An interrupted execution is blocked on restart because recovery is unknown.

## If Claude Code is unavailable

Do the TypeScript task by hand. The same tests apply. Agents can explain
evidence and suggest edits, but humans make console decisions. Claude-specific
skills are not prerequisites. Offline output proves integration, not model
quality. Evidence references are text, not links.
