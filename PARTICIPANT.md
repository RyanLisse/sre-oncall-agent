# Workshop 5 participant card

Extract `starter.zip` into a new folder. Open a terminal beside `package.json`.
Run **`npm start`**. Open **http://localhost:4320**. Keep the terminal running.
Use a second terminal for commands. Full instructions: [WORKSHOP.md](WORKSHOP.md).

| Task | Do | Expect and check | If stuck |
| --- | --- | --- | --- |
| **1. Read evidence** | Read the bad-deploy fixture and telemetry. Write references and intent. | Your notes cite a deploy, metric change, and error log. A neighbour can find each record. | Compare timestamps. Ask for an explanation of records, not an invented answer. |
| **2. Build safely** | Restore the `list_deploys` handler and MCP registration in `src/tools.ts`. | The two A5 tests go red to green. Typecheck, workshop tests, and verify pass. | Preserve your starter. Open the separate solved checkpoint and label it as catch-up. |
| **3. Judge recovery** | Inject one bad deploy. Read the diagnosis. A human approves and executes once. | Full and double pass before mitigation and resolution. Otherwise record a safe stop. | Inspect the failed value and limit. Keep the incident open and investigate or escalate. |

## Commands in order

```text
node --import tsx --test test/workshop/tools.test.ts
npm run typecheck
npm run test:workshop
npm run verify
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run
```

After code edits, stop `npm start` with Ctrl+C and start it again.
When ready for Core task 3, run this once in the second terminal:

```text
npm run chaos -- deploy v2.15.0 --mode bad-deploy
```

Detection takes about five minutes. `npm start -- --fast` uses one-minute
detection. Recovery still takes about two minutes. Keep traffic running.

## Human decisions

Read evidence → enter your name → approve → execute once → inspect recovery.
For **LANDED**, mark mitigated, then resolve with your own notes.
For **NOT LANDED** or unknown recovery, do not close or retry for green.
The console shows your next permitted action. Chat cannot perform these actions.

## Keep your work

Stop the launcher before changing copies. Extract `checkpoint.zip` into a
different folder. Never copy history, approvals, or lessons between copies.
Use `npm run progress:note -- "your observed result"` to record progress.
The checklist does not run tests. Offline output is not model evidence.
