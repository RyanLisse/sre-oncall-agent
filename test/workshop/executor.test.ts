// Workshop A8 — the gate: the executor refuses to act without a NAMED approval
// for this incident and this proposal. Red on workshop/start; rebuild in
// src/executor.ts checkApproval.
import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, draftApproval } from "../../src/approval.js";
import type { Incident, Recommendation } from "../../src/contract.js";
import { checkApproval } from "../../src/executor.js";

const incident: Incident = { incident_id: "INC-1001", service: "checkout", alert: "x", fired_at: "2026-10-05T03:50:00Z" };
const rec = (proposal: Recommendation["proposal"]): Recommendation => ({
  incident_id: "INC-1001", tag: "bad-deploy", severity: "page", confidence: "high", hypothesis: "h",
  customer_impact: "failed checkouts", evidence: [{ source: "metrics", ref: "t", note: "n" }, { source: "deploys", ref: "d", note: "n" }],
  blast_radius: "b", proposal, ruled_out: [], would_change_my_mind: "w", data_gaps: [], watch_metric: "error_rate",
  draft_only: true, human_approval_required: true, owner: "Deploy owner (approves and runs the rollback)",
} as Recommendation);

test("A8: a pending (undecided) approval does not execute", () => {
  assert.equal(checkApproval(draftApproval(rec("rollback"), "t0"), incident).ok, false);
});

test("A8: an approval for the wrong proposal does not execute", () => {
  const a = decide(draftApproval(rec("scale"), "t0"), "approved", "ryan", "t1");
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(checkApproval(a.value, incident).ok, false);
});

test("A8: an empty name is not an approval", () => {
  assert.equal(decide(draftApproval(rec("rollback"), "t0"), "approved", "  ", "t1").ok, false);
});

test("A8: a NAMED approval for this incident + proposal executes", () => {
  const a = decide(draftApproval(rec("rollback"), "t0"), "approved", "ryan", "t1");
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(checkApproval(a.value, incident).ok, true);
});

test("A8: an approval for a different incident does not execute", () => {
  const other: Incident = { ...incident, incident_id: "INC-9999" };
  const a = decide(draftApproval(rec("rollback"), "t0"), "approved", "ryan", "t1");
  assert.equal(a.ok, true);
  if (a.ok) assert.equal(checkApproval(a.value, other).ok, false);
});
