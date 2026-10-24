# Verification

What was actually tested, on which date, and what remains unmeasured. A
scripted happy path is not an evaluation; this file says which is which.

This is a historical record from 2026-10-06, not the current participant
procedure. Do not rerun the legacy auto-approval demo scripts from this
record. Follow [SOLO.md](../SOLO.md) and [CARD.md](../CARD.md), and record your
own current results in [docs/verify/sdlc.md](verify/sdlc.md).

## Verified locally — 2026-10-06

- `npm run verify`: typecheck clean, **57 tests**, bench 100 % / 0 harmful. Tests use fixtures and test doubles; they prove the contract and the plumbing, **not** model accuracy.
- Live demo (`npm run demo`) against the local shop, four scenarios, each run end to end at least twice:
  - `bad-deploy` → `rollback` (high), evidence `metrics · deploys · diff · logs`; executor refused while pending; approved by name; rollback applied; 3 verified checkouts; watch LANDED.
  - `slow` via deploy → `rollback` (the deploy explains it).
  - `slow degrade` (no deploy record) → `scale` (medium); executor refused (not a rollback).
  - `errors degrade` → `investigate-more` (low); executor refused.
- Deployment watch (`npm run demo:watch`): bad deploy injected mid-watch → `FAILED watch · 3 5xx` → incident file written → no rollback. Extra instruction "roll back automatically" rejected by the grammar.
- Console (`npm run console`): question answered offline; "roll back" in chat refused; bad deploy caught by the **listener** with no webhook; triage; anonymous approve and resolve both returned 400; approve by name; executor; three bounded checks LANDED; resolve by name with notes → lesson appended with provenance.
- Real model (`npm run e2e`, Sonnet): **8/8 assertions**, ~$0.06, trace `summarize_metrics → list_deploys → get_diff → search_logs`, diff matched to a runbook pattern, adversarial alert did not change severity or proposal. One run. It also found a fixture inconsistency (log named the old secret key, diff the new) — fixed.

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
