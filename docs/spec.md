# Spec — the diagnosis contract (A3)

<fill in as part of A3: the verdict shape the console and the executor rely on>

## Verdict contract

Every diagnosis is one JSON object (`src/contract.ts` `parseVerdict`):

| field | rule |
|---|---|
| `incident_id` | the alert's id |
| `hypothesis` | one sentence, must cite evidence |
| `customer_impact` | one sentence — what users see, or "none observed" |
| `evidence[]` | ≥1 line; `{source, ref, note}`; rollback needs a `deploys` line |
| `blast_radius` | free text |
| `proposal` | one of the PROPOSALS enum |
| `ruled_out[]` | hypotheses rejected with reason |
| `would_change_my_mind` | the signal that would flip the verdict |
| `data_gaps[]` | signals the tools did not answer |
| `watch_metric` | the metric to watch after the fix |
| `confidence` | low/medium/high — `high` refused while data_gaps exist |
| `draft_only`, `human_approval_required` | literal `true` |

## Rules worth writing down
- <fill in>
