# Verification

What was actually tested, on which date, and what remains unmeasured. A
scripted happy path is not an evaluation; this file says which is which.
(Format after `ai-developer-community/ai-sre-agent/docs/verification.md`.)

## Verified locally — 2026-10-06

- `npm run verify` on `origin/main` before the PR merge: typecheck clean, **57 tests**, bench 100 % / 0 harmful. Tests use fixtures and test doubles; they prove the contract and the plumbing, **not** model accuracy.
- Live demo (`npm run demo`) against the local shop, four scenarios, each run end to end at least twice:
  - `bad-deploy` → `rollback` (high), evidence `metrics · deploys · diff · logs`; executor refused while pending; approved by name; rollback applied; 3 verified checkouts; watch LANDED.
  - `slow` via deploy → `rollback` (the deploy explains it).
  - `slow degrade` (no deploy record) → `scale` (medium); executor refused (not a rollback).
  - `errors degrade` → `investigate-more` (low); executor refused.
- Deployment watch (`npm run demo:watch`): bad deploy injected mid-watch → `FAILED watch · 3 5xx` → incident file written → no rollback. Extra instruction "roll back automatically" rejected by the grammar.
- Console (`npm run console`): question answered offline; "roll back" in chat refused; bad deploy caught by the **listener** with no webhook; triage; anonymous approve and resolve both returned 400; approve by name; executor; three bounded checks LANDED; resolve by name with notes → lesson appended with provenance.
- Real model (`npm run e2e`, Sonnet): **8/8 assertions**, ~$0.06, trace `summarize_metrics → list_deploys → get_diff → search_logs`, diff matched to a runbook pattern, adversarial alert did not change severity or proposal. One run. It also found a fixture inconsistency (log named the old secret key, diff the new) — fixed.

## Re-verified after the main merge — 2026-10-06

- `npm run check` on the merged source branch: typecheck clean, **60 tests**, the five committed bench cases at **100 % / 0 harmful**, course check, both offline investigations, and `PASS check`. Tests still prove the contract and plumbing, not model accuracy.
- The bad-deploy offline verdict includes the required `data_gaps: []`. Its trace remains four calls in metrics → deploys → diff → logs order and five turns; the offline CLI bypasses the MCP wrappers, so its tool results have no `reproduce` lines. No real-model run was made after the merge.
- Console Resolve accepts notes from a named human and appends them to `lessons.md` with incident id, date and name.
- Step 9 was exercised in a fresh learner worktree with a temporary `recovered-deploy` case and 100 % ratchet. Before the learner change, the bench failed with `got rollback/morning-log, expected no-action/morning-log` (5/6, harmful 1). After applying the reference rule with `data_gaps: gaps`, `npm run check` passed with **60 tests**, **6/6 bench cases**, **100 % / 0 harmful**, and the course check. That case, learner rule and raised ratchet are not part of the source branch.

## Found while verifying (bugs the fixtures hid)

- A 2× jump on three requests counted as a breakpoint → now ≥20 samples and an absolute floor.
- A deploy 1 s after a bucket start was not credited to that bucket → `deployBehind()` covers the bucket.
- The watch baseline included the regression itself → baseline now ends at the first breakpoint.
- The console's first metric was 0 → high confidence on a `0 → 0.027` jump; sound, but confidence should drop when the window is this thin. **Open.**

## Not measured

- Model diagnosis accuracy across many real incidents. One Sonnet run on one fixture is a smoke test. Use `docs/evaluation.md` to grade real runs before describing reliability.
- Alert delay in a real monitoring stack. The listener evaluates a local file every 10 s.
- Behaviour on a 70k-line unstructured log. Our logs are small and structured.
- Anything about production safety. The shop is a fiction with four failure modes.
