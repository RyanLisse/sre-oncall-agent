import assert from "node:assert/strict";
import { test } from "node:test";
import { completedRecovery, incidentActions, recoveryFrom, type Recovery } from "../src/recovery.js";
import type { IncidentRow, MessageRow } from "../src/store.js";
import type { WatchReport } from "../src/watch.js";

const incident: IncidentRow = { id: "INC-1", title: "Checkout", source: "human", state: "active", created_at: "t", updated_at: "t", incident_json: null };
const message = (kind: MessageRow["kind"], value: unknown): MessageRow => ({ id: 1, incident_id: incident.id, role: "system", kind, text: JSON.stringify(value), at: "t" });
const records = (decision: string, recovery?: Recovery) => [
  message("diagnosis", { proposal: "rollback" }), message("approval", { decision }),
  ...(recovery ? [message("recovery", recovery)] : []),
];
const report = (landed: boolean): WatchReport => ({ metric: "error_rate", baseline: 0, limit: 0.005,
  checks: [{ label: "full", at: "t", value: landed ? 0 : 0.0125, ok: landed }, { label: "double", at: "t", value: 0, ok: true }], landed, message: landed ? "LANDED" : "NOT LANDED" });

test("approval, execution, recovery, mitigation and resolution are separate steps", () => {
  const pending = incidentActions(incident, records("pending"));
  assert.equal(pending.canDecide, true);
  assert.equal(pending.canExecute, false);
  assert.equal(pending.canMitigate, false);
  assert.equal(incidentActions(incident, records("approved")).canExecute, true);
  const landed = records("approved", completedRecovery(report(true)));
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
  for (const recovery of [{ status: "running" } as const, { status: "blocked", reason: "Interrupted" } as const, completedRecovery(report(false))]) {
    const actions = incidentActions(incident, records("approved", recovery));
    assert.deepEqual([actions.canExecute, actions.canMitigate, actions.canResolve], [false, false, false]);
  }
  const failed = incidentActions(incident, records("approved", completedRecovery(report(false))));
  assert.match(failed.next, /NOT LANDED/);
  assert.equal(failed.recovery.status === "complete" && failed.recovery.report.checks[0]?.value, 0.0125);
  assert.equal(recoveryFrom([message("recovery", { status: "complete" })]).status, "blocked");
  assert.equal(recoveryFrom([message("executor", "historical execution")]).status, "blocked");
});
