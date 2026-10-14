---
name: design-control-loop
description: Only use when the user explicitly invokes this skill by name. Interviews the user to design the agent as a control loop (set point, sensor, controller, actuator, disturbances/dampener) and maps the answers onto intent.md. Design only; builds nothing.
disable-model-invocation: true
---

<!-- Lab adaptation of humanlayer/skills plugins/design-control-loop @653b641 (MIT, see LICENSE-humanlayer.txt).
     Lab scope: upstream Phases A–B only (understand + design interview). Phases C–H (actuator skill, headless
     agent with API keys, permission bypass, CI workflow, bunx @humanlayer/cli) are deliberately removed.
     references/control-loop-taxonomy.md is verbatim. -->

# Design the agent as a control loop (lab version)

The user wants to pin down what their agent drives toward, how it measures, what it may change, and who stops it, before any code. Your job is to **interview** them and turn the agreed answers into `intent.md`. You do not build anything, do not write skills, workflows, or CI, and do not pick credentials.

## Workflow

1. **Read before you ask.** Read `{SKILLBASE}/references/control-loop-taxonomy.md`, `intent.md`, `CLAUDE.md`, `REVIEW.md`, `.claude/settings.json`, and list `fixtures/incidents/`, `lessons/`, `bench/`. Come with proposals, not a blank form.
2. **Interview in rounds.** At most 3 numbered questions per round, each with your recommended answer grounded in what you read. Wait for the answers. Cover, in this order:
   1. **Set point + scope**: what property the agent drives and to what target (e.g. "every alert gets a diagnosis that cites real evidence within N minutes"), and what it may read vs change.
   2. **Sensor**: which local, read-only evidence it measures (the telemetry tools in `src/tools.ts`, `lessons/lessons.md`) and how repeatable that is.
   3. **Controller**: how it picks the next step (triage skill, plan mode) and what one reviewable unit of work is (one diagnosis, one config PR/MR).
   4. **Actuator**: who changes the system. In this lab the agent only proposes; a named human approves (`npm run approve:git`), pushes, and opens the PR/MR. Validation = `npm test`, `npm run test:workshop`, `npm run test:hooks`, `npm run bench`.
   5. **Disturbances + dampener**: what moves outside the loop (other deploys, noisy logs, upstream PSP) and what keeps it from getting worse (the bench as a regression gate, the hook, `REVIEW.md`).
   Stop when the user says so; in a live demo one round is enough.
3. **Map to intent.md.** Show a table: control-loop component → intent.md section (set point → Outcome + success checks; scope → Constraints/boundary; sensor → Users/Systems; actuator → Constraints "agent proposes, human executes"; disturbances/dampener → Open questions or success checks). Then propose the exact edit to `intent.md`. Only write it after the user confirms (the hook will also ask).
4. **Report** what was decided, what stays OPEN, and the next step (spec.md: the diagnosis contract).

Never suggest running an agent unattended, bypassing permissions, using API keys, or calling external services. Write as one human talking to another: simple, concise language.
