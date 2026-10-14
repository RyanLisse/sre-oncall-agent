# Review checklist — the controls this repo teaches

Run this top-to-bottom before pushing a `fix/*` branch. Each item names the
check and where it fails if broken. `npm run verify` covers 1–5 and 7.

1. **Propose, don't act.** No mutating tool in `src/tools.ts`; mutations live
   only in `src/executor.ts`, a separate program that never reads model text.
2. **Every claim carries a ref.** `parseVerdict` rejects verdicts without
   evidence lines; `checkTrace` requires the tools behind each cited source.
   Tested in `test/workshop/contract.test.ts`.
3. **A missing signal is unknown, not healthy.** `high` confidence is refused
   while `data_gaps` is non-empty.
4. **Customer impact is part of the contract.** Every verdict must state
   `customer_impact`; the console renders it.
5. **Chat is a grammar, not a model.** `routeMessage` refuses mutations; watch
   is a fixed grammar; questions go to the agent. Tested in
   `test/workshop/chat.test.ts`.
6. **The gate is a signed approval.** `checkApproval` verifies the record is
   for this incident + `rollback` and signed by a named human. The git push of
   a `fix/*` branch is separately gated by `approvals/approvals.jsonl`
   (`npm run approve:git` in a human terminal — never inside the agent).
   Tested in `test/workshop/executor.test.ts` + `test/hooks.test.mjs`.
7. **The ratchet only goes up.** `bench/ratchet.json` can only rise;
   `bench/cases.json` is human-edited; the agent can never edit either
   (guard hook).
8. **Detection is deterministic.** The console listener in
   `console/server.ts` uses fixed criteria; nothing routes detection through
   the model.
