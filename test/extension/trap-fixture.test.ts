// Extension: the INC-1002 correlation-trap fixtures and what the existing code does with them.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parseIncident, parseVerdict, VERDICT_SCHEMA } from "../../src/contract.js";
import { planRollback } from "../../src/executor.js";
import { offlineVerdict } from "../../src/runtime.js";
import { loadTelemetry, searchLogs, summarizeMetrics, type Telemetry } from "../../src/telemetry.js";

const load = async (name: string): Promise<Telemetry> => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  if (!t.ok) throw new Error(t.errors.join());
  return t.value;
};
const file = JSON.parse(readFileSync("fixtures/incidents/correlation-trap.json", "utf8")) as { incident: unknown; telemetry: string; alert_file: string };
const incident = (() => {
  const r = parseIncident(file.incident);
  if (!r.ok) throw new Error(r.errors.join());
  return r.value;
})();
const at = (hhmm: string) => `2026-10-06T${hhmm}:00.000Z`;

test("incident file: INC-1002, points at the trap telemetry and the alert file", () => {
  assert.equal(incident.incident_id, "INC-1002");
  assert.equal(file.telemetry, "fixtures/telemetry/correlation-trap.json");
  assert.equal(file.alert_file, "alerts/checkout-error-rate.yaml");
  const alert = readFileSync(file.alert_file, "utf8");
  assert.match(alert, /^alert: CheckoutErrorRate$/m);
  assert.match(alert, /^expr: .*checkout_requests_total.*> 0\.02$/m);
});

test("summarize_metrics: the breakpoint is at 03:38", async () => {
  const s = summarizeMetrics(await load("correlation-trap"), at("02:44"), incident.fired_at);
  assert.equal(s.breakpoints[0]?.ts, at("03:38"));
  assert.equal(s.breakpoints[0]?.what, "error_rate");
  assert.ok(s.breakpoints.every((b) => b.ts === at("03:38")), "the load test at 03:10 is not a breakpoint");
});

test("the second trap: planRollback blames d-4830 and offers v2.15.1 → v2.14.0", async () => {
  const p = planRollback(incident, await load("correlation-trap"));
  assert.equal(p.ok, true);
  if (p.ok) assert.deepEqual(p.value, { incident_id: "INC-1002", blamed_deploy: "d-4830", from_version: "v2.15.1", to_version: "v2.14.0" });
});

test("first attempts stay flat at 480 from 03:30 to 03:45; retries start at 03:39", async () => {
  const t = await load("correlation-trap");
  const win = t.metrics.filter((m) => m.ts >= at("03:30") && m.ts <= at("03:45"));
  assert.equal(win.length, 16);
  assert.ok(win.every((m) => m.first_attempts === 480));
  assert.equal(t.metrics.find((m) => m.ts === at("03:38"))?.retries, 0);
  assert.ok((t.metrics.find((m) => m.ts === at("03:39"))?.retries ?? 0) >= 420);
  const lt = t.metrics.filter((m) => m.ts >= at("03:10") && m.ts < at("03:15"));
  assert.ok(lt.every((m) => m.first_attempts === 960 && m.error_rate < 0.01), "baseline: 2x load was fine with a warm cache");
});

test("logs: retries of the same order, the cache warning, and no line names cfg-912", async () => {
  const t = await load("correlation-trap");
  const errors = searchLogs(t, { level: "error", limit: 50 });
  const retried = errors.filter((l) => /retry=[12]/.test(l.msg));
  assert.ok(retried.length >= 3);
  for (const r of retried) {
    const order = /order=(ord-\d+)/.exec(r.msg)?.[1];
    assert.ok(errors.some((l) => l.ts < r.ts && l.msg.includes(`order=${order} `)), `${order} seen earlier`);
  }
  assert.ok(t.logs.some((l) => l.msg.includes("price-cache: keyspace empty")));
  assert.ok(!t.logs.some((l) => l.msg.includes("cfg-912")), "cfg-912 is found through list_changes only");
  assert.ok(!t.deploys.some((d) => d.id === "cfg-912"), "cfg-912 is not a deploy");
});

test("trap-after: rollback at 03:50 leaves error_rate ≥ 0.08 at 03:52; warm-up brings it ≤ 0.01 at 03:58", async () => {
  const t = await load("correlation-trap-after");
  assert.ok((t.metrics.find((m) => m.ts === at("03:52"))?.error_rate ?? 0) >= 0.08);
  assert.equal(t.metrics.find((m) => m.ts === at("03:52"))?.version, "v2.14.0");
  assert.ok((t.metrics.find((m) => m.ts === at("03:58"))?.error_rate ?? 1) <= 0.01);
  assert.equal(t.metrics.find((m) => m.ts === at("03:58"))?.retries, 0);
  const trap = await load("correlation-trap");
  assert.deepEqual(t.metrics.filter((m) => m.ts < at("03:50")), trap.metrics.filter((m) => m.ts < at("03:50")), "identical until 03:49");
});

test("scripted verdict: valid against the contract, and deliberately wrong (capacity / scale)", async () => {
  const v = offlineVerdict(incident, await load("correlation-trap"));
  assert.equal(parseVerdict(v).ok, true);
  const needsImpact = (VERDICT_SCHEMA.required as readonly string[]).includes("customer_impact");
  assert.equal("customer_impact" in v, needsImpact, "customer_impact follows the contract (added once A3 is solved)");
  assert.equal(v.proposal, "scale");
  assert.match(v.hypothesis, /capacity/i);
  assert.deepEqual(v.ruled_out, []);
  assert.deepEqual(v.data_gaps, ["no trace data read", "changes other than deploys not checked"]);
  assert.deepEqual(v.evidence.map((e) => `${e.source}:${e.ref}`), [`metrics:${at("03:39")}`, "deploys:d-4830"]);
  // Also clears the solved-state evidence rules: two sources, not high confidence with data gaps.
  assert.notEqual(v.confidence, "high");
  assert.notEqual(v.confidence, "low");
  assert.ok(new Set(v.evidence.map((e) => e.source)).size >= 2);
});
