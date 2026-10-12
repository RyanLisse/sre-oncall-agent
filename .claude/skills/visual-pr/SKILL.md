---
name: visual-pr
description: Only use when the user explicitly invokes this skill by name. Writes a concise visual PR/MR description for reviewers to a local file; a human publishes it.
disable-model-invocation: true
---

<!-- Lab adaptation of humanlayer/skills plugins/visual-pr @653b641 (MIT, see LICENSE-humanlayer.txt).
     Changes for this lab: no gh, no commit/push/PR creation by the agent, works for GitHub (PR) and GitLab (MR),
     output to docs/pr/ instead of .humanlayer/tasks/, no cloud permalink. The template and show-me references are verbatim. -->

# Describe a pull request / merge request (lab version)

Write a concise description that helps a reviewer understand why the change exists and the shape of the implementation. You only write the file. A named human publishes it after the approval gate.

## Workflow

1. Read the description template: `Read({SKILLBASE}/references/pr_description_template.md)`.
2. Gather only the context needed, locally:
   - `git status --short --branch`, `git log main..HEAD --oneline`, `git diff main...HEAD`.
   - The diagnosis (the console incident detail, or `docs/diagnosis-live.md`), the lesson it cites, and `REVIEW.md`.
   - Read `{SKILLBASE}/references/show-me.md` for the visual-outline conventions.
   Do not call `gh`, `glab` or any network tool.
3. Write the description using the template:
   - **Why the change**: exactly one sentence.
   - **Special things to note**: 1–3 bullets. Always include the approval status from `approvals/approvals.jsonl` (approved by <name>, or "awaiting named approval") and the eval result.
   - **Change outline**: a compact `/show-me`-style view (for a config fix: a `diff` block of `config/prod.env` plus a call/flow sketch of why it fixes the incident). Omit views that did not change.
   - Header links: the incident id and diagnosis file, if present.
4. Save to `docs/pr/<branch-with-slashes-replaced-by-dashes>.md`. Do not commit, push, or open a PR/MR.
5. Report: the saved path, a 2-sentence summary, and the exact commands the **human** runs after approval:
   - GitHub (PR): `gh pr create --title "<title>" --body-file docs/pr/<file>.md` (existing PR: `gh pr edit <number> --body-file docs/pr/<file>.md`)
   - GitLab (MR), bash: `glab mr create --title "<title>" --description "$(cat docs/pr/<file>.md)"`; PowerShell: `glab mr create --title "<title>" --description (Get-Content -Raw docs/pr/<file>.md)`

Write as one human talking to another: avoid jargon and slang, and use simple, coherent, concise language.
