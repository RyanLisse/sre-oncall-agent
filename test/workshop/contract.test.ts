// Workshop A3 — the contract: verdict claims need evidence refs, and the
// verdict carries a customer_impact field. Red on workshop/start; rebuild in
// src/contract.ts until this file is green.
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseVerdict } from "../../src/contract.js";

const base = {
  incident_id: "INC-1",
  tag: "bad-deploy",
  severity: "page",
  confidence: "high",
  hypothesis: "x",
  customer_impact: "checkout fails for paying customers",
  evidence: [
    { source: "metrics", ref: "t1", note: "n" },
    { source: "deploys", ref: "d-1", note: "n" },
  ],
  blast_radius: "all",
  proposal: "rollback",
  ruled_out: [],
  would_change_my_mind: "y",
  data_gaps: [],
  watch_metric: "error_rate",
  draft_only: true,
  human_approval_required: true,
};

test("A3: a complete verdict with customer_impact passes", () => {
  assert.equal(parseVerdict(base).ok, true);
});

test("A3: customer_impact is required and non-empty", () => {
  const { customer_impact: _omit, ...rest } = base;
  assert.equal(parseVerdict(rest).ok, false, "verdict without customer_impact must be rejected");
  const r = parseVerdict({ ...base, customer_impact: "" });
  assert.equal(r.ok, false, "empty customer_impact must be rejected");
});

test("A3: rollback needs a deploys evidence line", () => {
  const r = parseVerdict({ ...base, evidence: [{ source: "metrics", ref: "t1", note: "n" }, { source: "logs", ref: "t2", note: "n" }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /rollback requires a deploys/);
});

test("A3: one signal is a hunch — strong proposals need two sources", () => {
  const r = parseVerdict({ ...base, proposal: "scale", evidence: [{ source: "metrics", ref: "t1", note: "n" }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /at least 2 sources/);
});

test("A3: low confidence cannot carry a strong proposal", () => {
  const r = parseVerdict({ ...base, confidence: "low" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /low confidence/);
});

test("A3: evidence has to carry at least one line", () => {
  assert.equal(parseVerdict({ ...base, evidence: [] }).ok, false);
});

test("A3: a missing signal is unknown, not healthy — high confidence refused while data_gaps exist", () => {
  const r = parseVerdict({ ...base, data_gaps: ["logs"] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /data_gaps/);
});
