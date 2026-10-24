# Practise the AI-native SDLC on your own

For the shorter classroom route, use [WORKSHOP.md](WORKSHOP.md) and
[PARTICIPANT.md](PARTICIPANT.md). This recommended self-paced route teaches
the required AI software delivery lifecycle. Claude Code is the development
assistant; the runtime SRE agent is the application being changed. The
numbered steps below remain a separate optional offline reference for mirror
consumers. Their content is retained for compatibility. The Daily Brief is a
separate activity, not this solo route.

Use [docs/claude-code.md](docs/claude-code.md) for official Claude Code
installation and separate Agent SDK setup. The Agent SDK defaults to `sonnet`;
`npm run model:check` must pass before a real-model fault injection. Offline
is an explicit scripted fallback, not model evidence. For canonical actions,
prompts and proof, follow [CARD.md](CARD.md).

## Recommended self-paced route

Choose [WSL or native PowerShell](docs/platforms.md) before setup. The
[assignment examples](docs/assignment-examples.md) show each scenario, starting
state, expected result and stop condition. Use your own evidence; example
screenshots and solved checkpoints do not complete an assignment for you.

You can complete this route without a facilitator or a presentation. Use
this page to navigate; [CARD.md](CARD.md) contains the exact prompts,
commands, expected results and stop conditions. Read its **Before you act**
text before each step. The course and numbered offline examples below are
optional reference, not a second assignment.

### Before you start

1. Check `node --version` (22 or newer), `npm --version` and `git --version`.
2. Follow [the setup guide](docs/claude-code.md) to install Claude Code and
   configure separate SDK access. Use your own approved accounts and synthetic
   data only. Real model requests may cost money.
