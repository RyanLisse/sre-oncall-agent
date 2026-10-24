# Participant card · Workshop 5 · AI-native SDLC with Claude Code

> Generated from `workshop.json` by `npm run card`. Do not edit by hand.

Start with the task and its reason. Read each concept just before you use it. Then act, check the result, and record your evidence. The slides follow this same route.

## Start with the AI SDLC

Faster code is not enough. A useful change needs a clear outcome, checked evidence and a human release decision.

Plan → Design → Build → Test → Release → Observe → Plan again.

Produce an accepted intent, a reviewed plan, a tested diff, a human release decision and one reviewed next task.

We change the SRE agent and observe a local shop. These are practice systems, not the learning goal. Working without a facilitator? Follow SOLO.md for setup, self-review, pauses and blockers, then complete the same Core 1–3 steps below. Read each Before you act explanation; no presentation is required.

## Start

Install Claude Code with the official instructions at https://code.claude.com/docs/en/setup, then create this isolated starter. Terminal 1 starts Claude Code after the lifecycle introduction and before code edits; terminal 2 configures the SDK and runs the lab.

**Why:** Practise a software delivery cycle on a local SRE agent. Claude Code helps develop the software; the separate runtime agent reads the shop telemetry. Humans accept plans, review evidence and authorize release.

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
```

### Claude Code first minutes

In terminal 1, run `claude` in the starter after the lifecycle introduction and before code edits.

> Read CLAUDE.md, AGENTS.md and CARD.md. Explain the AI SDLC we will practise, its required artifacts and human decisions. Distinguish your development role from the runtime SRE agent. Name the two starter exercises. Do not edit files or run approval, execution, mitigation, resolution, commit or push commands. Wait for my review.

In terminal 2, from the original clone root, configure supported SDK access as described in the setup guide, then run:

```bash
cd .lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check
npm start -- --fast
```

- **See:** ✓ SDK preflight passes before fault injection, then the lab runs. Hub: http://127.0.0.1:4320/hub · Console: http://127.0.0.1:4320 · Shop: http://127.0.0.1:4310.
- **Check:** `curl 127.0.0.1:4320/api/health` shows `"mode":"healthy"` and the selected model. `npm run model:check` must return READY before a real-model fault injection.
- **Stuck?**
  - Port 4310 or 4320 is already in use: Another copy runs. Stop only your own workshop launcher with Ctrl+C in its terminal. Never kill an unknown process.
  - Node is too old: Install Node 22 or newer. Check with `node --version`.
  - The console header says no telemetry: Wait 20 seconds. The shop writes telemetry every few seconds while traffic runs.
  - SDK preflight cannot authenticate: Report the missing API/provider configuration. Use `npm start -- --fast --offline` only as an explicit fallback; it is not model evidence. See `docs/claude-code.md`.

**Example: Open the assistant in the starter.** Example checklist, not a captured Claude session

**Scenario:** You are the developer of the checkout SRE agent. Open your own unfinished copy before you ask Claude to change it.

**Start:** The original clone exists. No checkpoint is being reused or overwritten.

**Stop:** Stop if login fails or the folder is wrong. Do not share account details or credentials in screenshots.

![Open the assistant in the starter](docs/assignment-examples/claude-start.png)

**Example: Check the assistant's understanding.** Example checklist, not a model transcript

**Scenario:** The on-call engineer needs trustworthy evidence, not a confident guess. Check that Claude understands the two repairs before it writes code.

**Start:** Claude Code is open in the unfinished starter. No code edits are permitted yet.

**Stop:** Stop if Claude proposes shop changes, approves its own work or starts editing.

![Check the assistant's understanding](docs/assignment-examples/orientation.png)

**Example: A healthy starting point.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** The shop provides the observations for your AI-SDLC task. Begin without an existing incident.

**Start:** A fresh starter, successful SDK preflight, launcher and traffic running. Expect Active 0 and History 0.

**Stop:** Stop if ports are busy or model preflight fails. Do not kill an unknown process.

![A healthy starting point](docs/assignment-examples/console-start.png)

## Core 1 · Specify a change from evidence

**What you do:** Observe the failing checkout and verify the diagnosis. Turn the missing deployment evidence into an accepted software requirement.

**Why:** The agent needs an observable goal and a boundary before it writes code. An incident diagnosis is input to that decision, not the requirement itself.

**What proves it:** docs/diagnosis-live.md contains checked observations. intent.md states the user, outcome, acceptance checks, boundary, open question and your acceptance decision.

Slides: Specify: start with an observed problem · Create one fault and observe detection · Check the diagnosis against the evidence · Turn the finding into an intent · Accept the assignment before building. Replaces A1 + A2 + A6.

### 1.1 Break the shop once: click `Bad deploy v2.15.0` in the shop. The CLI alternative is `npm run chaos -- deploy v2.15.0 --mode bad-deploy` in a separate shell, never the occupied launcher terminal. Do not use both.

**Before you act:** Telemetry is recorded service data. The listener opens an incident when server metrics cross a fixed limit; no model makes that decision.

- **See:** After about one minute a new incident appears in the console sidebar. You did not open it; the deterministic listener did.
- **Check:** `curl 127.0.0.1:4320/api/incidents` shows one incident with source "alert".
- **Stuck?** No incident after three minutes: look at the lab terminal. Traffic must print requests. Started without `--fast`? Then detection takes five minutes.

**Example: One deliberate fault.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** Customers now see checkout errors after one bad deployment. Wait for the fixed detector to open an incident.

**Start:** The healthy shop was running. Click Bad deploy v2.15.0 once; --fast detection takes about one minute.

**Stop:** Do not inject a second fault or reset an incident while comparing evidence.

![One deliberate fault](docs/assignment-examples/shop-broken.png)

### 1.2 Open the incident. Read the banner at the top, then the diagnosis.

**Before you act:** An evidence reference points to an observation. A data gap means unknown, not proof that nothing happened.

- **See:** The model output may vary. Expect missing deploy evidence, a verified tool trace and explicit data gaps; the starter cannot see the deploy.
- **Check:** Preserve the diagnosis and trace. Verify every cited reference in `demo/data/telemetry.json`, then search that file for `v2.15.0`: there WAS a deploy outside the starter's visible tool result.
- **Stuck?** References are text, not links. Search the file for the timestamp.

**Example: A diagnosis is not permission.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** Read the diagnosis and compare its references with telemetry. The starter deployment tool has a gap.

**Start:** One incident is open. Inspect the actual trace; an empty tool result must remain a gap.

**Stop:** Reject invented references. Do not demand the same proposal as this older reference image.

![A diagnosis is not permission](docs/assignment-examples/console-diagnosis.png)

### 1.3 Challenge the agent in chat: Could this be something other than the deployment?

**Before you act:** Free-text chat is not checked by the structured verdict contract. Verify its claims manually against telemetry and trace; use Investigate for a contract-validated diagnosis.

- **See:** Real output may vary. With the explicit offline fallback, the agent returns a scripted summary; that is not a new model investigation.
- **Check:** Compare the answer with `ruled_out`, the trace and the data gap.
- **Stuck?** If it fabricates a deploy citation or fails the contract, preserve the output and stop; do not call it success or weaken the contract.

**Example: A diagnosis is not permission.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** Read the diagnosis and compare its references with telemetry. The starter deployment tool has a gap.

**Start:** One incident is open. Inspect the actual trace; an empty tool result must remain a gap.

**Stop:** Reject invented references. Do not demand the same proposal as this older reference image.

![A diagnosis is not permission](docs/assignment-examples/console-diagnosis.png)

### 1.4 Save the diagnosis in `docs/diagnosis-live.md`. Then record what you checked: `npm run progress:note -- "Core 1: <what you verified>"`

**Before you act:** A progress note records a check you performed. It is history, not a test result by itself.

- **See:** One new line at the bottom of `PROGRESS.md`.
- **Check:** Your note names the references you checked, not only that you did it.
- **Stuck?** Do not approve. There is nothing safe to execute yet. Core 2 gives the agent its eyes back.

**Example: Find the missing evidence.** Example evidence record; fill in your own observations

**Scenario:** Customers report checkout failures after a bad deployment. The on-call engineer can see errors, but the starter returns no deployment records.

**Start:** Start with a healthy shop and an empty console. Inject one bad deploy at the next step, then inspect that incident.

**Stop:** Stop on fabricated citations or a failed contract. Preserve the output instead of forcing a rollback proposal.

![Find the missing evidence](docs/assignment-examples/evidence.png)

### 1.5 Ask Claude Code: "Read docs/diagnosis-live.md and intent.md. Draft a scoped intent for the missing deployment evidence and human gate. Name observable acceptance checks and an open question. Do not edit code or approve anything. Wait for my review."

**Before you act:** An intent defines the outcome before the implementation. An acceptance check states what another person can observe, not that the agent feels confident.

- **See:** A draft `intent.md` with a user, problem, outcome, constraints and an open question. Checks cover returned deploys, empty data and the named-human gate.
- **Check:** Review every check yourself. Link each to a test or recorded observation. Reject fabricated evidence or a plan to weaken the contract. Record your name and acceptance decision in `intent.md`.
- **Stuck?** Use the existing intent template. Ask Claude to clarify one vague check. Do not proceed to code until you accept the scope.

**Example: Describe the change before the solution.** Example document, not participant evidence

**Scenario:** The empty deployment result blocks a reliable diagnosis. You need a small, testable change that also keeps runtime actions behind human approval.

**Start:** You have compared the trace with telemetry and recorded the missing signal.

**Stop:** Do not build from a vague goal such as make the agent better. Reject invented evidence.

![Describe the change before the solution](docs/assignment-examples/intent.png)

**Example: Accept observable requirements.** Example form; placeholders are not acceptance

**Scenario:** Claude has drafted an intent. You decide whether another person could prove each check, before any implementation begins.

**Start:** The draft intent covers both repairs and cites your checked observation.

**Stop:** If scope or evidence is unclear, request a revision. A model cannot accept its own draft.

![Accept observable requirements](docs/assignment-examples/accept-intent.png)

## Core 2 · Design, build and verify the change

**What you do:** Review a human plan before each repair. Restore the read-only tool and the approval gate, then verify the complete change.

**Why:** A bounded plan limits accidental changes. A failing test, a passing test and a real diff show what the repair changed.

**What proves it:** docs/plan.md records the reviewed plans. Both repairs have a visible diff, the same-incident trace is checked, and the complete checks pass before release review.

Slides: Establish a reviewable starting point · Ask for a small plan, then review it · Understand the tool before repair · Repair the tool: red → green · Check the change on the same incident · Understand the human approval gate · Repair the gate: refuse unsafe actions · Verify the complete change. Replaces A5 + A7 + A8.

### 2.1 Before code edits, follow the human-only baseline commands in `docs/sdlc-git.md`. In the isolated starter, create `workshop-base`, commit only the two exercise cuts, then create `fix/w5-core`.

**Before you act:** The checkpoint has a solved HEAD plus unfinished exercise cuts. Without a baseline commit, restoring the solution could leave an empty code diff.

- **See:** `git branch --show-current` prints `fix/w5-core`. The `workshop-base` commit contains only the A5 and A8 starter cuts.
- **Check:** Inspect `git show --stat workshop-base`. It lists only `src/tools.ts` and `src/executor.ts`. Keep intent and evidence edits outside this baseline commit.
- **Stuck?** Do not overwrite an existing branch or commit someone else's work. Ask the facilitator if either branch name already exists. Claude must not run the baseline commands.

**Example: Keep the unfinished code for comparison.** Illustrative output; commit ids and counts vary

**Scenario:** The checkpoint was cut from solved code. Without a baseline, restoring the solution can leave no useful repair diff.

**Start:** Your intent is accepted. The two starter cuts are still present.

**Stop:** Do not overwrite a branch or include secrets, intent edits or unrelated files in the baseline.

![Keep the unfinished code for comparison](docs/assignment-examples/baseline.png)

### 2.2 Run the red test: `npx tsx --test test/workshop/tools.test.ts`. Ask Claude Code: "Read intent.md, docs/spec.md and the failing test. Propose the smallest change in docs/plan.md. Name files, checks, risks, a rejected alternative and your stop point. Do not edit code. Wait for my review."

**Before you act:** A red test exposes the missing behaviour. The bench checks scripted outcomes across fixed scenarios, not model quality.

- **See:** The test fails: `list_deploys` returns nothing. `npm run bench` fails too: without deploys the agent misses the bad deploy.
- **Check:** Explain the failing assertion. Review the plan against your intent and the existing contract. Record your accepted scope in `docs/plan.md` before implementation.
- **Stuck?** Find the single `TODO(A5)` handler stub in `src/tools.ts`. Restore the read-only handler binding; inspect and preserve the existing MCP registration.

**Example: Review the tool plan before implementation.** Example document, not an approved plan

**Scenario:** The tool test fails because the handler returns no records. Ask for the smallest repair, not a new tool architecture.

**Start:** The intent and baseline exist. You can explain the failing tool assertion.

**Stop:** Reject a plan that weakens tests, changes the contract or adds mutation tools. Review the gate plan separately later.

![Review the tool plan before implementation](docs/assignment-examples/plan.png)

### 2.3 Build the `list_deploys` handler in `src/tools.ts` with Claude Code or by hand. Keep the existing MCP registration intact.

**Before you act:** MCP exposes named tools. The existing registration points to a handler that reads data; restore that binding only after the human reviews the small plan.

- **See:** `test/workshop/tools.test.ts` is green. The A8 valid-approval executor assertion remains red until the gate repair later in Core 2.
- **Check:** After plan review, implement and run `npx tsx --test test/workshop/tools.test.ts`, then `npm run typecheck` and `npm run bench`. The bench prints `PASS bench`; executor tests remain intentionally red until the gate repair later in Core 2. Save the actual commands, results and any untested paths in `docs/verify/sdlc.md`. A8 remains expected red here, so this intermediate state is not yet release-ready.
- **Stuck?** The tool still returns `[]`: inspect the handler binding and the preserved registration; do not add a second registration.

**Example: Prove the deployment tool repair.** Expected result shape, not a recorded test run

**Scenario:** The on-call engineer needs the deployment records that the starter hides. Repair the handler without changing its registration.

**Start:** You have accepted the tool plan. The focused tools test is red.

**Stop:** If the handler still returns [], inspect the binding. Do not weaken the test or count a solved checkpoint as your work.

![Prove the deployment tool repair](docs/assignment-examples/tool-test.png)

### 2.4 Save. In the same incident, ask in chat: `Investigate: customers report checkout errors`

**Before you act:** A trace records the tools used for a diagnosis. Re-investigation lets you compare the same incident before and after the repair.

- **See:** The lab terminal prints a console reload line. Inspect the new diagnosis, its observed trace, deploy references, data gaps and proposal; real model wording and actions can vary.
- **Check:** Verify the actual trace and references against `demo/data/telemetry.json`. If the citation is fabricated or the contract fails, preserve the output and stop. Record what you verified: `npm run progress:note -- "Core 2: ..."`
- **Stuck?** Incident gone? Incident history persists in SQLite, while the shop resets on restart. Do not restart the launcher to reload code; saving auto-reloads the console. For a fresh repeat, use a new disposable checkpoint copy; do not rebreak a stale incident.

**Example: Compare the same incident before and after.** Example evidence record; your trace supplies the values

**Scenario:** A green tool test does not show what the real model used. Investigate the same incident again and inspect the new trace.

**Start:** The tool repair is saved. Keep the shop and traffic running; let the console reload itself.

**Stop:** Preserve fabricated references or contract failures. Do not restart the shop or require a rollback proposal to get a pass.

![Compare the same incident before and after](docs/assignment-examples/same-incident.png)

### 2.5 Run the red test: `npx tsx --test test/workshop/executor.test.ts`. Ask Claude for a fail-closed plan for `checkApproval` in `src/executor.ts`. Review that plan before allowing the `TODO(A8)` repair.

**Before you act:** The approval gate validates a named human decision for this incident and proposal. The starter fails closed until you rebuild it.

- **See:** The test is green. The executor now refuses to act without a named approval for this incident and this proposal.
- **Check:** Run `npx tsx --test test/workshop/executor.test.ts`.
- **Stuck?** Read `test/workshop/executor.test.ts`. It names every case the gate must refuse. Chat refuses your sentence: that is correct for anything that changes the system. Approve, execute and resolve are buttons.

**Example: Keep human permission specific.** Expected result shape, not a recorded test run

**Scenario:** A valid human approval must work, but an approval for another incident or proposal must not. The starter refuses everything.

**Start:** Review the separate gate plan. The valid-approval assertion is red before repair.

**Stop:** A green gate test is not runtime approval. Do not click Approve or Execute during this repair.

![Keep human permission specific](docs/assignment-examples/gate-test.png)

**Example: Mutation requests are refused.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** The question path is read-only. A request to roll back is refused rather than executed.

**Start:** Read the existing boundary; keep runtime approval separate from chat or test results.

**Stop:** Do not rephrase a mutation to bypass the grammar.

![Mutation requests are refused](docs/assignment-examples/console-refusal.png)

### 2.6 Run `npx tsx --test test/workshop/executor.test.ts`, `npm run verify`, `npm run test:workshop` and `npm run test:hooks`.

**Before you act:** Run the complete checks after both repairs so the results cover the full change.

- **See:** All must pass before the code release decision.
- **Check:** Record actual results in `docs/verify/sdlc.md`.
- **Stuck?** If a check fails, preserve its output and do not mark the change ready for release.

**Example: Record checks, not a done label.** Example form; replace each field with actual output

**Scenario:** Both repairs are now present. Check the combined change before a human reviews or publishes it.

**Start:** The focused tool and gate tests pass. No runtime action is authorized by these results.

**Stop:** Keep failing output. Do not mark the change ready or replace model evidence with the scripted bench.

![Record checks, not a done label](docs/assignment-examples/verification.png)

## Core 3 · Review, release and learn from the result

**What you do:** Review the complete code change, prepare its PR and record a human release decision. Observe the local runtime and propose the next improvement.

**Why:** The authoring agent cannot accept its own work. Code release and runtime recovery are different decisions, with different evidence.

**What proves it:** docs/verify/sdlc.md records actual diff review, a human PR and release decision or RELEASE BLOCKED, the runtime result and one reviewed next task.

Slides: Review the actual diff · Prepare the PR and make a release decision · Observe runtime with separate permission · Recovery: confirmed or not confirmed? · Turn the observation into the next task. Replaces A9.

### 3.1 Ask Claude Code: "Review git diff workshop-base against intent.md, docs/plan.md and REVIEW.md. Identify functional defects, missing checks and unsupported claims. Cite files and lines. Do not edit, approve, commit, push or merge. Wait for my decision."

**Before you act:** First run git status --short. Untracked files are absent from the diff: inspect them and stage only intended files by exact path yourself before requesting review. Never stage secrets. Review checks whether the change meets the intent, not whether its explanation sounds convincing. Passing tests do not approve a change.

- **See:** A list of findings, or an explicit no-findings result. The human has inspected the diff and evidence rather than accepting the model's conclusion.
- **Check:** Verify every finding yourself. Request fixes and rerun affected checks when needed. Record your name, decision, residual risks and untested paths in `docs/verify/sdlc.md`.
- **Stuck?** When working solo, review your own diff in a separate pass and record that limitation. If repository policy requires another reviewer, wait for one.

**Example: Judge the code against the intent.** Example review record, not an actual approval

**Scenario:** Tests pass, but the change might still exceed the plan. Review the actual diff and verify Claude's findings yourself.

**Start:** Both repairs and required checks are complete. Inspect untracked files before reviewing the diff.

**Stop:** An empty repair diff is not proof. Resolve findings and rerun affected checks before release.

![Judge the code against the intent](docs/assignment-examples/diff-review.png)

### 3.2 Prepare the PR text with Claude Code, then follow `docs/sdlc-git.md` in your own terminal. A human commits, signs the Git gate, pushes to the learner repo and opens a PR from `fix/w5-core` into `workshop-base`.

**Before you act:** A Git approval authorizes publication of a code change. It does not approve a shop rollback. Never push the training baseline to the upstream project.

- **See:** A PR with a meaningful repair diff, accepted intent, actual checks and known limitations. If remote access or a required reviewer is missing, the record says `RELEASE BLOCKED`.
- **Check:** A human checks the current head, CI and required review before merging. Record the PR and merge commit, or the exact blocker. A local reload is a development check, not a production deployment.
- **Stuck?** No publication access: prepare the PR text and document the blocker. You may continue local runtime observation as a test, but must not claim a release or bypass branch protection.

**Example: Publish only with the required checks.** Example blocked outcome, not a real PR or merge

**Scenario:** You have a reviewed change. A missing reviewer or repository permission is a release blocker, not permission to bypass the gate.

**Start:** The human has reviewed the diff and current evidence. Claude may prepare PR text, not publish it.

**Stop:** Do not push to the upstream training repo or bypass required review. A local reload is not a production release.

![Publish only with the required checks](docs/assignment-examples/release.png)

### 3.3 After code review, inspect the current incident and its actual proposal. Only if the evidence supports an allowed action, a named human clicks Approve and then the separate Execute control. Otherwise record the safe stop.

**Before you act:** Rollback restores the prior deployment. Recovery checks capture measured values against a frozen limit; execution success alone is insufficient.

- **See:** For an executed rollback, the banner asks you to wait for all recovery checks. About two minutes later, inspect LANDED or NOT LANDED. A model response is not guaranteed to propose rollback.
- **Check:** The half check may fail. The full and double checks must both pass. On NOT LANDED the banner names the failed check, its value and the limit.
- **Stuck?** A button is grey: the banner says which step is allowed now. The server refuses every other button.

**Example: Approval and execution are separate.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** A human reviews the actual allowed proposal. Named approval does not itself execute the action.

**Start:** Code has been reviewed. Evidence supports this proposal for this incident. A human makes each decision.

**Stop:** If data is missing or the proposal is unsupported, stop instead of approving for the sake of the exercise.

![Approval and execution are separate](docs/assignment-examples/console-approval.png)

### 3.4 LANDED: click Mark mitigated, then Resolve with notes. NOT LANDED: do not close. Read the failed check, then investigate in chat or escalate.

**Before you act:** LANDED means the full and double checks passed. Mitigated and resolved are separate human decisions. NOT LANDED or unknown means stop.

- **See:** After you resolve, the next-step detail says Resolved and directs you to the notes and lesson. Execute stays disabled.
- **Check:** If resolved, `lessons/lessons.md` has your name and the incident id. If NOT LANDED, confirm the incident remains open and retain the failed check. Record your actual outcome: `npm run progress:note -- "Core 3: …"`
- **Stuck?** Never execute again to get a green result. NOT LANDED is a correct, safe stop.

**Example: Recovery not confirmed.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** An execution can finish without sufficient recovery evidence. Keep the failed measurements.

**Start:** One separately approved execution has completed. Read all half/full/double checks.

**Stop:** NOT LANDED or unknown: keep the incident open. No retry just to obtain a green result.

![Recovery not confirmed](docs/assignment-examples/console-not-landed.png)

**Example: Recovery confirmed in a different run.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** Passing recovery checks allow a human closure decision; the system does not close itself.

**Start:** This retained image is a different earlier run. All its checks passed; do not copy that outcome into your run.

**Stop:** If any of your checks fail or are unknown, use the NOT LANDED branch instead.

![Recovery confirmed in a different run](docs/assignment-examples/console-landed.png)

**Example: Human closure persists.** Observed local UI, captured 2026-10-21 with explicit offline scripted runtime. This is a screen reference, not real-model evidence. Your ids, timings and model wording differ.

**Scenario:** A human recorded mitigation and resolution notes after valid recovery. The incident remains resolved on reload.

**Start:** Only follow this branch if your own recovery checks pass and a human decides to close.

**Stop:** Do not close merely because the shop looks healthy. Do not copy names, approvals or outcomes from the screenshot.

![Human closure persists](docs/assignment-examples/console-resolved.png)

### 3.5 Ask Claude Code: "Read the actual observations in docs/verify/sdlc.md. Propose one next change and the acceptance check or regression test that would prove it. Distinguish observed facts from hypotheses. Do not edit code or close the incident. Wait for my review."

**Before you act:** Maintenance feeds the next planning cycle. A closed incident or a model-generated lesson is not automatically a reviewed software improvement.

- **See:** One proposed next task grounded in a trace, failed check, review finding or missing observation. It includes an acceptance check.
- **Check:** Review the proposal yourself. Record the task, evidence and your decision in `docs/verify/sdlc.md`. Keep an unresolved incident open. Record progress with `npm run progress:note -- "SDLC: recorded actual evidence, release decision and next task"`.
- **Stuck?** If the model or recovery was blocked, use that observed limitation. Do not invent a successful run. Implementing this next task is optional; proposing and reviewing it is required.

**Example: Use the actual result for the next task.** Conditional example; use only if you observed this gap

**Scenario:** Recovery may fail even after a successful execution. Use the failed measurement or another observed limit to propose one next change.

**Start:** The runtime outcome or blocker is recorded. Keep an unresolved incident open.

**Stop:** Do not invent successful recovery or implement the next task without a new accepted scope.

![Use the actual result for the next task](docs/assignment-examples/next-task.png)

## Go deeper (optional)

| # | Task | Do |
| --- | --- | --- |
| A3 | Read the contract | Write `docs/spec.md` for the evidence rules in `src/contract.ts`. Run `npx tsx --test test/contract.test.ts` and break one rule on purpose. |
| A4 | Add your own guard rule | Add one deny rule of your own to `.claude/hooks/guard.mjs` BY HAND (the agent may not edit hooks). Prove it with a deny line in `approvals/audit.jsonl`. Write `docs/decisions/D01-*.md`. |
| A7 | Add a bench case | Add one case to `bench/cases.json`, run `npm run bench`. Ask the agent to lower `bench/ratchet.json` and watch the guard deny it. |
| A9b | Your hackathon intent.md | Write `docs/hackathon-intent.md` for the agent you build next. Hand off with the `/handoff` skill. |

## Behind? Catch up without losing your work

Run `npm run checkpoint -- core-2` or `npm run checkpoint -- core-3` from the ORIGINAL, unchanged clone root, not from a modified starter. Each creates a separate current-HEAD worktree and refuses overwrite. Core 2 is an intermediate tool-solved, gate-unfinished catch-up point; Core 3 is the solved reference. Neither proves you authored, tested or reviewed a change. Compare files yourself. Never copy runtime data, approvals, progress or lesson history.

| Checkpoint | Contains |
| --- | --- |
| `start` | The committed-HEAD starter has the A5 tool exercise and a fail-closed A8 approval gate. |
| `core-2` | Core 2 is an intermediate catch-up point: the read-only tool is solved, but the A8 approval gate remains cut. This checkpoint does not prove participant-authored work. |
| `core-3` | Core 3 is the solved reference with no exercise cuts. This checkpoint does not prove participant-authored work. |

## Where everything is

- **Participant:** [Participant card](CARD.md) · [Console](http://127.0.0.1:4320) · [Course (concepts, self-paced)](course/index.html) · [Working alone](SOLO.md) · [Claude Code and SDK setup](https://github.com/RyanLisse/sre-oncall-agent/blob/main/docs/claude-code.md) · [Human Git release steps](docs/sdlc-git.md) · [Assignment scenarios and examples](docs/assignment-examples.md) · [WSL and PowerShell](docs/platforms.md)
- **Facilitator:** [Facilitator run sheet](FACILITATOR.md) · [Workshop guide](WORKSHOP.md) · [Slides (separate repo)](https://github.com/RyanLisse/aetherlink-classroom-slides/blob/main/workshop5.html)
- **Agent:** [Agent rules](CLAUDE.md) · [Contract](docs/spec.md) · [Bench cases](bench/cases.json) · [Review checklist](REVIEW.md)
