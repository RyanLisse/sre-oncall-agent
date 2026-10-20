# Facilitator run sheet — Workshop 5 (one day, starts 10:00)

The day: nine assignments A1–A9 on `workshop/start`. Solved states live on
tags `w5-step-0-setup` … `w5-step-8-maintain`. Participants catch up with
`git checkout w5-step-N -- <files>` (exact file lists in WORKSHOP.md).
Assignment titles below match the slide deck.

## Time boxes

| time | block | expected output at a glance |
|---|---|---|
| 10:00–10:50 | intro: AI-native SDLC loop + repo tour | participants can name the 7 phases |
| 10:50–11:00 | A1 Setup check | `npm test` green; `npm run test:workshop` red; console on :4320 |
| 11:00–11:15 | break | — |
| 11:28–11:43 | A2 Write your team intent.md | `intent.md` filled — boundary + 3 verifiable checks |
| 11:47–12:00 | A3 Spec + contract green (finish after lunch) | `test/workshop/contract.test.ts` going red→green; `docs/spec.md` filled |
| 12:00–13:00 | lunch | — |
| 13:30–13:50 | A4 Wire and prove the controls | chat refuses "roll back now"; audit.jsonl has denies; `guard.test.ts` green |
| 13:50–14:05 | A5 Build a read-only tool | `list_deploys` in the console investigation trace |
| 14:10–14:40 | A6 Diagnose a live incident | `docs/diagnosis-live.md`; a challenged chat answer with refs |
| 14:40–14:55 | break | — |
| 15:04–15:15 | A7 Pass the bench. Add a case. | `PASS bench`; a new case in cases.json; agent edit of ratchet.json denied |
| 15:23–15:30 | A8 The gate: approve with your name | LANDED in console; `executor.test.ts` green |
| 15:42–15:50 | A9 Maintain + your hackathon intent.md | new lessons.md entry; hackathon intent; `/handoff` → HANDOFF.md |

The gaps between boxes (11:15–11:28, 11:43–11:47, 13:00–13:30, 14:05–14:10,
14:55–15:04, 15:15–15:23, 15:30–15:42) are the deck's talk/demo segments.

A8's **optional second half** is the git gate: a participant pushes
`fix/<name>` (denied by the guard hook), their neighbour runs
`npm run approve:git -- <name> fix/<name> "<reason>"` in their own terminal.
Skip it if the afternoon runs long — the runtime gate is the core lesson.

## Top failure + fix per block

- **A1** — tests red in `npm test`: wrong branch. `git checkout workshop/start`, `npm ci`. (Exercise tests live in `test/workshop/` — `npm test` is green by design.)
- **A2** — intent reads like a wish list: demand the three *verifiable* checks, each runnable by a stranger.
- **A3** — `npm test` shows 5 failures or the dry run prints `FAIL contract`: `customer_impact` is in `src/contract.ts` but not yet in the offline verdicts in `src/runtime.ts` or the fixtures in `test/contract.test.ts`.
- **A3** — "green" but the console broke: they dropped a required field. The console renders the same schema; `npm run typecheck` catches it first.
- **A4** — participant tries to make the agent edit the hook: that IS the lesson (denied by design; hooks are human-edited). If `approvals/audit.jsonl` is missing: the hook only logs on tool calls — run one.
- **A5** — tool returns `[]`: they bound the handler but did not register `tool("list_deploys", ...)`; or registered but the handler is the stub. Both halves are in `src/tools.ts`.
- **A6** — no incident appears: traffic isn't running. `npm run traffic` must be up before chaos; the listener opens an incident only after the error rate stays above 2% for ~5 minutes (start the console with `AGENT_LISTEN_WINDOW_MIN=1` for a faster demo). Check `curl localhost:4320/api/incidents`.
- **A7** — lowered ratchet "worked": expected. By hand, a lower `min_rate` still passes, because the bench only checks the score against the floor. The floor is protected by the A4 guard rule (the agent is denied) and by review (reject a PR that lowers `ratchet.json`).
- **A8** — execute button stays disabled: approval pending or name empty; a name is required and it must match *this* incident + `rollback`.
- **A9** — lessons entry without provenance: notes must include incident id, date and the human's name (the console does this — free-form edits do not count). `/handoff` writes `HANDOFF.md` — check it exists.

## Reset the shop/console

```bash
pkill -f "demo/shop.ts" ; pkill -f "console/server.ts"
rm -rf demo/data demo/incidents console/data approvals/*.approval.json
npm run shop &          # fresh shop on :4310
npm run console &       # fresh console on :4320
```

Telemetry rebuilds deterministically from `fixtures/` — no state survives a
reset except what participants wrote (lessons, docs, code).

## No-Claude dry run (agent unavailable)

The whole day works without Claude Code — every exercise is plain TypeScript +
`node:test`:

