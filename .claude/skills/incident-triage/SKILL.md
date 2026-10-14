---
name: incident-triage
description: The standing triage policy for the on-call agent — gather evidence before theory, cite every claim, propose one fix, never mutate. Use when investigating an alert or reviewing a diagnosis.
---

# Incident triage policy

The policy the investigator follows lives in `skills/triage/SKILL.md` in this
repository (same directory as this skill, one level up in `skills/`). Read it
and apply it: evidence before theory, two sources for a strong proposal, every
claim carries a ref (`logs:<ts>`, `metrics:<ts>`, `deploys:<id>`,
`lessons:<id>`), data gaps are stated, humans decide.

This `.claude/skills/` copy exists so Claude Code discovers the policy by name;
the canonical text stays in `skills/triage/SKILL.md` next to `src/prompts.ts`,
which mirrors it into the agent's system prompt.
