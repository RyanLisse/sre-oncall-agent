import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, draftApproval } from "../src/approval.js";
import type { Incident, Recommendation } from "../src/contract.js";
import { checkApproval, planRollback } from "../src/executor.js";
import { loadTelemetry } from "../src/telemetry.js";

const incident: Incident = { incident_id: "INC-1001", service: "checkout", alert: "x", fired_at: "2026-10-05T03:50:00Z" };
const rec = (proposal: Recommendation["proposal"]): Recommendation => ({
  incident_id: "INC-1001", tag: "bad-deploy", severity: "page", confidence: "high", hypothesis: "h",
  evidence: [{ source: "metrics", ref: "t", note: "n" }, { source: "deploys", ref: "d", note: "n" }],
  blast_radius: "b", proposal, ruled_out: [], would_change_my_mind: "w", data_gaps: [], watch_metric: "error_rate",
  draft_only: true, human_approval_required: true, owner: "Deploy owner (approves and runs the rollback)",
});

test("the rollback target is recomputed from telemetry, not taken from the model", async () => {
  const t = await loadTelemetry("fixtures/telemetry/bad-deploy.json");
  if (!t.ok) throw new Error();
  const p = planRollback(incident, t.value);
  assert.equal(p.ok, true);
  if (p.ok) assert.deepEqual(p.value, { incident_id: "INC-1001", blamed_deploy: "d-4821", from_version: "v2.15.0", to_version: "v2.14.0" });
});

test("no deploy behind the breakpoint → the executor refuses", async () => {
  const t = await loadTelemetry("fixtures/telemetry/slow-dependency.json");
  if (!t.ok) throw new Error();
  const p = planRollback({ ...incident, fired_at: "2026-10-05T03:43:00Z" }, t.value);
  assert.equal(p.ok, false);
});

