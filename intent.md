# Intent — on-call first responder (Workshop 5 lab)

## Problem
When the checkout alert fires, the first responder spends the first ten
minutes gathering the same four pieces of telemetry — metrics summary, recent
deploys, the diff, error logs — before any diagnosis can start.

## Proposed outcome
Within a minute of an alert, a diagnosis that cites real telemetry evidence
and ONE proposed next step a named human can approve or reject.

## Affected users and systems
- **Serves:** the on-call engineer for the demo checkout service
  (`npm run shop` + the console at `localhost:4320`).
- **Reads:** telemetry fixtures / live telemetry, lessons, deploy history.
- **Never writes:** production state — no rollback, scale, flag-off, page, or
  incident close. Mutations are a separate system behind a named approval.
- **Boundary:** propose, don't act; humans close; every claim carries a ref.

## Constraints
- Offline: the scripted runtime (`src/runtime.ts`) needs no API key; a real
  model is optional.
- The agent never executes; the executor is a separate program that
  recomputes the target from telemetry.
- Chat is a grammar: mutations in chat are refused and routed to buttons.

## Three checks a stranger can verify
1. Chat refuses "roll back now" and points at the Approve button.
2. A verdict without evidence refs is rejected by the contract.
3. The executor refuses to run without a named approval for this incident.

## Open questions
- How long should evidence stay valid before a re-check is owed?
