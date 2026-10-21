import assert from "node:assert/strict";
import { test } from "node:test";
import { captureRecoveryCheck, completedRecovery, incidentActions, recoveryFrom, type Recovery } from "../src/recovery.js";
import { loadTelemetry } from "../src/telemetry.js";
import type { IncidentRow, MessageRow } from "../src/store.js";
import { watchMetric, type WatchReport } from "../src/watch.js";

const incident: IncidentRow = { id: "INC-1", title: "Checkout", source: "human", state: "active", created_at: "t", updated_at: "t", incident_json: null };
const message = (kind: MessageRow["kind"], value: unknown): MessageRow => ({ id: 1, incident_id: incident.id, role: "system", kind, text: JSON.stringify(value), at: "t" });
const records = (decision: string, recovery?: Recovery) => [
  message("diagnosis", { proposal: "rollback" }), message("approval", { decision }),
  ...(recovery ? [message("recovery", recovery)] : []),
];
const report = (landed: boolean): WatchReport => ({ metric: "error_rate", baseline: 0, limit: 0.005,
  checks: [{ label: "full", at: "t", value: landed ? 0 : 0.0125, ok: landed }, { label: "double", at: "t", value: 0, ok: true }], landed, message: landed ? "LANDED" : "NOT LANDED" });
const completed = (landed: boolean) => { const r = report(landed); return completedRecovery(r, r.checks); };

test("approval, execution, recovery, mitigation and resolution are separate steps", () => {
  const pending = incidentActions(incident, records("pending"));
  assert.equal(pending.canDecide, true);
  assert.equal(pending.canExecute, false);
  assert.equal(pending.canMitigate, false);
  assert.equal(incidentActions(incident, records("approved")).canExecute, true);
  const landed = records("approved", completed(true));
  const recovered = incidentActions(incident, landed);
  assert.equal(recovered.canExecute, false);
  assert.equal(recovered.canMitigate, true);
  assert.equal(recovered.canResolve, false);
  assert.equal(incidentActions({ ...incident, state: "mitigated" }, landed).canResolve, true);
  const resolved = incidentActions({ ...incident, state: "resolved" }, landed);
  assert.deepEqual([resolved.canDecide, resolved.canExecute, resolved.canMitigate, resolved.canResolve], [false, false, false, false]);
  assert.match(resolved.next, /Resolved/);
});

test("in-flight, failed, interrupted and malformed recovery never authorize retry or closure", () => {
  for (const recovery of [{ status: "running" } as const, { status: "blocked", reason: "Interrupted" } as const, completed(false)]) {
    const actions = incidentActions(incident, records("approved", recovery));
    assert.deepEqual([actions.canExecute, actions.canMitigate, actions.canResolve], [false, false, false]);
  }
  const failed = incidentActions(incident, records("approved", completed(false)));
  assert.match(failed.next, /NOT LANDED/);
  assert.equal(failed.recovery.status === "complete" && failed.recovery.report.checks[0]?.value, 0.0125);
  assert.equal(recoveryFrom([message("recovery", { status: "complete" })]).status, "blocked");
  assert.equal(recoveryFrom([message("executor", "historical execution")]).status, "blocked");
});

test("later bucket revisions cannot turn an observed full-check failure into recovery", async () => {
  const loaded = await loadTelemetry("fixtures/telemetry/after-rollback.json");
  assert.ok(loaded.ok);
  const incidentAt = "2026-10-05T03:45:00Z", fixAt = "2026-10-05T03:52:00Z";
  const fullAt = "2026-10-05T03:56:00.000Z";
  const initial = watchMetric(loaded.value, "p95_ms", incidentAt, fixAt);
  const fullSnapshot = { ...loaded.value, metrics: loaded.value.metrics
    .filter((p) => Date.parse(p.ts) <= Date.parse(fullAt))
    .map((p) => Date.parse(p.ts) === Date.parse(fullAt) ? { ...p, p95_ms: 900 } : p) };
  const atFull = watchMetric(fullSnapshot, "p95_ms", incidentAt, fixAt);
  const full = captureRecoveryCheck(atFull, "full", initial.limit);
  assert.ok(full);
  assert.equal(full.value, 900);
  assert.equal(full.ok, false);
  const revised = watchMetric(loaded.value, "p95_ms", incidentAt, fixAt);
  assert.equal(revised.landed, true, "retrospective calculation now calls full passing");
  const half = captureRecoveryCheck(atFull, "half", initial.limit);
  const double = captureRecoveryCheck(revised, "double", initial.limit);
  assert.ok(half && double);
  const final = completedRecovery(initial, [half, full, double]);
  assert.equal(final.status, "complete");
  if (final.status !== "complete") return;
  assert.equal(final.report.landed, false);
  assert.equal(final.report.checks[1]?.value, 900);
  assert.equal(final.report.limit, initial.limit);
  assert.equal(incidentActions(incident, records("approved", final)).canMitigate, false);
  assert.equal(incidentActions({ ...incident, state: "mitigated" }, records("approved", final)).canResolve, false);
  const incomplete = completedRecovery(initial, [double]);
  assert.equal(incomplete.status === "complete" && incomplete.report.landed, false);
});
