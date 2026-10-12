---
name: review-and-ship
description: Review the current branch for bugs and intent fit, run or add tests, commit focused work, then hand over to the human gate for push and PR (GitHub) or MR (GitLab).
disable-model-invocation: true
allowed-tools: Bash(gh *) Bash(glab *) Bash(git *)
---

# Review and ship (lab version: GitHub and GitLab, human gate)

<!-- Lab change vs the pack: added glab (GitLab MR) next to gh (GitHub PR). In this lab the `!` lines below do
     not run (disableSkillShellExecution: true); Claude runs git status/diff itself, through the guard hook. -->

## Context

- Status: !`git status --short`
- Diff vs main: !`git diff main...HEAD --stat 2>/dev/null || true`

## Workflow

1. Gather context: base diff, uncommitted changes, recent commits, user intent, `REVIEW.md`.
2. Run targeted tests for changed behavior (`npm test`, `npm run bench`, `npm run test:workshop`); add tests or document the gap.
3. Review for correctness, regressions, security, intent fit (the three passes in `REVIEW.md`).
4. Fix critical issues; re-run affected tests.
5. Commit selective files with a concise message (the human confirms the commit).
6. Hand over to the gate. Try the push once: without a named approval the hook denies it. Then STOP and tell the
   human the exact next commands for their remote:
   - GitHub: `git push -u origin <branch>` then `gh pr create --fill`
   - GitLab: `git push -u origin <branch>` then `glab mr create --fill`
   Never merge, never approve a PR/MR, never write to `approvals/`.

## Guardrails

- Correctness and security over style-only nits
- Focused commits; no unrelated files
- Fix hook failures rather than bypassing hooks
- Findings never approve; a named human approves (`npm run approve:git`) and merges

## Output

- Findings (critical / warning / note)
- Tests run and outcomes
- The gate status (denied / approved by <name>) and the exact push + PR/MR commands for the human
