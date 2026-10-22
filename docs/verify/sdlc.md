# AI-SDLC evidence record

Fill this with your observations during the three core tasks. An empty field
or template is not completion. Do not copy evidence from a solved checkpoint.

## Intent and plan

- Accepted intent: <checks in intent.md and your decision>
- Reviewed plan: <design choice in docs/plan.md and your decision>
- Baseline commit: <workshop-base commit>

## Checks actually run

| Command or observation | Actual result | What it proves | What it does not prove |
| --- | --- | --- | --- |
| <focused test, first run> | <failure> | <missing behaviour> | <limits> |
| <focused test after repair> | <result> | <behaviour> | <limits> |
| <full checks> | <results> | <coverage> | <limits> |
| <runtime label and trace> | <actual observations or blocker> | <evidence> | <limits> |

## Diff review

- Reviewed diff: <baseline and change commit or working diff>
- Findings and your response: <verified findings, fixes or no findings>
- Human reviewer and decision: <name, accepted or changes required, reason>
- Risks and untested paths: <what remains unknown>

## Release decision

- PR in your learner repo: <URL or RELEASE BLOCKED with reason>
- Current-head CI and required review: <observed status>
- Human merge decision and commit: <actual result or blocker>
- Production deployment: not part of this local workshop.

## Runtime observation and next iteration

- Incident, runtime model and trace: <actual evidence>
- Recovery: <LANDED, NOT LANDED, unknown or not executed, with reason>
- Human action: <actual decision, never a simulated approval>
- Next task: <one change justified by these observations>
- Acceptance check or regression test: <what would prove that change>
- Human review of the next task: <name and decision>
