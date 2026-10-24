# Agent quickstart

The canonical participant route is generated from `workshop.json`:
[CARD.md](CARD.md) and the live [hub](http://127.0.0.1:4320/hub). Follow
[CLAUDE.md](CLAUDE.md) for the safety rules. This file does not authorize
approval, execution, mitigation, resolution, or pushing.
The learning goal is the AI software delivery lifecycle. Claude Code is the
development assistant; the runtime SRE agent is the application being changed.
The required route is: Core 1 verifies evidence and produces a human-accepted
intent. In Core 2, create a human-owned baseline, review a plan before each
repair, restore the read-only tool, check the same incident, repair the gate
and run full checks. Core 3 starts with actual diff review, then records a
human PR/release decision or `RELEASE BLOCKED`, runtime observation and a
reviewed next task. Intent, review and release are required work. Use the card
for canonical actions and prompts, and
[docs/sdlc-git.md](docs/sdlc-git.md) for human-only Git steps.
Follow [Claude Code and Agent SDK setup](docs/claude-code.md), including the
official installer and shell-only SDK configuration. Terminal 1 runs the
clone/checkpoint commands, enters the starter, starts `claude`, and submits
the read-only prompt after the lifecycle introduction and before code edits.
Terminal 2 starts from the original clone root, enters the same checkpoint,
then runs `npm ci`,
`npm run fixtures`, `npm run model:check`, and `npm start -- --fast`. The
Agent SDK preflight is separate from interactive CLI login.

**Terminal 1**
```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
claude
```

Submit the read-only assistant prompt from the card. In terminal 2, from
the original clone root, configure supported SDK access per the guide, then:

```bash
cd .lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check
npm start -- --fast
```

Keep the launcher terminal open. `Ctrl+C` stops only processes started by that
launcher. Read actionable port errors; never kill an unknown process.
`npm run checkpoint -- core-2` and `npm run checkpoint -- core-3` create
separate current-HEAD copies and refuse to overwrite an existing destination.
`core-2` is an intermediate tool-solved, gate-unfinished catch-up point;
`core-3` is the solved reference. Neither proves participant-authored work.
Never copy runtime data, approvals, progress, or lesson history.

The starter's A5 tool and A8 executor tests are intentionally incomplete; A8
fails closed and never authorizes mutation. Do not weaken tests or call the
starter solved. Agents cite observed evidence and propose; named humans decide.
The real runtime defaults to `sonnet`; `--offline` is explicit scripted
fallback output, never model evidence. If a model response fabricates a
citation or fails the contract, preserve it and stop.
When guiding a participant, state the current task, why it is needed, and
what will prove it. Explain only the concept needed for the next card step.
For an unaided participant, use [SOLO.md](SOLO.md). Do not require a
facilitator demonstration. Help record blockers and self-review limitations;
never substitute agent approval for a required human reviewer.
Do not lead with a glossary or turn optional depth into prerequisites.
NOT LANDED or unknown recovery means stop, keep the incident open, and escalate.
Never use approval, execution, mitigation, or resolution endpoints on a human's
behalf. Record progress with `npm run progress:note -- "observed result"`; do
not edit `PROGRESS.md` directly. Use [CARD.md](CARD.md) for the task steps.
Only skills, hooks, subagents and additional bench-case work are optional
extensions. Do not claim offline output is model evidence or treat a solved
checkpoint as proof that a participant authored, tested or reviewed a change.