- A3/A4/A5/A8: do the TODO by hand; `npm run test:workshop` still grades it.
- The guard hook still works (it's a `node` process) — test it directly:
  `echo '{"tool_name":"Edit","tool_input":{"file_path":"…/bench/ratchet.json"}}' | node .claude/hooks/guard.mjs`
- Claude-specific bits that degrade gracefully: skills don't load
  (read `.claude/skills/incident-triage/SKILL.md` aloud instead), hooks don't
  fire (feed them stdin as above), `npm run approve:git` refuses without
  `CLAUDECODE=0` — run it outside the agent anyway.

## Extension CORE — INC-1002 (facilitator only: the answer)

Participant steps are in WORKSHOP.md ("Extension CORE — INC-1002"). Everything
runs offline with `npm run tool`; a model is a second opinion, not a
requirement. Know the answer, but do not say "cache" in the room.

**Roles.** Participants run the steps and write `docs/diagnosis-trap.md` plus
`docs/postmortem-INC-1002.md`. You walk the room at minutes 4, 8 and 11 (hint
ladder below) and let the trap happen. Afterwards: collect the best
rejections on the question board; the strongest one can become a bench case.

### Answer flow (in the order a good team finds it)

1. `npm run tool -- alert trap` — 9% errors from 03:38, alert at 03:44, volume ×1.9.
2. `npm run tool -- changes trap --window 15m` — two changes: deploy **d-4830** (03:32:10, the INC-1001 fix) and config push **cfg-912** (03:37:30, price-cache flush + ttl=0). cfg-912 is **not** in `list_deploys` and no log line names it.
3. `npm run tool -- metrics trap --by retry` — first attempts flat at 480/min; the extra volume is retries, starting 03:39, one minute *after* the errors. Load test lt-77 ran 960/min at 0.3% (03:10–03:14) on a warm cache.
4. `npm run tool -- logs trap --level error` → `trace=7f3a9c`; `npm run tool -- trace trap 7f3a9c` — price-cache **miss** → `postgres.price_lookup` **timeout 2500 ms** → payments.charge **skipped**.
5. `npm run tool -- changes trap-after --window 30m` and `metrics trap-after` — the rollback d-4831 at 03:50 changes nothing (still 9%); cfg-913 (ttl=300 + warm) at 03:56 brings errors to 0.4% at 03:58, retries 0.

| Hypothesis | Prediction if true | Evidence | Verdict |
|---|---|---|---|
| Capacity | first attempts rise; errors also at 2× load with a warm cache | first attempts flat at 480/min (03:28–03:45); extra volume is retries of earlier orders (ord-5212, ord-5230, ord-5251 with retry=1/2) from 03:39, a minute after the errors; lt-77 ran 960/min at 0.3% | **Rejected** — the volume is a symptom (retries) |
| Deploy d-4830 | errors from 03:32; failing path in payments; rollback fixes it | 6 min at 100% on v2.15.1 with 0.3% errors (03:32–03:37); payments.charge ok in b7e410 and c09e55, skipped in failing traces; after the 03:50 rollback still 9% | **Rejected** — it only matches in time |
| cfg-912 price-cache flush | cache hit drops right after 03:37:30; failing span is the DB after a cache miss; warming the cache fixes it | cache hit 0.96 → 0.04 at 03:38; trace 7f3a9c: miss → postgres.price_lookup timeout; cfg-913 warm at 03:56 → 0.4% at 03:58 | **Cause (trigger)** |

Contributing factors for the postmortem (plural, never one "root cause"): a
migration step without warm-up, no retry budget on the client, no alert on the
cache hit ratio.

**A good rejection at the gate:**
`npm run reject -- fixtures/incidents/correlation-trap.json --by <name> --reason "Reject: v2.15.1 ran 6 min error-free at 100% (metrics 03:32–03:37); failing trace 7f3a9c fails in postgres.price_lookup after a cache miss, payments skipped (traces:7f3a9c)"`.
The scripted console proposes `scale` (capacity); `planRollback` would offer
rolling back d-4830 (v2.15.1 → v2.14.0). Both are traps.

### Hint ladder

| Min | Symptom | Hint |
|---|---|---|
| 4 | "It's capacity" | "If it's capacity, what do the *first attempts* do? Run `metrics --by retry`." |
| 6 | "It's the deploy" | "How many minutes did v2.15.1 run at 100% without errors? And what does the diff touch?" |
| 8 | No trace read | "Every error log line has `trace=`. Which span takes 2.5 s?" |
| 10 | No real cause yet | "Run `changes`. Which change is *not* in `list_deploys`?" |
| 11 | No intervention evidence | "Look at `trap-after`: what happened after the rollback at 03:50, and after 03:56?" |

### What to watch for

- "Capacity" without looking at `first_attempts`.
- Blaming the deploy "because it was the deploy yesterday" (anchoring on INC-1001).
- Skipping the trace.
- Reading `list_deploys` as "all changes".
- Deleting `TODO(human)` lines to turn `npm run postmortem:check` green.

### Common mistakes

1. **Approving the rollback anyway**, "it can't hurt". A rollback may be an experiment, but then with a prediction and a measurement. In the live variant the executor now refuses "resolved" while the error rate over its sample is still elevated: show that.
2. **Counting retries as new load.** Look at `order_ref` and `retry_attempt`.
3. **Missing the config push**, because W5 only taught `list_deploys`.
4. **cfg-912 as the single root cause** in the postmortem. Ask for contributing factors.
5. **Making TODOs disappear.** `postmortem:check` is red on purpose while they remain.

### Debrief questions

- Which of the five checks convinced you most, and which one can you do in two minutes at 03:44?
- Your own Claude Code: did it fall for it? What did it say after you asked for the five checks?
- How would you put this in CLAUDE.md without it going wrong for the other 99 incidents?
- Should `planRollback` get smarter, or is a human at the gate exactly enough?

### Pitfalls in the room

- **A participant's Claude Code answers differently from the console.** Good: the console is scripted and wrong on purpose; the model may be right or wrong. Put both side by side.
- **Subscription rate limits:** CORE works fully with `npm run tool` and no model.
- **Live variant (stretch):** `npm run shop`, `npm run traffic -- --retry 2`, `npm run chaos -- scenario correlation-trap`. A rollback does not cure the empty cache; recovery is the operator lever `npm run chaos -- cache warm`. Reset as above.
