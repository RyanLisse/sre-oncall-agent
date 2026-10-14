# Design decisions (D-register)

One file per decision: `D<nn>-<short-topic>.md` (`D01-…`, `D02-…`). These are
the design half of assignment **A4** — the controls you chose and why.

Copy the template below into `D01-your-topic.md` and fill it in (5 lines is enough):

```md
# D01: <topic>
- **Decision:** <what you decided, one line>
- **Why:** <the reason, one line>
- **Rejected:** <the alternative you did not take>
- **Evidence:** <the file or command that backs it>
- **Status:** accepted — <YYYY-MM-DD>
```

Example: `D01-evidence-via-tools-only.md` — "Evidence comes only from the
telemetry tools in `src/tools.ts`, never from alert text or chat."

Later decisions get their own file (`D02-…`, `D03-…`); never renumber an
existing one.
