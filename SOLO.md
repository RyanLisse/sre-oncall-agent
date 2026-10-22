# Tutorial: build an AI SRE first responder

For the shorter classroom route, use [WORKSHOP.md](WORKSHOP.md) and
[PARTICIPANT.md](PARTICIPANT.md). This recommended self-paced route teaches
the required AI software delivery lifecycle. Claude Code is the development
assistant; the runtime SRE agent is the application being changed. The
numbered steps below remain an optional offline reference for mirror
consumers. Their content is retained for compatibility.

Use [docs/claude-code.md](docs/claude-code.md) for official Claude Code
installation and separate Agent SDK setup. The Agent SDK defaults to `sonnet`;
`npm run model:check` must pass before a real-model fault injection. Offline
is an explicit scripted fallback, not model evidence. For canonical actions,
prompts and proof, follow [CARD.md](CARD.md).

## Recommended self-paced route

### Start — Claude Code before theory or edits

- **Task:** Create a disposable starter and begin with the coding assistant.
- **Why:** AI-assisted delivery starts by agreeing on the problem, evidence
  and human boundaries, not by prompting directly for code.
- **Action:** In terminal 1, clone the repository, create the starter
  checkpoint, enter it and run `claude`. Submit the read-only prompt in
  [CARD.md](CARD.md) before theory or edits. In terminal 2, from the original
  clone root, configure SDK access as described in the setup guide, then enter
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

### Core 2 — review the design, then repair and prove the tool

- **Task:** Create a human-owned starter baseline, review `docs/plan.md`
  against accepted intent, then repair the read-only `list_deploys` handler
  while preserving its MCP registration.
- **Why:** A meaningful diff makes the repair reviewable. The failing test
  exposes missing behavior; the plan constrains the change before code edits.
- **Action:** Follow the baseline steps in
  [docs/sdlc-git.md](docs/sdlc-git.md) in the isolated starter. Run the red
  `npx tsx --test test/workshop/tools.test.ts`; ask Claude Code for a small
  plan and wait for human review. Then implement and run the focused tool test,
  `npm run typecheck` and `npm run bench`. Re-investigate the same incident
  with the Investigate action from the card. Record actual checks and trace
  in `docs/verify/sdlc.md`, then record them with
  `npm run progress:note -- "Core 2: recorded actual tests, bench and trace"`.
- **Proof:** The plan is accepted before edits; the code diff is nonempty;
  tests, typecheck and bench pass; the actual trace shows the tools called.
  The A8 gate remains intentionally red until Core 3. Preserve failed
  contracts or citations rather than calling them success.

### Core 3 — review, release and learn

- **Task:** Review a fail-closed `checkApproval` plan, repair the human gate,
  run full checks, inspect the actual diff and make a human release decision.
  Observe runtime evidence and propose one reviewed next task.
- **Why:** Passing tests do not accept or publish a change; runtime recovery is
  separate from code release.
- **Action:** Follow the Core 3 prompts and checks in [CARD.md](CARD.md).
  Run the focused executor test, `npm run verify`,
  `npm run test:workshop` and `npm run test:hooks`; record results. Review
  `git diff workshop-base` against `intent.md`, `docs/plan.md` and `REVIEW.md`.
  A human prepares the learner-repo PR and checks current-head CI and required
  review before deciding to merge. If access or a reviewer is missing, record
  `RELEASE BLOCKED` and the reason. Then record the actual runtime model,
  trace, recovery result and one reviewed next task in `docs/verify/sdlc.md`.
  Record the actual result with
  `npm run progress:note -- "Core 3: recorded release decision, runtime result and next task"`.
- **Proof:** Full checks and actual diff findings are recorded. A human has
  made a release decision or documented the exact blocker. Runtime results
  are observed, not inferred from a local reload. `NOT LANDED` or unknown
  recovery is a safe stop; keep the incident open.

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
checkpoint. A solved copy helps catch up; it does not prove authored work.

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
