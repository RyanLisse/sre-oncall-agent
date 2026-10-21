# Agent quickstart

The canonical participant route is generated from `workshop.json`:
[CARD.md](CARD.md) and the live [hub](http://127.0.0.1:4320/hub). Follow
[CLAUDE.md](CLAUDE.md) for the safety rules. This file does not authorize
approval, execution, mitigation, resolution, or pushing.

```bash
git clone https://github.com/RyanLisse/sre-oncall-agent.git
cd sre-oncall-agent
npm run checkpoint -- start
cd .lab/checkpoints/start
npm start -- --fast
```

Keep the launcher terminal open. `Ctrl+C` stops only processes started by that
launcher. Read actionable port errors; never kill an unknown process.
`npm run checkpoint -- core-2` and `npm run checkpoint -- core-3` create
separate current-HEAD copies and refuse to overwrite an existing destination.
Never copy runtime data, approvals, progress, or lesson history.

The starter's A5 tool and A8 executor tests are intentionally incomplete; A8
fails closed and never authorizes mutation. Do not weaken tests or call the
starter solved. Agents cite observed evidence and propose; named humans decide.
NOT LANDED or unknown recovery means stop, keep the incident open, and escalate.
Never use approval, execution, mitigation, or resolution endpoints on a human's
behalf. Record progress with `npm run progress:note -- "observed result"`; do
not edit `PROGRESS.md` directly. Use [CARD.md](CARD.md) for the task steps.
