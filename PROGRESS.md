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
