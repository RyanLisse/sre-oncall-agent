# Participant quickstart

Use the generated [CARD.md](CARD.md) or the live
[hub](http://127.0.0.1:4320/hub); both are generated from `workshop.json`.
Follow [Claude Code and Agent SDK setup](docs/claude-code.md) for the official
installer and separate SDK configuration.

Claude Code is your development assistant. The runtime SRE agent is the
application you will change. The three required cores produce an evidence-based
and human-accepted intent; two human-reviewed plans, both repairs and complete
verification; then an actual diff review, a human release decision (or
`RELEASE BLOCKED`), runtime observation and a reviewed next task. These are
required work, not optional extensions.

**Terminal 1 — create the starter and start Claude Code**

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
claude
```

Submit the read-only assistant prompt from [CARD.md](CARD.md) after the
lifecycle introduction and before code edits. Follow the card for the
required tasks and their evidence.

**Terminal 2 — from the original clone root**

Configure supported SDK access in the shell as described in the setup guide,
then run:

```bash
cd .lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check
npm start -- --fast
```

Keep terminal 2 open; `Ctrl+C` stops only processes it started. If SDK access
is unavailable, use `npm start -- --fast --offline` explicitly; it is not
model evidence.
Catch up using `npm run checkpoint -- core-2` or
`npm run checkpoint -- core-3`. These create separate copies from committed
`HEAD` and refuse to overwrite. Never copy runtime, approvals, progress, or
lesson history. `core-2` is an intermediate catch-up point with the tool solved
and the A8 gate still cut. `core-3` is the solved reference. Neither proves
participant-authored work. Follow the human-only Git steps in
[docs/sdlc-git.md](docs/sdlc-git.md); use a learner repository, not upstream.
Skills, hooks, subagents and new bench cases are optional depth.

Agents propose and communicate. Named humans approve, execute, mitigate, and
resolve. Keep a NOT LANDED or unknown recovery open; do not retry for green.
