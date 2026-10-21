# Workshop 5: three core tasks

Build one read-only tool, investigate a checkout failure, and decide whether
recovery is proven. The example is an SRE agent. The lesson is the AI-native
SDLC: intent, spec, controls, build, tests, gate, and maintenance.

Keep [the participant card](PARTICIPANT.md) beside the console.
Facilitators use [the run sheet](FACILITATOR.md).
Coding agents start with [AGENTS.md](AGENTS.md), then [CLAUDE.md](CLAUDE.md).

## Open your starter

1. Get `starter.zip` from your facilitator. Extract it into a new folder.
2. Open a terminal in the extracted `starter` folder, beside `package.json`.
3. Check that Node.js 22 or newer and npm are installed.
4. Run `npm start`.
5. Open `http://localhost:4320`.

The launcher checks dependencies and starts the shop API, traffic, and console.
It does not inject a fault, approve, execute, or close an incident. Keep its
terminal open. Use one other terminal for commands and code checks.
These commands work in PowerShell, cmd, and macOS or Linux terminals.

The console is the UI. The shop has no storefront. Its health endpoint is
`http://localhost:4310/health`. An empty incident list is normal at first;
it does not prove the shop is healthy.

The core starter has one exercise, `TODO(A5)` in `src/tools.ts`. Contract,
chat, hook, and executor controls are already implemented. This is **not**
the historical `workshop/start` branch, which removes several controls.
Git, an API key, and Claude Code are not required for the core tasks.
If you use Claude Code, log in with your own account and let it read AGENTS.md.
Offline console responses are scripted integration output, not model evidence.

## Core task 1: read the evidence

1. Open `fixtures/incidents/bad-deploy.json` and its telemetry file.
2. Find the deploy, metric change, and error log. Record their references in
   `docs/diagnosis-live.md` under a heading named `Fixture analysis`.
3. Update `intent.md` with who the agent serves, what it returns, and what it
   must never do. Add three checks another person can repeat.
4. Explain your evidence to a neighbour. Separate observations from hypotheses.

Done when your notes cite actual `deploys:`, `metrics:`, and `logs:` records
for fixture `INC-1001`, and your intent keeps decisions with a named human.
Do not describe fixture results as live results. If stuck, compare timestamps
in `fixtures/telemetry/bad-deploy.json`. Ask an agent to explain those records.

## Core task 2: build and test one safe change

1. Run `node --import tsx --test test/workshop/tools.test.ts`. Both A5 tests
   fail in a fresh starter. If they already pass, read WORKSHOP-PACKAGE.md:
   you may have opened the solved checkpoint.
2. In `src/tools.ts`, bind `list_deploys` to `listDeploys` with its time arguments.
3. Register `list_deploys` in `createTelemetryServer`, following the other
   read-only tools. Do not add a rollback, scale, or flag tool.
4. Run the same focused test until it passes.
5. Run `npm run typecheck`, `npm run test:workshop`, then `npm run verify`.
6. Run `npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run`.
7. Record actual results with `npm run progress:note -- "Core 2: tool tests and verification passed"`.
8. Stop the launcher with Ctrl+C. Run `npm start` again to load your changes.

Done when the tool tests and checks pass and the dry-run trace includes
`list_deploys`. A green `npm run progress` checklist is not a test result.
If blocked, use the separate checkpoint route below. Do not weaken a control,
disable a test, or lower `bench/ratchet.json`.

## Core task 3: judge live recovery

1. Keep `npm start` running. In the other terminal, run
   `npm run chaos -- deploy v2.15.0 --mode bad-deploy` once.
2. Wait for sustained detection, about five minutes by default. For a faster
   class, start with `npm start -- --fast` instead. That changes detection
   to one minute, not the recovery policy.
3. Open the new incident. Its ID differs from fixture `INC-1001`.
4. Read the diagnosis, tool trace, and references. Compare them with
   `demo/data/telemetry.json`. Save your findings under `Live observations`
   in `docs/diagnosis-live.md`.
5. Send `roll back now` in chat. It must refuse. Chat cannot approve or mutate.
6. If the evidence supports the proposal, enter your name and click **Approve**.
   Approval alone does not execute. Otherwise reject and investigate.
7. Click **Execute rollback** once. The separate executor verifies the approval
   and target, then requires fresh checkout evidence.
8. Keep traffic running through the half, full, and double checks, about two
   minutes by default. Read the **Next step** panel and recovery table.

If the result is **LANDED**, review the evidence, click **Mark mitigated**,
then **Resolve with notes**. State what you actually observed. Your name,
incident ID, and date accompany the lesson. Resolved incidents cannot execute again.

If the result is **NOT LANDED**, a missing signal, or an interrupted run,
keep the incident open. Record the failed check, measured value, limit, and
your next investigation or escalation. Do not repeat rollback to obtain green.
Do not lower the limit. A safe stop with evidence completes this task.

Done when you show either human-authored closure after proven recovery or an
evidence-based safe stop. A successful rollback alone proves neither.
Healthy traffic has occasional transient errors. Full and double must both
pass; only half may fail.

## Catch up without overwriting work

1. Save your starter files. Keep that folder unchanged.
2. Stop its launcher with Ctrl+C.
3. Extract `checkpoint.zip` into a different, new folder.
4. Read WORKSHOP-PACKAGE.md. It must say solved checkpoint.
5. Run `npm start` there. Continue Core task 3 with a new live incident.

Never extract over the starter. Never copy its database, approvals, telemetry,
or lessons into the checkpoint. Only one copy can use the default ports at a
time. Label checkpoint evidence as checkpoint evidence, not code you wrote.
The launcher preserves records; it is not a reset command.

## Continue with optional depth

The [advanced route](WORKSHOP-ADVANCED.md) retains A1–A9 and the historical
checkpoint tags. Contract design, hook implementation, extra bench cases,
the Git approval gate, and hackathon intent are optional depth after the core.
Keep that branch in another copy. Solve its deliberate control gaps before
live execution. [SOLO.md](SOLO.md) keeps the full self-study sequence.
