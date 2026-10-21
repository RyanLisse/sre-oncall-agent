# Workshop 5 — build the AI SRE agent (AI-native SDLC)

This is the workshop overview. For the facilitator run sheet and timing, see
[FACILITATOR.md](FACILITATOR.md).

The team path through this repo. You do **three core tasks**. Everything else
is optional depth. The loop you learn: **Intent → Spec → Design/controls →
Build → Test/evals → Gate → Maintain.**

- **The slides explain.** The facilitator uses them for the why.
- **The card is for doing.** Open **[CARD.md](CARD.md)**, or the hub at
  `http://127.0.0.1:4320/hub` once the lab runs (`npm run hub`). Each step says
  what you do, what you should see, how you check it, and what to do when you
  are stuck.

Everything runs offline. No API key is needed: the scripted runtime
(`src/runtime.ts`) drives the same tools as a real model.

## Set up once

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start                # make the current committed starter copy
cd .lab/checkpoints/start
npm start -- --fast                         # installs, checks, starts the lab
```

`npm start` checks Node 22+ and the dependencies, generates missing fixtures, and
starts the shop, the traffic and the console in one terminal. The console
reloads itself when you save code; the shop keeps running. Keep that
terminal open. Ctrl+C stops only the processes started by this launcher. Use a second terminal for everything
else. `--fast` opens an incident after one minute instead of five.

Breaking the shop is always a separate, deliberate command in the second
terminal: `npm run chaos -- deploy v2.15.0 --mode bad-deploy`.

## The three core tasks

| Core | You do | Proof | Replaces |
| --- | --- | --- | --- |
| **1 · Investigate the evidence** | Break the shop. The console raises the incident. Check every reference in the diagnosis against `demo/data/telemetry.json`. Find the deploy the agent cannot see (its data gap). | `docs/diagnosis-live.md` + a progress note naming the references you checked | A1, A6 |
| **2 · Build a change safely and test it** | Rebuild the read-only `list_deploys` tool test-first (`TODO(A5)` in `src/tools.ts`). Re-investigate: the gap closes, the proposal becomes `rollback`. | `npx tsx --test test/workshop/tools.test.ts`, `npm run typecheck` and `npm run bench` pass; A8 valid-approval assertion remains red until Core 3; `list_deploys` in the trace | A5, A7 |
| **3 · Judge the recovery** | Rebuild the approval gate (`TODO(A8)` in `src/executor.ts`). Approve with your name, execute, read the recovery checks, then mitigate and resolve, or stop on NOT LANDED. | `test/workshop/executor.test.ts` green, a lesson in `lessons/lessons.md` with your name | A8, A9 |

The steps are on the card. Run `npm run workshop:check` to see the two
`TODO` markers left in the starter.

## The console tells you the next step

Open an incident. The banner at the top names the next allowed step. The
server refuses every other button. After you resolve an incident, Execute
stays disabled. On `NOT LANDED` the console names the failed check, its value
and the limit. The half check may fail; the full and double checks must both
pass. `LANDED` is not closure: a named human marks it mitigated, then resolves
it with notes. Approval and closure always need your name.

## Behind? Catch up without losing your work

```bash
npm run checkpoint                # list: start · core-2 · core-3
npm run checkpoint -- core-2      # current-HEAD copy with only the fail-closed A8 cut
npm run checkpoint -- core-3      # current solved source, unchanged
git diff --no-index .lab/checkpoints/core-2/src/tools.ts src/tools.ts
```

The command never changes your branch or your files. Compare, then copy one
file yourself if you choose. Do not copy approvals or lessons from a solved
state. Make your own records.

`npm run progress` checks for files and code patterns. It does not run tests
or prove that the UI works. Record the commands and results yourself, after
you ran them: `npm run progress:note -- "Core 2: tools test green, bench PASS"`.

## Go deeper (optional)

| # | Task |
| --- | --- |
| A2 | Write your team `intent.md`: who the agent serves, the boundary, three checks a stranger can verify. |
| A3 | Write `docs/spec.md` for the evidence rules in `src/contract.ts`; break one rule on purpose and watch `test/contract.test.ts` fail. |
| A4 | Add one deny rule of your own to `.claude/hooks/guard.mjs` **by hand**. Prove it with a deny line in `approvals/audit.jsonl`. Write `docs/decisions/D01-*.md`. |
| A7 | Add a case to `bench/cases.json`. Ask the agent to lower `bench/ratchet.json`: the guard denies it. Review is the second guard. |
| A8b | The git gate: ask the agent to push `fix/<your-name>` (denied). Your neighbour runs `npm run approve:git -- <their-name> fix/<your-name> "<reason>"` in their own terminal. |
| A9b | Write `docs/hackathon-intent.md` for the agent you build next. Hand off with `/handoff`. |

## Two gates — don't confuse them

- **Runtime gate** — a diagnosis needs a NAMED approval before the executor
  may act: the console buttons or `npm run approve -- <incident> --by <name>`.
  Record: `approvals/<inc>.approval.json`.
- **SDLC gate** — a `fix/*` branch may only be pushed after a named human ran
  `npm run approve:git -- <name> <branch> "<reason>"` **in their own
  terminal**. The guard hook denies it inside the agent. Record:
  `approvals/approvals.jsonl`.

## Refs

| Checkpoint | Contains |
| --- | --- |
| `start` | The current-HEAD starter: bounded `TODO(A5)` and fail-closed `TODO(A8)`. |
| `core-2` | Current-HEAD source with only the fail-closed A8 cut. |
| `core-3` | Current committed solved source, unchanged. |

Historical `w5-core-*` tags are archived references, not the current safety-tested starter.
