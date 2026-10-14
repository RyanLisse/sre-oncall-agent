# Intent — on-call first responder (Workshop 5 lab)

## Problem
<fill in: in one or two sentences, what goes wrong today when the alert fires
that this agent helps with — e.g. the first responder spends the first ten
minutes gathering the same four pieces of telemetry>

## Proposed outcome
<fill in: what the agent delivers — e.g. within a minute of an alert, a
diagnosis that cites real telemetry evidence and ONE proposed next step a
named human can approve or reject>

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

## Open questions
<fill in — e.g. how long should evidence stay valid before a re-check?>
