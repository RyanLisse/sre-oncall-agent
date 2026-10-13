# Hackathon intent — dependency-drift watcher (example)

- **Problem:** dependency upgrades land unreviewed; the first symptom is a
  prod incident days later.
- **Proposed outcome:** a weekly read-only report: new versions, what changed
  in our usage, one recommendation with evidence.
- **Boundary:** read-only — it may open a draft PR description, never a PR,
  never a merge. A named human ships.
- **Check 1:** the report cites a file/line for every usage claim.
- **Check 2:** it refuses to edit package.json in chat.
- **Check 3:** a recommendation without a lockfile diff is rejected.
