# Workshop 5 — practise the AI-native SDLC

This is the workshop overview. Its goal is to practise AI-assisted software
delivery while improving a small local SRE agent. Claude Code is the coding
assistant; the separate runtime SRE agent is the application being changed.
For the facilitator run sheet and timing, see [FACILITATOR.md](FACILITATOR.md).

The required route has **three core tasks**. Start with the AI SDLC: its
purpose, stages, evidence and human decisions. Then open Claude Code before
code edits. For each task, explain what you will do, why it is needed, and
what will prove it. Read a concept just before the step that uses it. The
generated [CARD.md](CARD.md) is the canonical source for actions, prompts and
proof. Optional depth does not replace intent, review, or release work.

- **The slides explain.** The facilitator uses them for the why.
- **The card is for doing.** Open **[CARD.md](CARD.md)**, or the hub at
  `http://127.0.0.1:4320/hub` once the lab runs (`npm run hub`). Each step says
  what you do, what you should see, how you check it, and what to do when you
  are stuck.

After the short lifecycle introduction, open Claude Code as the default
assistant. The real Agent SDK defaults to `sonnet` and needs separate
API/provider configuration;
run `npm run model:check` before fault injection. If that access is unavailable,
use `npm start -- --fast --offline` only as an explicit fallback. Offline
output is scripted integration evidence, not model evidence.

## Set up once

**Terminal 1 — start Claude Code**

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start                # make the current committed starter copy
cd .lab/checkpoints/start
claude
```

Submit the read-only assistant prompt in [CARD.md](CARD.md) after the
lifecycle introduction and before code edits. See
[docs/claude-code.md](docs/claude-code.md) for installation and
separate SDK configuration.

**Terminal 2 — from the original clone root**

Configure supported SDK access in the shell as described in the setup guide,
then run:

```bash
cd .lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check                         # real SDK preflight, before fault injection
npm start -- --fast                         # starts the local lab
```

`npm start` checks Node 22+ and starts the shop, traffic and console in
terminal 2. The console reloads itself when you save code; the shop keeps
running. Keep terminal 2 open. Ctrl+C stops only processes started by this
launcher. `--fast` opens an incident after one minute instead of five.

Break the shop once, when Core 1 asks you to: click **Bad deploy v2.15.0**
in the shop. If using the CLI alternative, open a separate shell in the
starter; do not type into the active launcher terminal. Never use both.

## The three core tasks

| Core | You do | Proof | Replaces |
| --- | --- | --- | --- |
| **1 · Specify from evidence** | Verify the actual diagnosis, citations, trace and gaps. Draft `intent.md` from those observations and accept it as a human. | `docs/diagnosis-live.md` and a human-accepted `intent.md` with observable checks and an open question | A1, A6 |
| **2 · Design, build and verify** | Create the human-owned starter baseline. Review a plan before each repair. Restore the read-only `list_deploys` handler, re-investigate the same incident, then repair the `checkApproval` gate. | `docs/plan.md` records both reviewed plans; the same-incident trace, focused checks and full verification are recorded | A5, A7, A8 |
| **3 · Review, release and learn** | Start with the actual diff review. Let a human decide whether to open and merge a learner-repo PR or record `RELEASE BLOCKED`. Observe runtime evidence, recovery outcome and propose a reviewed next task. | `docs/verify/sdlc.md` records diff review, human release decision, runtime result and next task | A9 |

The card gives each core a reason and proof, with **Before you act**
explanations next to the steps. The human baseline and release exercise are
required; their terminal procedures are in [docs/sdlc-git.md](docs/sdlc-git.md).
Skills, hooks, subagents and adding a bench case are optional extensions.
Explain concepts at their first use, not as a glossary. Do not treat a solved
checkpoint or local reload as participant-authored work or a production
release.

Run `npm run workshop:check` to see the two
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
npm run checkpoint -- core-2      # tool-solved, A8 gate still cut; intermediate Core 2 catch-up
npm run checkpoint -- core-3      # solved reference; does not prove participant-authored work
git diff --no-index .lab/checkpoints/core-2/src/tools.ts src/tools.ts
```

The command never changes your branch or your files. Compare, then copy one
file yourself if you choose. Do not copy approvals or lessons from a solved
state. `core-2` is a tool-solved, gate-unfinished catch-up point within Core 2.
`core-3` is the solved reference. Neither proves that you authored, tested or
reviewed a change. Make your own records.

`npm run progress` checks for files and code patterns. It does not run tests
or prove that the UI works. Record the commands and results yourself, after
you ran them: `npm run progress:note -- "Core 2: both repairs checked, full verify PASS"`.

## Go deeper (optional)

| # | Task |
| --- | --- |
| A3 | Review and extend the existing `docs/spec.md` contract reference; break one rule on purpose and watch `test/contract.test.ts` fail. |
| A4 | Add one deny rule of your own to `.claude/hooks/guard.mjs` **by hand**. Prove it with a deny line in `approvals/audit.jsonl`. Write `docs/decisions/D01-*.md`. |
| A7 | Add a case to `bench/cases.json`. Ask the agent to lower `bench/ratchet.json`: the guard denies it. Review is the second guard. |
| A8b | Optional guard experiment: test the SDLC push gate in a disposable learner repository. The human PR and release exercise in Core 3 remains required. |
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
| `core-2` | Tool-solved source with the A8 gate still cut; intermediate Core 2 catch-up, not proof of authored work. |
| `core-3` | Solved reference with no exercise cuts; not proof of authored work. |

Historical `w5-core-*` tags are archived references, not the current safety-tested starter.
