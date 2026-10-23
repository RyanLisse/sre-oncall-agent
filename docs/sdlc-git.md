# Review and release your workshop change

Run these steps yourself in a shell, not inside the Claude Code prompt.
Claude may prepare a diff review and PR description. It must not commit,
push, approve or merge for you. Exit Claude with `/exit` when you need its
terminal, then reopen it after the human-only step. Keep the lab terminal open.

## Keep a starter baseline before code edits

The generated starter has a solved HEAD and two unfinished exercise cuts.
Committing those cuts gives the repair a meaningful before-and-after diff.
Run this in `.lab/checkpoints/start`, before asking Claude to change code:

```bash
git status --short
git switch -c workshop-base
git add src/tools.ts src/executor.ts
git diff --cached
```

Check that only the A5 empty handler and the A8 fail-closed cut are staged.
Do not include intent, evidence, runtime data or unrelated edits. Then run:

```bash
git commit -m "Set workshop exercise baseline"
git switch -c fix/w5-core
git show --stat workshop-base
```

If either branch already exists, stop and ask the facilitator. Do not reset
or overwrite it. The baseline intentionally has failing exercise tests.
Only the repaired branch is a release candidate.

## Review and commit the repaired change

After the complete Core 2 checks pass, review `git diff workshop-base` against
`intent.md`, `docs/plan.md` and `REVIEW.md`. Ask Claude for findings, then
verify them yourself. Record your decision and actual check results in
`docs/verify/sdlc.md`. Do not commit credentials or live customer data.

First run `git status --short`. Untracked files do not appear in the diff.
Inspect each new file and stage only intended, non-sensitive files by their
exact paths before requesting the review. Include new tests and evidence;
leave unrelated files out. Never use `git add .` to make the list disappear.

Stage the workshop change explicitly:

```bash
git add src/tools.ts src/executor.ts intent.md docs/plan.md docs/diagnosis-live.md docs/verify/sdlc.md
git diff --cached
```

If you changed tests, stage those specific files after reviewing them too.
Once you accept the staged diff, commit it:

```bash
git commit -m "Repair deployment evidence and human approval gate"
```

## Record the human Git approval

Replace `YOUR NAME` with your own name. This record is an audit aid, not an
identity proof or a substitute for repository protection.

```bash
npm run approve:git -- "YOUR NAME" fix/w5-core "Reviewed intent, diff and actual checks"
npm run check:approval
git add -f approvals/approvals.jsonl
git diff --cached
git commit -m "Record human approval for workshop change"
```

If `approvals/audit.jsonl` exists, inspect it for sensitive data. Stage and
commit it separately only if it is safe to publish. Never stage all of
`approvals/`; runtime approval records are unrelated to this Git decision.

`approve:git` may print generic follow-up commands that push to `origin`.
Do not use those commands for this workshop: publish only to your own
`learner` repository, with the PR based on `workshop-base`, as described
below. Never push the exercise branches to the upstream workshop repository.

## Publish only to your learner repository

Use your own fork or a facilitator-provided learner repository. Never push
`workshop-base` or `fix/w5-core` to the upstream workshop repository.

Create the fork in GitHub or GitLab yourself. Replace `YOUR-ACCOUNT` below
with your account, or use the URL of your assigned learner repository:

```bash
git remote add learner https://github.com/YOUR-ACCOUNT/sre-oncall-agent.git
git remote get-url learner
```

Confirm that this is your learner repository. If `learner` already exists,
inspect its URL instead of changing it blindly. A checkpoint is a worktree;
its Git remotes are shared with the original clone.

### GitHub prerequisite: the published starter branch

The inherited GitHub workflow also checks out `workshop/start`. A new learner
repository, or a fork created with only `main`, does not have that branch.
The facilitator or learner must provision it once before expecting a green
PR. This is the upstream legacy starter used by CI, not your generated
two-exercise `workshop-base`.

Check the learner repository first:

```bash
git ls-remote --exit-code learner refs/heads/workshop/start
```

If this prints a commit and branch, do not overwrite it; ask the facilitator
to confirm it is the intended starter. No matching branch returns exit code
2. An authentication or network failure is not proof that the branch is absent.
Only when the branch is absent, a human copies the upstream starter:

```bash
git fetch https://github.com/RyanLisse/sre-oncall-agent.git workshop/start
git push learner FETCH_HEAD:refs/heads/workshop/start
git ls-remote --exit-code learner refs/heads/workshop/start
```

Stop if the fetch or push fails. Never force-push or replace an existing
starter. Confirm GitHub Actions is enabled and permitted for the learner
repository. If you cannot provision the branch or run the required workflow,
record `RELEASE BLOCKED`; do not skip the job or remove protection.

### Publish the reviewed exercise

```bash
git push learner workshop-base
git push -u learner fix/w5-core
```

In the learner repository, create a PR or MR with base `workshop-base` and
head `fix/w5-core`. Do not target the solved upstream `main`; that would hide
the repair's net code diff. Include the accepted intent, the change, actual
check results, risks and untested paths in the description.

Wait for current-head CI and the required human review. A human merges only
when those gates pass. Record the PR and merge commit in your evidence note.
After the decision, publish the final evidence as a comment on that PR or MR:
the observed CI/review status, actual merge commit or blocker, runtime
observation and reviewed next task. These post-release observations were not
part of the earlier commit; do not claim they were. If you cannot post, keep
the local note and record that publication is blocked.
When working solo, review your own diff in a separate pass and record that
limitation. If policy requires another reviewer, wait for that person.
Do not disable protection to finish the exercise.

If you cannot publish, prepare the PR text and record `RELEASE BLOCKED` with
the missing permission or reviewer. You can still observe the local lab as
a development test. Do not claim that a local reload or console rollback is
a code release. Production deployment is outside this workshop.
