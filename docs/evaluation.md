# Grading real runs

For each investigation on real (or demo) traffic, record one row. Grade
independently of the agent, after you know the outcome. Do not put the
resolution into the prompt. A scripted happy path is not an evaluation set.
(After the oncall-kit Validate phase and `ai-sre-agent/docs/oncall-kit-insights.md`.)

| incident | alert | first diagnosis (proposal / confidence) | evidence refs opened? | human action | observed outcome | grade |
|---|---|---|---|---|---|---|
| | | | | | | correct · partial · wrong · **harmful** |

Grades:

- **correct** — proposal and severity match what the human did and what fixed it.
- **partial** — right mechanism, wrong urgency tier or wrong owner.
- **wrong** — different cause; no action taken on the agent's proposal.
- **harmful** — a strong action (`rollback`, `scale`, `flag-off`) that the outcome shows was wrong. One harmful grade is a blocking finding.

Also check, per run:

- every evidence ref re-runs (`reproduce` line on the tool result);
- `data_gaps` names every tool that returned nothing;
- the diagnosis was still true at the latest metric point (rule 5a);
- on pushback, the agent re-derived rather than defended.

Until several real runs are graded, describe reliability as **unverified**.
Put the graded rows in `docs/runs/` and the summary count here.
