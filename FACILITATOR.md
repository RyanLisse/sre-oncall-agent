# Facilitator run sheet — Workshop 5 (one day, starts 10:45)

The day: nine assignments A1–A9 on `workshop/start`. Solved states live on
tags `w5-step-0-setup` … `w5-step-8-maintain`. Participants catch up with
`git checkout w5-step-N -- <files>` (exact file lists in WORKSHOP.md).

## Time boxes

| time | block | expected output at a glance |
|---|---|---|
| 10:45–11:10 | A1 setup | `npm test` green; `npm run test:workshop` red; console on :4320 |
| 11:10–11:35 | A2 intent | `intent.md` filled — boundary + 3 checks |
| 11:35–12:20 | A3 spec + contract | `test/workshop/contract.test.ts` green; `docs/spec.md` filled |
| 12:20–13:00 | lunch | — |
| 13:00–13:50 | A4 controls | chat refuses "roll back now"; audit.jsonl has denies; `test/workshop/guard.test.ts` green |
| 13:50–14:20 | A5 tool | `list_deploys` in the console trace |
| 14:20–14:55 | A6 live diagnosis | `docs/diagnosis-live.md`; a challenged chat answer with refs |
| 14:55–15:20 | A7 eval | `PASS bench`; a new case in cases.json; ratchet refused a lower floor |
| 15:20–15:40 | A8 gate | LANDED in console; `test/workshop/executor.test.ts` green |
| 15:40–16:00 | A9 maintain + hackathon | new lessons.md entry; hackathon intent |

## Top failure + fix per block

- **A1** — tests red in `npm test`: wrong branch. `git checkout workshop/start`, `npm ci`. (Exercise tests live in `test/workshop/` — `npm test` is green by design.)
- **A2** — intent reads like a wish list: demand the three *verifiable* checks, each runnable by a stranger.
- **A3** — "green" but the console broke: they dropped a required field. The console renders the same schema; `npm run typecheck` catches it first.
- **A4** — participant tries to make the agent edit the hook: that IS the lesson (denied by design; hooks are human-edited). If `approvals/audit.jsonl` is missing: the hook only logs on tool calls — run one.
- **A5** — tool returns `[]`: they bound the handler but did not register `tool("list_deploys", ...)`; or registered but the handler is the stub. Both halves are in `src/tools.ts`.
- **A6** — no incident appears: traffic isn't running. `npm run traffic` must be up before chaos; the listener needs ~10s per tick. Check `curl localhost:4320/api/incidents`.
- **A7** — lowered ratchet "worked": they edited `min_rate` directly on disk but re-read the cached file — run `npm run bench` again; it exits non-zero and explains why.
- **A8** — execute button stays disabled: approval pending or name empty; a name is required and it must match *this* incident + `rollback`.
- **A9** — lessons entry without provenance: notes must include incident id, date and the human's name (the console does this — free-form edits do not count).

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
