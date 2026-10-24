---
name: review-and-ship
description: Review the workshop diff and checks, then prepare a release handoff. Only the human commits, approves, pushes, opens a PR or MR, and merges.
disable-model-invocation: true
allowed-tools: Bash(gh *) Bash(glab *) Bash(git *)
---

# Review and ship (lab version: GitHub and GitLab, human gate)

<!-- Lab change vs the pack: added glab (GitLab MR) next to gh (GitHub PR). In this lab the `!` lines below do
     not run (disableSkillShellExecution: true); Claude runs git status/diff itself, through the guard hook. -->

## Context

- Status: !`git status --short`
- Diff vs the exercise baseline: !`git diff workshop-base --stat`

## Workflow

1. Read `intent.md`, `docs/plan.md`, `docs/verify/sdlc.md`, `REVIEW.md` and `docs/sdlc-git.md`. Inspect `git diff workshop-base`, staged changes and untracked files. If the baseline is absent, stop and ask the participant to follow the human baseline procedure; do not substitute solved `main`.
2. Run targeted tests for changed behavior (`npm test`, `npm run bench`, `npm run test:workshop`); add tests or document the gap.
3. Review for correctness, regressions, security, intent fit (the three passes in `REVIEW.md`).
4. Fix critical issues; re-run affected tests.
5. Prepare findings and a PR or MR description with actual checks, risks and limitations. Do not commit, approve, push, open a PR or MR, or merge. Do not try a push to test the guard.
6. Hand over to the participant's shell procedure in `docs/sdlc-git.md`. Only the human stages and commits reviewed files, records Git approval, and publishes to the verified `learner` remote. The PR or MR base is `workshop-base`, with head `fix/w5-core`, not upstream `main`.
7. Ask the human to record the current-head CI and required review before deciding to merge. For solo work, record self-review as a limitation. Missing access or a required reviewer means `RELEASE BLOCKED`; never bypass protection or write to `approvals/`.

## Guardrails

- Correctness and security over style-only nits
- Focused commits; no unrelated files
- Fix hook failures rather than bypassing hooks
- Findings never approve; a named human approves (`npm run approve:git`) and merges

## Output

- Findings (critical / warning / note)
- Tests run and outcomes
- The observed checks and blockers, plus the human-only next step in `docs/sdlc-git.md`
