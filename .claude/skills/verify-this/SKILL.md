---
name: verify-this
description: "Prove or disprove a claim with fresh local evidence. Use when the user says verify this, prove it works, did this fix it, or show evidence."
argument-hint: "[claim]"
disable-model-invocation: true
---

# Verify this

Verification is not a recap. Prove or disprove a specific claim with repeatable evidence.

Claim: $ARGUMENTS

## When to use

- Bug fix needs before/after repro
- UI, CLI, API, perf, or memory claim needs measurement
- Tests pass but user-visible behavior still needs confirmation

If the claim is vague ("cleaner code"), ask for a measurable claim first.

## Workflow

1. Restate the claim falsifiably: condition, metric, threshold.
2. Pick the smallest local surface that can disprove it.
3. Capture **baseline** (old/broken state) and **treatment** (changed state) with the same command, data, and environment.
4. Compare raw artifacts (numbers, screenshots, transcripts, HTTP, profiles, test output).
5. Return exactly one verdict: `VERIFIED`, `NOT VERIFIED`, or `INCONCLUSIVE`.

## Artifacts (when safe)

```text
docs/verify/<claim-slug>/
├── claim.md
├── baseline/
├── treatment/
├── diff/
└── verdict.md
```

Omit sensitive bodies unless the user agrees to disk storage.

## Verdict rules

- **VERIFIED** — predicted direction and threshold met; no obvious confound
- **NOT VERIFIED** — unchanged, wrong direction, or misses threshold
- **INCONCLUSIVE** — bad baseline, noise, failed measurement, or env mismatch

## Output

```text
VERIFIED | NOT VERIFIED | INCONCLUSIVE
Claim: <falsifiable claim>

Evidence:
<metric>: baseline=<...>, treatment=<...>, delta=<...>, threshold=<...>

Reasoning:
<one tight paragraph>
```

Do not soften a negative result.
