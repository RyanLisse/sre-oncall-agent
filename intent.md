# Intent template for the Workshop 5 change

Complete this in Core 1. Ask Claude Code to draft from the observed evidence,
then review and accept the intent yourself before planning the code change.

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
- The Agent SDK uses `sonnet` by default and needs API/provider access.
  Explicit offline mode is scripted integration evidence, not model evidence.
- The agent never executes; the executor is a separate program that
  recomputes the target from telemetry.
- Chat is a grammar: mutations in chat are refused and routed to buttons.

## Open questions
<fill in — e.g. how long should evidence stay valid before a re-check?>

## Acceptance checks

Replace these examples with your accepted checks and their evidence source:

- With deployment data present, the read-only tool returns the matching
  deployments in newest-first order. Name the focused test that proves it.
- With deployment data missing, the diagnosis states a gap rather than
  inventing a deploy reference. Keep the actual trace for this check.
- Without a valid named-human approval for this incident and proposal,
  the executor refuses the action. Name the gate test that proves it.

## Human acceptance

- Reviewer: <your name>
- Decision and reason: <accepted scope or changes required>
- Evidence still missing: <what must be checked before release>
