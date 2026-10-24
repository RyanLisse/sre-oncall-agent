# Plan — <fill in: the change you are building>

Complete this in Core 2 before code edits. Keep the existing diagnosis
contract in `docs/spec.md`. Review a separate plan for the human gate before
the second repair.

## Accepted intent and boundary

- <link the acceptance checks in intent.md>
- <name the files in scope, read-only boundary and stop point>

## Steps
1. <fill in — smallest first, each ends in a verifiable state>

## Checks
- Core 2: the focused tools test, typecheck and bench pass after the tool
  repair. After the gate repair, the focused executor test, `npm run verify`,
  `npm run test:workshop` and `npm run test:hooks` pass.
- Record actual commands and outcomes in `docs/verify/sdlc.md`.

## Rejected alternatives
- <fill in — what you did not do and why>

## Risks and human plan review

- Risk and check: <what could go wrong and how you will detect it>
- Reviewer and decision: <human name, accepted scope or requested changes>
- Claude's stop point: <when to return for human review>
