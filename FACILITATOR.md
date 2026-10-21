# Facilitator run sheet — Workshop 5 (one day, starts 10:00)

The day: nine assignments A1–A9 on `workshop/start`. Solved states live on
tags `w5-step-0-setup` … `w5-step-8-maintain`. Participants catch up with
the exact tag and file list in WORKSHOP.md, after saving their own work.
Assignment titles below match the slide deck.

## Prepare two copies

Keep the current WORKSHOP.md and FACILITATOR.md open from the default branch
in your browser. The starter and solved refs keep their historical guides.

Keep the facilitator demo separate from participant work. Use `workshop/start`
for the participant route. Create a personal branch before edits. Use
`w5-step-8-maintain` for the solved demo. Never present a solved checkout as
the starter. The starter has deliberately missing controls. Use only local,
fictional data, and do not execute a rollback there before A8 is complete.

Run one copy's console, shop and traffic at a time on the default ports.
Stop each process with Ctrl+C before changing copies. Both copies need
`npm ci` and `npm run fixtures`. Run these checks before class:

- Starter: `npm test` passes; `npm run test:workshop` has exercise failures.
- Solved: `npm run verify` and `npm run test:workshop` pass.
- Open the console. A new starter has no incidents and no shop telemetry.
- The shop has no storefront. Show its `/health` JSON and the console UI.

For the live demo, keep console, shop and traffic in three separate
terminals. Run chaos in a fourth. Use the one-minute detection command for
your shell in WORKSHOP.md. Say that the participant default is five minutes.
Restart the console after source edits; `npm run console` does not watch files.
Keep traffic running through the recovery checks.

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
| 14:00–14:15 | A5 Build a read-only tool | `list_deploys` in the console investigation trace |
| 14:15–14:40 | A6 Diagnose a live incident | `docs/diagnosis-live.md`; a scripted chat comparison; evidence references |
| 14:40–14:55 | break | — |
| 15:04–15:15 | A7 Pass the bench. Add a case. | `PASS bench`; a new case in cases.json; agent edit of ratchet.json denied |
| 15:23–15:30 | A8 The gate: approve with your name | LANDED in console; `executor.test.ts` green |
| 15:42–15:50 | A9 Maintain + your hackathon intent.md | new lessons.md entry; hackathon intent; `/handoff` → HANDOFF.md |

The gaps between boxes (11:15–11:28, 11:43–11:47, 13:00–13:30, 13:50–14:00,
14:55–15:04, 15:15–15:23, 15:30–15:42) are the deck's talk/demo segments.

A8's **optional second half** is the git gate: a participant asks the agent to push
`fix/<name>` (denied by the guard hook), their neighbour runs
`npm run approve:git -- <name> fix/<name> "<reason>"` in their own terminal.
Skip it if the afternoon runs long — the runtime gate is the core lesson.

## Top failure + fix per block

- **A1** — tests red in `npm test`: inspect `git status` and the failing test first. Verify that the personal branch starts from `workshop/start`, then check Node 22+ and dependencies. Do not switch branches over participant edits. Exercise tests live in `test/workshop/` and fail by design.
- **A2** — intent reads like a wish list: demand the three *verifiable* checks, each runnable by a stranger.
- **A3** — `npm test` fails after the contract edit or the dry run prints `FAIL contract`: `customer_impact` is in `src/contract.ts` but not yet in the offline verdicts in `src/runtime.ts` or the fixtures in `test/contract.test.ts`.
- **A3** — "green" but the console broke: they dropped a required field. The console renders the same schema; `npm run typecheck` catches it first.
- **A4** — participant tries to make the agent edit the hook: that IS the lesson (denied by design; hooks are human-edited). If `approvals/audit.jsonl` is missing: the hook only logs on tool calls — run one.
- **A5** — tool returns `[]`: they bound the handler but did not register `tool("list_deploys", ...)`; or registered but the handler is the stub. Both halves are in `src/tools.ts`.
- **A6** — no incident appears: traffic isn't running. `npm run traffic` must be up before chaos; the listener opens an incident only after the error rate stays above 2% for ~5 minutes (start the console with `AGENT_LISTEN_WINDOW_MIN=1` for a faster demo). Check `curl localhost:4320/api/incidents`.
- **A7** — lowered ratchet "worked": expected. By hand, a lower `min_rate` still passes, because the bench only checks the score against the floor. The floor is protected by the A4 guard rule (the agent is denied) and by review (reject a PR that lowers `ratchet.json`).
- **A8** — execute button stays disabled: approval pending or name empty; a name is required and it must match *this* incident + `rollback`. Restart the console after the executor edit. Allow about two minutes for recovery checks. `LANDED` is not closure: the human marks mitigated, then resolves in A9. Do not mark `NOT LANDED` as recovered.
- **A9** — lessons entry without provenance: notes must include incident id, date and the human's name (the console does this — free-form edits do not count). `/handoff` writes `HANDOFF.md` — check it exists.

## Repeat the demo without deleting participant work

Stop traffic, shop and console with Ctrl+C in their own terminals.
Create a new disposable clone for the next demo. Check out
`w5-step-8-maintain`, run `npm ci` and `npm run fixtures`, then start the
four-terminal flow above. Keep the old copy if you need its evidence.

`npm run fixtures` regenerates fixture telemetry only. It does not reset
live telemetry, console history, approvals or lessons. Do not delete those
records in a participant's working copy.

## No-Claude dry run (agent unavailable)

The whole day works without Claude Code — every exercise is plain TypeScript +
`node:test`:

- A3/A4/A5/A8: do the TODO by hand; `npm run test:workshop` still grades it.
- The guard hook still works (it's a `node` process) — test it directly:
  `echo '{"tool_name":"Edit","tool_input":{"file_path":"…/bench/ratchet.json"}}' | node .claude/hooks/guard.mjs`
- Claude-specific bits that degrade gracefully: skills don't load
  (read `.claude/skills/incident-triage/SKILL.md` aloud instead), hooks don't
  fire (feed them stdin as above). Only a human may run `npm run approve:git`
  in their own terminal. Never change environment variables to bypass that check.

## What the evidence means

The offline runtime proves the scripted integration, not model quality.
Offline chat returns a summary. Compare it with `ruled_out` and
`would_change_my_mind`; do not claim a fresh model challenge took place.
Evidence references are text in the diagnosis. The trace lists tool names
and inputs. Read `demo/data/telemetry.json` to inspect the referenced values.
`customer_impact` is in the verdict JSON but has no separate console row.

`npm run progress` is a checklist of file and code-pattern evidence, not a
test runner. A green tick or a copied catch-up document does not prove the
assignment. Ask each team to show its own command result or UI action.

## Known console limitation

On `w5-step-8-maintain`, Execute rollback remains enabled after resolution.
Do not execute a resolved incident again. Use a new disposable copy for a
repeat demo. This workshop does not test repeated execution after closure.
