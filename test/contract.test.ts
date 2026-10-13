import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIncident, parseVerdict } from "../src/contract.js";

const base = {
  incident_id: "INC-1",
  tag: "bad-deploy",
  severity: "page",
  confidence: "high",
  hypothesis: "x",
  customer_impact: "ci",
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

test("a complete verdict passes", () => {
  assert.equal(parseVerdict(base).ok, true);
});

test("rollback needs a deploys evidence line", () => {
  const r = parseVerdict({ ...base, evidence: [{ source: "metrics", ref: "t1", note: "n" }, { source: "logs", ref: "t2", note: "n" }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /rollback requires a deploys/);
});

test("one signal is a hunch: strong proposals need two sources", () => {
  const r = parseVerdict({ ...base, proposal: "scale", evidence: [{ source: "metrics", ref: "t1", note: "n" }] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /at least 2 sources/);
});

test("low confidence cannot carry a strong proposal", () => {
  const r = parseVerdict({ ...base, confidence: "low" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /low confidence/);
});

test("safety flags must be literally true", () => {
  assert.equal(parseVerdict({ ...base, draft_only: false }).ok, false);
  assert.equal(parseVerdict({ ...base, human_approval_required: "yes" }).ok, false);
});

test("unknown fields are rejected, not ignored", () => {
  assert.equal(parseVerdict({ ...base, executed: true }).ok, false);
});

test("empty evidence is rejected", () => {
  assert.equal(parseVerdict({ ...base, evidence: [] }).ok, false);
});

test("incident ids and timestamps are validated", () => {
  assert.equal(parseIncident({ incident_id: "INC-9", service: "s", alert: "a", fired_at: "2026-10-05T03:00:00Z" }).ok, true);
  const r = parseIncident({ incident_id: "9", service: "", alert: "a", fired_at: "now", extra: 1 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.length, 4);
});

test("high confidence is refused while data gaps exist", () => {
  const r = parseVerdict({ ...base, data_gaps: ["search_logs: returned nothing"] });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors.join(), /missing signal is unknown/);
  assert.equal(parseVerdict({ ...base, confidence: "medium", data_gaps: ["search_logs: returned nothing"] }).ok, true);
});
