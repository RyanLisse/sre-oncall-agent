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
| **Checkout shop** — a mock checkout service that writes its own telemetry | `npm run shop` | `http://localhost:4310` |
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

## Set up

You need:

- **Node.js 22 or newer** (check with `node --version`) and npm.
- **Claude Code**, signed in with your own account (`claude`, then `/login`).
  Claude Code is your builder.
- **No API key.** The agent runs offline by default: a scripted investigator
  drives the same tools against the same data. Its output demonstrates the
  pipeline; it is not model evidence.

```bash
git clone <repo-url> sre-oncall-agent   # the URL your facilitator gives you
cd sre-oncall-agent
git checkout workshop/start             # the lab branch
npm install
npm run fixtures
npm test                                # green: the main suite
npm run test:workshop                   # red: the exercises (by design)
```

Start Claude Code in the folder (`claude`) and run `/status`: it shows the
guard and progress hooks from `.claude/settings.json`.

## Run it

Three terminals:

```bash
npm run shop                                        # 1 · the checkout shop on :4310
npm run traffic                                     # 2 · traffic
npm run console                                     # 3 · the console on :4320
```

Then break the shop and watch the console:

```bash
npm run chaos -- deploy v2.15.0 --mode bad-deploy   # a bad deploy
npm run chaos -- degrade --mode slow                # the same kind of fault, no deploy record
```

Other useful commands:

```bash
npm run demo                 # the whole loop on a bad deploy, about 2 minutes
npm run doctor               # preflight check
npm run progress             # which assignments already have evidence
npm run workshop:check       # the TODO markers you still have to fill in
npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run   # INC-1001 from fixtures
```

## The file flow

Each step of the AI SDLC leaves one file behind. Write them in this order:

1. **`intent.md`** — who the agent serves, the boundary, and three checks a
   stranger can verify.
2. **`docs/spec.md`** — the contract the code must meet.
3. **`docs/plan.md`** — the steps, smallest first, and the checks.
4. **`PROGRESS.md`** — the build log: append-only. The progress hook appends
   an entry when it sees local evidence for an assignment; you add your own
   lines at the bottom. Nobody rewrites old lines.
5. **`REVIEW.md`** — the review checklist you run before you share a change.

## The assignment

Build the agent piece by piece, test first: **Intent → Spec → Design/controls
→ Build → Test/evals → Gate → Maintain.** The `workshop/start` branch has
four pieces removed (`TODO(A3/A4/A5/A8)`); the red tests in `test/workshop/`
turn green as you rebuild them.

| # | Assignment |
| --- | --- |
| A1 | Setup check: install, green main suite, console up, Claude Code connected |
| A2 | Write your team `intent.md` |
| A3 | Spec + contract: the evidence rules and the new `customer_impact` field, test-first |
| A4 | Controls: chat refuses mutations again; add your own guard rule by hand |
| A5 | Build the read-only `list_deploys` tool |
| A6 | Diagnose a live incident from the console |
| A7 | Pass the bench and add one case; the ratchet only goes up |
| A8 | The gate: the executor acts only on a NAMED human approval |
| A9 | Maintain: resolve the incident with notes that become a lesson |

The full steps, catch-up commands and step tags are in
**[WORKSHOP.md](WORKSHOP.md)**. Working alone? Follow **[SOLO.md](SOLO.md)**.

## Extension: INC-1002

The night after INC-1001: checkout errors at 9%, request volume almost
doubled, and the INC-1001 fix shipped twelve minutes earlier. Two suspects
line up in time. Prove or reject each one with a ref. The scripted console is
wrong on purpose; your job is to show why. Steps: **[WORKSHOP.md](WORKSHOP.md#extension-core--inc-1002)**.

```bash
npm run fixtures
npm run tool -- alert trap                    # the alert rule: hand the query to your agent
npm run tool -- changes trap --window 15m     # every change in the window, not only deploys
npm run tool -- metrics trap --by retry       # first attempts vs retries
npm run tool -- logs trap --level error       # copy a trace=<id>
npm run tool -- trace trap <id>               # which span fails?
npm run investigate:trap                      # the scripted verdict
npm run reject -- fixtures/incidents/correlation-trap.json --by <name> --reason "<ref>"
npm run postmortem:check                      # open TODO(human) lines in docs/postmortem-*.md
npm run test:ext                              # the extension's own tests
```

`npm run tool` is read-only: it calls the same handlers the agent uses and
prints a `reproduce` line. `trap-after` is the same incident with the
telemetry after the alert (a rollback, then a cache warm-up). Live variant:
`npm run shop`, `npm run traffic -- --retry 2`, then
`npm run chaos -- scenario correlation-trap`; recover with
`npm run chaos -- cache warm`.

## The rules

- **Local only.** Everything runs on your machine. The agent has no network
  access: the guard hook denies network calls.
- **Push nothing.** Commit locally if you like, but do not push branches, open
  pull requests or deploy anything. The guard hook denies `git push`.
- **Humans decide.** The agent proposes; a named human approves, executes and
  closes. The agent may not sign approvals, edit hooks, edit `.claude/`, or
  rewrite `PROGRESS.md`.
- **No secrets in files.** You do not need an API key for this lab.
