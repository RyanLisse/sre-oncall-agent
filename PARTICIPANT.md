# Participant quickstart

Use the generated [CARD.md](CARD.md) or the live
[hub](http://127.0.0.1:4320/hub); both are generated from `workshop.json`.

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
npm start -- --fast
```

Keep the launcher terminal open; `Ctrl+C` stops only processes it started.
Catch up with `npm run checkpoint -- core-2` or
`npm run checkpoint -- core-3`. These create separate copies from committed
`HEAD` and refuse to overwrite. Never copy runtime, approvals, progress, or
lesson history. For the three core tasks, see [CARD.md](CARD.md).

Agents propose and communicate. Named humans approve, execute, mitigate, and
resolve. Keep a NOT LANDED or unknown recovery open; do not retry for green.
