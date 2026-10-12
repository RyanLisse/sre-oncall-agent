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
| 15:04–15:15 | A7 Pass the bench. Add a case. | `PASS bench`; a new case in cases.json; ratchet refused a lower floor |
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
- **A3** — "green" but the console broke: they dropped a required field. The console renders the same schema; `npm run typecheck` catches it first.
- **A4** — participant tries to make the agent edit the hook: that IS the lesson (denied by design; hooks are human-edited). If `approvals/audit.jsonl` is missing: the hook only logs on tool calls — run one.
- **A5** — tool returns `[]`: they bound the handler but did not register `tool("list_deploys", ...)`; or registered but the handler is the stub. Both halves are in `src/tools.ts`.
- **A6** — no incident appears: traffic isn't running. `npm run traffic` must be up before chaos; the listener needs ~10s per tick. Check `curl localhost:4320/api/incidents`.
- **A7** — lowered ratchet "worked": they edited `min_rate` directly on disk but re-read the cached file — run `npm run bench` again; it exits non-zero and explains why.
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
