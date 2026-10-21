# Workshop 5 agent entry point

Read [CLAUDE.md](CLAUDE.md) for the non-negotiable safety rules.
Follow [WORKSHOP.md](WORKSHOP.md), not the historical nine-step route, unless
the human chooses advanced work. This file does not authorize you to approve,
execute, mitigate, resolve, or push.

## Identify the copy before editing

Read WORKSHOP-PACKAGE.md if present. A core starter has only the A5 tool cut.
A checkpoint is solved. A checkout without that file is a reference checkout;
do not claim it is the participant starter. Do not switch branches or restore
checkpoint files over participant edits.

## Start and inspect

- `npm start` starts local shop, traffic, and console. Keep its terminal open.
- `npm start -- --fast` selects one-minute detection for a demo.
- Read the launcher's error before retrying. Never kill an unknown process to free a port.
- After source edits, ask the human to stop their launcher, then restart it.
- First installation needs npm access. The lab runtime needs no model key.

## Help with one core task at a time

1. Evidence: read the fixture and telemetry. Cite exact records. Help with
   intent and observations. Do not invent evidence or live results.
2. Build: implement and register `list_deploys` in `src/tools.ts`. Keep tools
   read-only. Do not edit tests to hide an exercise failure.
3. Recovery: explain the diagnosis and checks. Ask the human to decide in
   the console. Never enter a name or use approval or execution endpoints
   on their behalf. NOT LANDED and unknown results mean stop, not retry.

## Verify the code

Run the focused test first. After it passes, run the remaining checks once:

```text
node --import tsx --test test/workshop/tools.test.ts
npm run typecheck
npm run test:workshop
npm run verify
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run
```

On the untouched core starter, only the two A5 workshop tests are expected
to fail. Do not call it solved. A checkpoint does not prove the participant
wrote the code. `npm run progress` is not a test runner.

Record results with `npm run progress:note -- "observed result"`. Never edit
PROGRESS.md directly. Keep participant work, history, approvals, and lessons.
For catch-up, ask the human to use a fresh checkpoint folder. For a blocker,
report the command, error, current copy, and next safe action. Do not bypass
a hook, lower a recovery limit, or weaken the bench floor.
