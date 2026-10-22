# Participant quickstart

Use the generated [CARD.md](CARD.md) or the live
[hub](http://127.0.0.1:4320/hub); both are generated from `workshop.json`.
Follow [Claude Code and Agent SDK setup](docs/claude-code.md) for the official
installer and separate SDK configuration.

**Terminal 1 — create the starter and start Claude Code**

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
claude
```

Submit the exact read-only prompt from the setup guide before theory or edits.

**Terminal 2 — from the original clone root**

Configure supported SDK access in the shell as described in the setup guide,
then run:

```bash
cd sre-oncall-agent/.lab/checkpoints/start
npm ci
npm run fixtures
npm run model:check
npm start -- --fast
```

Keep terminal 2 open; `Ctrl+C` stops only processes it started. If SDK access
is unavailable, use `npm start -- --fast --offline` explicitly; it is not
model evidence.
Catch up with `npm run checkpoint -- core-2` or
`npm run checkpoint -- core-3`. These create separate copies from committed
`HEAD` and refuse to overwrite. Never copy runtime, approvals, progress, or
lesson history. For the three core tasks, see [CARD.md](CARD.md).

Agents propose and communicate. Named humans approve, execute, mitigate, and
resolve. Keep a NOT LANDED or unknown recovery open; do not retry for green.
