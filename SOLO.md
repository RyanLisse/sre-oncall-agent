# Tutorial: build an AI SRE first responder

You can do this path alone. Each step has four parts: **Explain**, **See it**,
**Do**, **Check**. Everything runs offline. A real model run is optional and
needs your own API key.

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

**Explain:** The project is a TypeScript agent on the Claude Agent SDK with
three read-only tools and a scripted offline runtime.

**Do:**

```text
npm install
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
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run
```

**Check:** The trace lists the three tools in order. The diagnosis has six
lines: What's happening / Root cause / Blast radius / Proposed fix / Ruled
out / Would change my mind. Proposal is `rollback`, severity is `page`. The
last line says a human decides.

Now run the other three scenarios. Predict the proposal before each run:

```text
npm run investigate -- fixtures/incidents/slow-dependency.json --dry-run
npm run investigate -- fixtures/incidents/noisy-alert.json --dry-run
npm run investigate -- fixtures/incidents/mystery-errors.json --dry-run
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
npm run investigate -- fixtures/incidents/adversarial.json --dry-run
```

Then try the loop budget:

```text
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --max-turns 2
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
npm run investigate -- fixtures/incidents/bad-deploy.json
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
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run
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

## Step 7 — Optional: a real model

**Do:**

```text
export ANTHROPIC_API_KEY=sk-ant-...
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run --model sonnet
```

**Check:** The trace shows real tool calls through the in-process MCP server.
The verdict passes the same contract. Compare its `ruled_out` and
`would_change_my_mind` with the offline run — that is where a model adds
judgment the script cannot.

---

## Step 8 — Break a live shop

**Explain:** Fixtures replay the past. The demo shop is a running service you
can break *now*. It writes its own telemetry in the shape the agent reads —
the agent never talks to the shop, exactly as it would read Grafana rather
than your service.

**Do:**

```text
npm run doctor
npm run demo
```

Watch the seven steps: baseline → fault → diagnosis → executor refused
(pending) → you approve → executor rolls back and collects three fresh
checkouts → watch says LANDED.

Now the two cases where rollback is wrong:

```text
npm run demo -- slow degrade
npm run demo -- errors degrade
```

**Check:** With no deploy record the agent proposes `scale` and
`investigate-more`, and the executor refuses both — it only implements
rollback, and a human takes those actions by hand.

Finally the deployment watch:

```text
npm run demo:watch
```

**Check:** The watch records the serving revision, waits for the next one,
then probes `/checkout` every 1.5 s. When the injected bad deploy trips the
fixed policy it prints `FAILED watch`, writes an incident file, and says
*No automatic rollback.* Try `npm run watch-deploy -- "Watch the next
deployment for five minutes. If it fails, roll back automatically."` — the
extra sentence is rejected.

---

## What you built

An agent with a fixed division of labour: it searches, cites, proposes and
verifies. You decide, you act, you close. The three things that keep it
honest are code, not prompts: the evidence rules in `contract.ts`, the trace
check in `agent.ts`, and the ratchet in `bench.ts`.
