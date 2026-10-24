# SRE on-call lab — Workshop 5 (AI-native SDLC)

This lab teaches the AI software delivery lifecycle by changing a local SRE
first responder. Claude Code is the development assistant from the first
minutes; it is distinct from the runtime SRE agent being built. That agent
reads telemetry, forms an evidence-backed diagnosis and proposes one next
step. Participants turn observed evidence into an accepted intent, review a
plan, repair and test code, review the actual diff, make a human release
decision (or record `RELEASE BLOCKED`), observe runtime results and propose a
reviewed next task.

The agent **cannot** roll back, scale, flip a flag or page anyone. That is the
design: the agent gathers evidence, proposes, verifies and communicates;
humans decide what to mitigate and when.

The CLI, launcher, shop and console run locally; SDK model calls use your
configured provider. All data is fictional.

Choose [WSL or native PowerShell](docs/platforms.md) for setup. Use the
[assignment scenarios and expected screens](docs/assignment-examples.md)
beside the participant card. Docker is optional planning material, not a
packaged route yet.

![The on-call loop: alert → investigation → recovery](docs/diagrams/01-architecture.svg)

## The scenario

| Part | What it is | Where |
| --- | --- | --- |
| **Checkout shop** | a mock checkout API with a demo storefront and fault buttons | `http://127.0.0.1:4310` (health: `/health`) |
| **Traffic** | steady checkouts against the shop | the lab terminal |
| **Console** | the on-call desk: incidents, chat with the agent, approve/execute/resolve buttons, a JSON API | `http://127.0.0.1:4320` |
| **Hub** | the participant card with the live next step | `http://127.0.0.1:4320/hub` |
| **Chaos** | your lever to break the shop: a bad deploy, slow latency or errors | `npm run chaos -- deploy v2.15.0 --mode bad-deploy`, or a fault button in the shop |

`npm start` runs the shop, the traffic and the console together. Breaking the
shop is always a separate action: you choose when.

The reference incident is **INC-1001** (`fixtures/incidents/bad-deploy.json`):
the checkout error rate jumps after a deploy. The tests and the bench replay
it from fixtures. When you break the live shop, the console's listener opens a
new incident (`INC-<number>`) after the error rate stays above 2% or p95 above
2000 ms for about 5 minutes (1 minute with `npm start -- --fast`). The agent is
never the detector.

## Set up and run

You need **Git** and **Node.js 22 or newer**. Install Claude Code using the
[official setup instructions](https://code.claude.com/docs/en/setup); the
[setup guide](docs/claude-code.md) includes platform commands and explains
separate Agent SDK authentication.

**Terminal 1 — start Claude Code in the starter**
```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start                    # current committed starter copy
cd .lab/checkpoints/start
claude
```

Submit the read-only assistant prompt in [CARD.md](CARD.md) after the
lifecycle introduction and before code edits.

**Terminal 2 — configure SDK access and start the lab**

From the original clone root, configure a supported SDK provider in the shell
as described in the setup guide, then run:

```bash
cd .lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check                           # must pass before fault injection
npm start -- --fast                           # starts the real-model lab
```

Keep terminal 2 open; Ctrl+C stops only processes it started. Use `/login`
only for the interactive CLI if needed; inspect
`.claude/settings.json` to verify hooks. `/status` is not SDK proof.

| Command | What it does |
| --- | --- |
| `npm run hub` | open the participant card (live when the lab runs) |
| `npm run chaos -- deploy v2.15.0 --mode bad-deploy` | break the shop on purpose |
| `npm run checkpoint -- core-2` | tool-solved copy with the A8 gate still cut; intermediate Core 2 catch-up |
| `npm run checkpoint -- core-3` | solved reference with no exercise cuts |
| `npm run doctor` | preflight check |
| `npm run demo` | legacy auto-approving script; do not use for the human-gated route |
| `npm run progress` | which assignments already have file evidence |

## The assignment: three core tasks

| Core | You do |
| --- | --- |
| **1 · Specify from evidence** | Verify the diagnosis and its references, then draft and human-accept an intent from the observed data. |
| **2 · Design, build and verify** | Create a human-owned baseline. Review a plan before each repair, restore `list_deploys`, check the same incident, repair `checkApproval`, then run full verification. |
| **3 · Review, release and learn** | Review the actual diff first. Make a human PR/release decision or record `RELEASE BLOCKED`, observe runtime evidence and recovery, then review one next task. |

Neither checkpoint proves participant-authored work. `core-2` is an
intermediate catch-up point with the tool solved and the A8 gate still cut;
`core-3` is the solved reference. The canonical actions, prompts and proof for
each core are on **[CARD.md](CARD.md)**. The facilitator run sheet is
**[FACILITATOR.md](FACILITATOR.md)**; **[WORKSHOP.md](WORKSHOP.md)** is the
overview. Working alone? Follow **[SOLO.md](SOLO.md)**. Intent, planning,
diff review and release decisions are required, not optional depth. Skills,
hooks, subagents and adding a bench case are optional extensions. Human-only
baseline, approval and learner-repository steps are in
**[docs/sdlc-git.md](docs/sdlc-git.md)**.

The solo route does not require slides or a facilitator. It includes setup,
self-review, pause/resume guidance and a blocked-release outcome when access
or independent review is missing. The [concept course](course/index.html)
is optional background, not a replacement for the three-core assignment.
The old [runtime explainer](docs/video/README.md) and dated verification
records are historical evidence, not instructions for the current workshop.

Historical `w5-core-*` tags are archived references only. The current
safety-tested starter is generated from committed `HEAD` by `npm run checkpoint`.

## The file flow

The required evidence trail includes `docs/diagnosis-live.md`, accepted
`intent.md`, reviewed `docs/plan.md`, actual checks and review in
`docs/verify/sdlc.md`, and an append-only `PROGRESS.md` note
(`npm run progress:note -- "…"`). `docs/spec.md` records the existing
diagnosis contract; it constrains the plan.

## The rules

- **Local boundary.** The CLI, launcher, shop and console run on your machine.
  A real SDK call uses your configured provider; the guard still denies
  unrelated network calls.
- **Human-owned release.** Use your own fork or a facilitator-provided learner
  repository for the required PR exercise. A human reviews, commits, approves,
  pushes, opens the PR and makes the merge decision. Follow
  [docs/sdlc-git.md](docs/sdlc-git.md); never push the training baseline to
  upstream.
- **Humans decide.** The agent proposes; a named human approves, executes and
  closes. The agent may not sign approvals, edit hooks, edit `.claude/`, or
  rewrite `PROGRESS.md`.
- **No secrets in files.** Configure an SDK key or supported provider in the
  shell only. A Claude Code login does not prove SDK access.
