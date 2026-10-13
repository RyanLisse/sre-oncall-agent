import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, draftApproval, isApproved } from "../src/approval.js";
import type { Recommendation } from "../src/contract.js";

const rec: Recommendation = {
  incident_id: "INC-1",
  tag: "bad-deploy",
  severity: "page",
  confidence: "high",
  hypothesis: "h",
  customer_impact: "ci",
  evidence: [{ source: "metrics", ref: "t", note: "n" }, { source: "deploys", ref: "d", note: "n" }],
  blast_radius: "b",
  proposal: "rollback",
  ruled_out: [],
  would_change_my_mind: "w",
  data_gaps: [],
  watch_metric: "error_rate",
  draft_only: true,
  human_approval_required: true,
  owner: "Deploy owner (approves and runs the rollback)",
};

test("a drafted approval is pending and not approved", () => {
  const a = draftApproval(rec, "t0");
  assert.equal(a.decision, "pending");
  assert.equal(isApproved(a, "INC-1", "rollback"), false);
});

test("a named human can approve once", () => {
  const a = draftApproval(rec, "t0");
  const s = decide(a, "approved", "ryan", "t1");
  assert.equal(s.ok, true);
  if (!s.ok) return;
  assert.equal(isApproved(s.value, "INC-1", "rollback"), true);
  assert.equal(isApproved(s.value, "INC-1", "scale"), false, "approval is for one proposal");
  assert.equal(isApproved(s.value, "INC-2", "rollback"), false, "approval is for one incident");
  assert.equal(decide(s.value, "rejected", "someone", "t2").ok, false, "cannot re-decide");
});

test("an anonymous approval is refused", () => {
  assert.equal(decide(draftApproval(rec, "t0"), "approved", "  ", "t1").ok, false);
});
