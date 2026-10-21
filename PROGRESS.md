# Build log

**Historical, append-only.** What shipped and the evidence — not live status.
Live status is `npm run progress` (project **sre-oncall-agent**, Workshop 5).
Entries cite assignment keys **A-1**..**A-9** and decision-register rows (D<nn>).

- Entries are past-tense and immutable: append, never rewrite.
- Entries marked `<!-- auto: A-n -->` are appended by
  `.claude/hooks/progress.mjs` from local evidence; fill in the
  `<fill in: …>` bullets yourself.
- The agent appends status, decision and blocker lines with
  `npm run progress:note -- [--kind status|decision|blocker] "<text>"`
  (one timestamped line at the bottom). The agent never edits this file
  directly, and nobody rewrites old lines.
- Record only evidence you actually saw; if a check was not run, write `OPEN`.

<!-- ========================================================================
     ENTRY FORMAT — the auto entries use this shape:
     ## YYYY-MM-DDTHH:mm:ss±HH:mm — <past-tense title> (A-n)
     - **What shipped:**
     - **Why it mattered:**
     - **How, and what was rejected:**
     - **Validation:**
     - **Deliberately not done:**
     ======================================================================== -->

<!-- ENTRIES (newest at the bottom) -->

## 2026-10-20T20:23:12+02:00 — Setup: install, green tests, console smoke (A-1)
<!-- auto: A-1 -->

- **What shipped:** Dependencies installed; the suite ran and the guard hook produced its first audit entries.
- **Why it mattered:** <fill in: what this step proves about the AI SDLC>
- **How, and what was rejected:** <fill in>
- **Validation:** `npm ci`, `npm test`, `npm run test:workshop`, `npm run console` + `/api/health`.
- **Deliberately not done:** <fill in>
- 2026-10-20T20:24:44+02:00 [decision] e2e no longer requires a shell key: --model runs use the Claude Code login via the Agent SDK
- 2026-10-20T20:58:50+02:00 [status] demo shop UI on GET / (demo/shop.html): storefront with SVG product art, simulated customers, fault buttons; SOLO.md step 8 updated

## 2026-10-21T09:19:27+02:00 — Build: list_deploys tool + capability binding (A-5)
<!-- auto: A-5 -->

- **What shipped:** list_deploys re-implemented as a read-only telemetry tool and bound to its capability in the handlers map.
- **Why it mattered:** <fill in: what this step proves about the AI SDLC>
- **How, and what was rejected:** <fill in>
- **Validation:** `npm run test:workshop` green; the console investigation trace shows a list_deploys call.
- **Deliberately not done:** <fill in>

## 2026-10-21T09:19:27+02:00 — Gate: executor verifies a NAMED approval before executing (A-8)
<!-- auto: A-8 -->

- **What shipped:** The executor gate rebuilt: it verifies the approval signature for this incident + proposal before planRollback runs.
- **Why it mattered:** <fill in: what this step proves about the AI SDLC>
- **How, and what was rejected:** <fill in>
- **Validation:** Console: approve with your name, Execute, watch LANDED; chat still refuses 'roll back now'.
- **Deliberately not done:** <fill in>
