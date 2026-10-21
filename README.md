# SRE on-call lab — Workshop 5 (AI-native SDLC)

In this lab you build an AI first responder for a small checkout service, with
Claude Code as your builder. An alert fires. The agent reads the telemetry,
the deploy history and the logs. It posts one diagnosis with a reference
behind every claim, and it proposes ONE next step. A named human decides.
After the human acts, the agent watches the metric and reports if the fix
landed.

The agent **cannot** roll back, scale, flip a flag or page anyone. That is the
design: the agent gathers evidence, proposes, verifies and communicates;
humans decide what to mitigate and when.

Everything runs on your own machine. All data is fictional.

![The on-call loop: alert → investigation → recovery](docs/diagrams/01-architecture.svg)

## The scenario

| Part | Command | Where |
| --- | --- | --- |
| **Checkout shop** — a mock checkout API, not a storefront | `npm run shop` | `http://localhost:4310/health` |
| **Traffic** — steady checkouts against the shop | `npm run traffic` | — |
| **Chaos** — your lever to break the shop: a bad deploy, slow latency or errors | `npm run chaos -- deploy v2.15.0 --mode bad-deploy` | modes: `healthy`, `bad-deploy`, `slow`, `errors` |
| **Console** — the on-call desk: incidents, chat with the agent, approve/execute/resolve buttons, and a JSON API | `npm run console` | `http://localhost:4320` (health: `/api/health`) |

The reference incident is **INC-1001** (`fixtures/incidents/bad-deploy.json`):
the checkout error rate jumps after a deploy. The tutorial, the tests and the
bench replay it from fixtures. When you break the live shop, the console's
listener opens a new incident with its own id (`INC-<number>`). The listener
uses fixed criteria (error rate above 2% or p95 above 2000 ms, sustained for
about 5 minutes; set `AGENT_LISTEN_WINDOW_MIN=1` for a faster demo). The agent
is never the detector.

## Start here

| You are | Open | First action |
| --- | --- | --- |
| Participant | [Participant card](PARTICIPANT.md) | Extract `starter.zip`, run `npm start` |
| Facilitator | [Run sheet](FACILITATOR.md) | Build and rehearse the starter and checkpoint packages |
| Coding agent | [AGENTS.md](AGENTS.md), then [CLAUDE.md](CLAUDE.md) | Identify the copy and read the human boundaries |

You need Node.js 22+ with `node:sqlite` support and npm. The first start installs
missing dependencies, so npm access is needed once. The lab runtime is offline.
No Git, API key, or Claude Code login is required for the core tasks.

## Run the lab

In the extracted starter folder, beside `package.json`:

```text
npm start
```

Open **http://localhost:4320**. Keep the launcher running. It starts shop,
traffic, and console, but never injects a fault or approves an action.
For one-minute detection instead of five, use `npm start -- --fast`.
Recovery policy is unchanged. Stop with Ctrl+C. Restart after source edits.

When Core task 3 tells you to, run this once in a second terminal:

```text
npm run chaos -- deploy v2.15.0 --mode bad-deploy
```

The three core tasks are **read evidence**, **build and test one read-only
tool**, and **judge live recovery**. Follow [WORKSHOP.md](WORKSHOP.md).
A safe stop after NOT LANDED is a valid result. A human decides in the console.

## Choose the right copy

The facilitator runs `npm run workshop:pack -- --output ../workshop5-pack`
from a clean, committed reference checkout. The output contains:

- `starter.zip`: only the A5 read-only tool exercise is incomplete. Controls remain implemented.
- `checkpoint.zip`: solved code for explicit catch-up or facilitator demonstrations.
- A manifest recording the source commit.

Each archive has its own root folder and WORKSHOP-PACKAGE.md label. Extract
into new, separate folders. Never overwrite participant work or copy runtime
records between copies. A GitHub source ZIP is the reference, not this starter.

The historical `workshop/start` branch and `w5-step-*` tags remain available
for [optional A1–A9 depth](WORKSHOP-ADVANCED.md). They contain deliberate
control gaps and older guides. Do not mix them with the core package.
[SOLO.md](SOLO.md) retains the full self-study sequence.

## Record evidence

Use `intent.md` for your boundary and checks. Keep fixture and live observations
separate in `docs/diagnosis-live.md`. Record actual command results with:

```text
npm run progress:note -- "Core 2: focused tool tests passed"
```

Never edit PROGRESS.md directly. `npm run progress` checks file patterns;
it does not run tests. The participant card lists the real verification commands.

## The rules

- **Local only.** Everything runs on your machine. The agent has no network
  access: the guard hook denies network calls.
- **Push nothing.** Commit locally if you like, but do not push branches, open
  pull requests or deploy anything. The guard hook denies `git push`.
- **Humans decide.** The agent proposes; a named human approves, executes and
  closes. The agent may not sign approvals, edit hooks, edit `.claude/`, or
  rewrite `PROGRESS.md`.
- **No secrets in files.** You do not need an API key for this lab.
