# Diagnosis contract

Use this reference when reviewing the Core 2 plan. The implementation is
`src/contract.ts`; the behavioral examples are in `test/contract.test.ts`.
The optional A3 exercise extends your understanding of these rules, not the
permissions of the agent.

## Verdict contract

Every diagnosis is one JSON object (`src/contract.ts` `parseVerdict`):

| field | rule |
|---|---|
| `incident_id` | the alert's id |
| `hypothesis` | non-empty text, supported by the separate evidence entries |
| `customer_impact` | one sentence — what users see, or "none observed" |
| `evidence[]` | ≥1 line; `{source, ref, note}`; rollback needs a `deploys` line |
| `blast_radius` | free text |
| `tag` | `bad-deploy`, `latency`, `errors`, or `noise` |
| `severity` | `page` or `morning-log` |
| `proposal` | one of the PROPOSALS enum |
| `ruled_out[]` | hypotheses rejected with reason |
| `would_change_my_mind` | the signal that would flip the verdict |
| `data_gaps[]` | signals the tools did not answer |
| `watch_metric` | the metric to watch after the fix |
| `confidence` | low/medium/high — `high` refused while data_gaps exist |
| `draft_only`, `human_approval_required` | literal `true` |

## Evidence and safety rules

- `parseVerdict` rejects unknown fields and missing required fields.
- Every verdict needs at least one evidence entry. An action proposal other
  than `investigate-more` or `no-action` needs at least two evidence sources.
- A rollback proposal requires a `deploys` evidence entry.
- A verdict with data gaps cannot claim high confidence.
- `checkTrace` requires calls to both `summarize_metrics` and `list_deploys`.
  An empty tool result is a gap, not permission to omit the call or invent data.
- The verdict remains a draft that requires human approval. It does not
  authorize execution or close an incident.

Parsing checks structure and the rules above. It does not prove a citation
is true, prove a causal explanation, or replace human review of the telemetry
and tool trace. Keep those checks in your intent and evidence record.