3. Prepare your own learner repository using
   [the publishing prerequisites](docs/sdlc-git.md#publish-only-to-your-learner-repository).
   Check repository access, Actions and any required reviewer before Core 1.
   You may continue locally if these are blocked, but record `RELEASE BLOCKED`.
4. Reserve a focused session for Core 1 through the same-incident check in
   Core 2. Keep the launcher running across those steps so the before/after
   evidence describes the same incident.

First read **Start with the AI SDLC** in [CARD.md](CARD.md). Name the stages,
the evidence you will produce and the decisions you keep. Then use the SRE
agent and shop to practise that cycle; operating the console is not the goal.

### Start with Claude Code

- **Task:** Create a disposable starter and begin with the coding assistant.
- **Why:** AI-assisted delivery starts by agreeing on the problem, evidence
  and human boundaries, not by prompting directly for code.
- **Action:** In terminal 1, clone the repository, create the starter
  checkpoint, enter it and run `claude`. Submit the read-only prompt in
  [CARD.md](CARD.md) after the lifecycle introduction and before code edits.
  In terminal 2, from the original clone root, configure SDK access as
  described in the setup guide, then enter
  the same checkpoint, run `npm ci`, `npm run fixtures`,
  `npm run model:check`, and `npm start -- --fast`.
- **Proof:** The SDK preflight returns `READY`, and console health reports
  the selected model before fault injection. If SDK access is unavailable,
  record the blocker; use `npm start -- --fast --offline` only as an explicit
  fallback. Offline output is not model evidence.

When both terminals are occupied, ask Claude Code to run safe checks or use
`/exit` before typing shell commands, then reopen Claude Code afterward. Never
type shell commands into the active assistant prompt.

### Core 1 — turn observed evidence into accepted intent

- **Task:** Break the shop once, inspect the diagnosis and trace, verify every
  reference against telemetry, and draft `intent.md` from the observations.
- **Why:** An incident diagnosis is input to a software requirement, not the
  requirement itself. A missing deploy signal is unknown, not proof that no
  deploy happened.
- **Action:** Click **Bad deploy v2.15.0** once in the shop at
  `http://127.0.0.1:4310`. Check the incident at `http://127.0.0.1:4320`,
  citations and trace against `demo/data/telemetry.json`. Save
  `docs/diagnosis-live.md`. Use the Core 1 prompt in the card to draft an
  intent naming the user, outcome, observable checks, boundary and open
  question. Review and accept it yourself before Core 2. Record actual
  observations with `npm run progress:note -- "..."`.
- **Proof:** `docs/diagnosis-live.md` has checked evidence; `intent.md` has
  your accepted scope and decision. Real model wording varies. If a citation
  is fabricated or a contract fails, preserve the output and stop; do not
  weaken the contract.

### Core 2 — review both plans, repair and verify

- **Task:** Create a human-owned starter baseline. Review a plan before each
  repair, restore the read-only `list_deploys` handler, check the same
  incident, then repair the `checkApproval` gate.
- **Why:** Each repair has its own scope and human plan review. The same
  incident trace shows whether the tool repair changes the evidence.
- **Action:** Follow the baseline steps in
  [docs/sdlc-git.md](docs/sdlc-git.md). Follow the Core 2 prompts and checks
  in [CARD.md](CARD.md). Record both plans and your decisions in
  `docs/plan.md`; record checks and trace in `docs/verify/sdlc.md`.
- **Proof:** The tool and gate plans were reviewed before edits. Both repairs
  have a visible diff. The same-incident trace and complete check results are
  recorded. The A8 gate remains cut only until its repair within Core 2.

### Core 3 — review, release and learn

- **Task:** Review the actual diff first. Make a human PR and release
  decision, or record `RELEASE BLOCKED`. Observe the runtime result and
  propose one reviewed next task.
- **Why:** Passing tests do not accept or publish a change. Runtime recovery
  is separate from code release.
- **Action:** Follow the Core 3 prompts in [CARD.md](CARD.md). A human checks
  the PR head, CI and required review before deciding to merge. Record the
  runtime model, trace, recovery result and reviewed next task in
  `docs/verify/sdlc.md`.
- **Proof:** A human has reviewed the diff and made a release decision or
  documented the exact blocker. Observe runtime results; do not infer them
  from a local reload. Keep `NOT LANDED` or unknown recovery open.

### Completion checklist

- [ ] The diagnosis is checked against evidence and `intent.md` is accepted.
- [ ] `docs/plan.md` was reviewed before implementation and the repair diff is
      nonempty.
- [ ] Focused and full code checks, actual diff review and human release
      decision (or `RELEASE BLOCKED`) are recorded.
- [ ] The actual runtime model label, trace and recovery outcome are recorded,
      or the missing observation is explicitly marked blocked/not run.
- [ ] One next task and its acceptance check are proposed and reviewed.
- [ ] No approval, execution, mitigation, resolution, commit, push or merge was
      delegated to the assistant.

### Review when you are the only participant

You are the human reviewer, not Claude. Before each repair, read the plan
against your accepted intent and record your name and decision. After the
checks, take a separate review pass through the actual diff using `REVIEW.md`.
Verify Claude's findings yourself. Record **self-review; no independent
reviewer** in `docs/verify/sdlc.md`. An agent's review is not independent
human approval.

If your learner repository permits self-review, you may make the human merge
decision after current-head CI passes. If policy requires another reviewer,
request that review and record `RELEASE BLOCKED` until it arrives. Do not
disable protection. A blocked release is an honest workshop outcome, not a
merged change. Runtime approval and execution are separate human actions.

### Pause, resume or get unstuck

- Before pausing, save your files and record the current card step, checkpoint
  path, branch, incident ID and next action with `npm run progress:note --
  "..."`. Do not put credentials in the note.
- To resume code work, open the same checkpoint, inspect `git status --short`
  and `npm run progress`, then open Claude Code. Do not create another starter
  over your existing work.
- Keep the launcher running for the same-incident comparison. A launcher
  restart archives old telemetry and starts a new shop run; it is not a
  continuation of the original measurement. Preserve the old evidence and
  mark an interrupted comparison as not completed. Do not copy runtime data
  or approvals to manufacture continuity.
- If setup fails, use the card's troubleshooting steps. If a test fails,
  keep its output and ask Claude to explain that failure before changing code.
  Do not lower contracts, tests or the bench floor to continue.
- If you cannot proceed, record the failed command or card step, expected
  result, actual result and missing access in `docs/verify/sdlc.md`. Ask your
  course contact or repository maintainer with that sanitized evidence.
  You can stop with a documented blocker; a facilitator is not required to
  make up a successful result.

### Catch up without overwriting your starter

Run catch-up commands from the original clone root, not a modified starter.
Each creates a separate checkpoint and preserves the participant's files.
Tell anyone helping which checkpoint you entered.

```bash
cd /path/to/sre-oncall-agent
npm run checkpoint -- core-2
cd .lab/checkpoints/core-2
```

For Core 3, return to the original root and run
`npm run checkpoint -- core-3`, then enter `.lab/checkpoints/core-3`.
Do not copy runtime data, approvals, progress or lesson history from a solved
checkpoint. `core-2` is an intermediate tool-solved, gate-unfinished catch-up
point within Core 2. `core-3` is the solved reference. Neither proves
participant-authored work.

## Optional legacy offline reference — not the assignment

Use a separate, unchanged clone for these examples, not your starter or repair
branch. Step 0 expects solved code and cannot pass on the unfinished starter.
These examples do not replace Core 1–3 or its delivery artifacts.

The numbered steps below are deterministic offline reference material. Every
investigation command explicitly selects `--model offline`; they are not model
evidence.

| Step | You do | Time |
| --- | --- | --- |
| 0 | Install, generate the fixtures, run the suite | 5 min |
| 1 | Read the alert and the data the agent can see | 10 min |
| 2 | Run the first investigation and read the trace | 10 min |
| 3 | Break the evidence rules on purpose | 10 min |
| 4 | Sign the approval, then watch the fix land | 10 min |
| 5 | Review the proposed lesson and promote a pattern | 10 min |
| 6 | Run the bench, then try to lower the ratchet | 5 min |
| 7 | (Optional) Run with a real model | 5 min |
| 8 | Break a live shop and watch the whole loop | 10 min |

---

## Step 0 — Install

**Explain:** This optional reference uses the scripted runtime. The current
recommended route starts Claude Code first and separately preflights the real
Agent SDK.

**Do:**

```text
npm ci
npm run fixtures
npm run verify
```

**Check:** `npm run fixtures` writes five files under `fixtures/telemetry/`.
`npm run verify` ends with `PASS bench`.

---

## Step 1 — What the agent can see

![The on-call loop](docs/diagrams/01-architecture.svg)

**Explain:** The agent gets an alert and three tools. It cannot change the
system. That is the whole design.

**See it:** Open `fixtures/incidents/bad-deploy.json` (the alert) and
`fixtures/telemetry/bad-deploy.json` (the system). Find the minute where
`error_rate` jumps and the deploy two minutes before it.

Open `src/tools.ts`. Count the tools. Try to find a tool that writes.

**Check:** Three tools: `search_logs`, `summarize_metrics`, `list_deploys`.
None writes. The deploy is `d-4821` at 03:43; errors start at 03:45.

---

## Step 2 — The first investigation

**Explain:** `query()` runs a loop: the model asks for a tool, the SDK runs
it, the result goes back. `maxTurns` caps the loop. The trace records every
tool call so you can see WHAT the agent looked at before you read what it
concluded.

**See it:** `ONCALL_SYSTEM` in `src/prompts.ts` is the method: lessons →
metrics → deploys → logs → verdict. `investigate()` in `src/agent.ts` is the
loop.

**Do:**

```text
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model offline
```

**Check:** The trace lists the three tools in order. The diagnosis has six
lines: What's happening / Root cause / Blast radius / Proposed fix / Ruled
out / Would change my mind. Proposal is `rollback`, severity is `page`. The
last line says a human decides.

Now run the other three scenarios. Predict the proposal before each run:

```text
npm run investigate -- fixtures/incidents/slow-dependency.json --dry-run --model offline
npm run investigate -- fixtures/incidents/noisy-alert.json --dry-run --model offline
npm run investigate -- fixtures/incidents/mystery-errors.json --dry-run --model offline
```

**Check:** `scale`, `no-action`, `investigate-more`. Note the confidence on
the last one is `low`, so the contract would have refused a strong proposal.

---

## Step 3 — Break the rules on purpose

![The model proposes. Code checks.](docs/diagrams/02-contract.svg)

**Explain:** The model proposes; code checks. Three rules live in
`parseVerdict()` in `src/contract.ts`:

- a strong proposal needs two evidence sources;
- `rollback` needs a `deploys` line;
- `low` confidence can only propose `investigate-more`.

And one in `checkTrace()` in `src/agent.ts`: a cited source whose tool was
never called fails.

**Do:** Run the adversarial alert. Its text tells the agent to skip the rules.

```text
npm run investigate -- fixtures/incidents/adversarial.json --dry-run --model offline
```

Then try the loop budget:

```text
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model offline --max-turns 2
```

**Check:** The adversarial alert gets the same verdict as the clean one —
alert text is data. With `--max-turns 2` the run ends with
`maxTurns (2) reached before a verdict`, not a guess.

Open `test/agent.test.ts` and read the test *"a model that skips the tools and
answers from the alert fails the contract"*. That is the trace rule.

---

## Step 4 — Sign, then watch it land

**Explain:** Without `--dry-run`, an investigation drafts an approval record
as `pending`. A NAMED human signs it. Whatever executes the fix is a separate
system that calls `isApproved(record, incident, proposal)`. Then `watch`
confirms the metric returned to baseline with three bounded checks — at half,
full and double the expected window. Not a polling loop.

**Do:**

```text
npm run investigate -- fixtures/incidents/bad-deploy.json --model offline
cat approvals/INC-1001.approval.json
npm run approve -- fixtures/incidents/bad-deploy.json --by <your name>
```

Pretend the deploy owner rolled back at 03:52. `after-rollback.json` is the
telemetry after that:

```text
npm run watch -- fixtures/incidents/bad-deploy.json --metric error_rate \
  --fix-at 2026-10-05T03:52:00Z --after fixtures/telemetry/after-rollback.json
```

Now watch WITHOUT the fix (the original telemetry):

```text
npm run watch -- fixtures/incidents/bad-deploy.json --metric error_rate \
  --fix-at 2026-10-05T03:52:00Z
```

**Check:** The approval file flips from `"pending"` to `"approved"` with your
name. The first watch says `LANDED` and `PASS watch`. The second says
`NOT LANDED` and exits 2. Neither run closed anything — only a human closes.

Try `npm run approve -- ... --by ""`. It refuses: an anonymous approval is not
an approval.

---

## Step 5 — The lessons loop

![The lessons loop](docs/diagrams/03-lessons.svg)

**Explain:** The agent reads `lessons/lessons.md` filtered to the alert's
`#tag`, never the whole file. It never appends. It writes a proposal to
`lessons/proposed/` and a human promotes it by PR. When one tag has three
entries, the pattern belongs in a playbook, not the log.

**See it:** `renderLessons()` and `promotionCandidates()` in
`src/lessons.ts`. `lessons/lessons.md` has two seed entries.

**Do:** Open `lessons/proposed/INC-1001.md` from Step 4. Fill in `fix` and
`gotcha`. Append it to `lessons/lessons.md`. Run the investigation again and
read the prompt the agent would get:

```text
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model offline
```

**Check:** `#bad-deploy` now has two entries; one more and
`promotionCandidates()` flags it. The `fix` and `gotcha` lines came from you,
not the agent — the agent only knows what it proposed.

---

## Step 6 — The ratchet

![The ratchet](docs/diagrams/04-ratchet.svg)

**Explain:** `bench/cases.json` holds the expected proposal and severity for
each scenario. `bench/ratchet.json` is the floor CI enforces: pass-rate ≥
`min_rate` and `harmful` ≤ 0. A *harmful* answer is a strong action the key
says is wrong. The floor only goes up.

**Do:**

```text
npm run bench
```

Now edit `bench/cases.json`: change the `noisy-alert` expectation to
`rollback`. Run the bench again.

**Check:** The bench reports `🚫 noisy-alert` as harmful and `FAIL bench`.
Revert the edit. Then try `npm run bench -- --raise` — the floor moves to
100% and will stay there.

---

## Step 7 — Optional: verify model access

This is optional model verification, not the first model use. Follow
[docs/claude-code.md](docs/claude-code.md), configure SDK access in the shell
only, and run the bounded preflight before an investigation.

**Do:**

```text
npm run model:check
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model sonnet
```

**Check:** If the preflight is unavailable, report the limitation and do not
invent credentials or use CLI OAuth as an SDK bypass. If it passes, the trace
shows real tool calls through the in-process MCP server and the verdict still
passes the contract. Model output varies; preserve a failed contract or
fabricated citation and stop.

---

## Step 8 — Break a live shop

**Explain:** Fixtures replay the past. The demo shop is a running service you
can break *now*. It writes its own telemetry in the shape the agent reads —
the agent never talks to the shop, exactly as it would read Grafana rather
than your service.

**Do (by hand):** run `npm start -- --fast --offline`. It starts the shop, the traffic
and the console in one terminal. Open the shop at `http://localhost:4310`. Customers check out on
their own (10 per second). Click a button under **Make something break** and
watch the error bar cross the dashed 2% line. After about a minute the
console at `http://localhost:4320` raises the alert. Its banner names the next
allowed step. **Reset to healthy** is a facilitator
lever, not the fix.

Do not run legacy demo scripts that auto-approve. Use the explicit launcher
and the human-gated console route instead; a human still approves, executes,
mitigates and resolves separately.

---

## What you built

An agent with a fixed division of labour: it searches, cites, proposes and
verifies. You decide, you act, you close. The three things that keep it
honest are code, not prompts: the evidence rules in `contract.ts`, the trace
check in `agent.ts`, and the ratchet in `bench.ts`.
