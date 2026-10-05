import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTelemetry, previousVersion, searchLogs, summarizeMetrics } from "../src/telemetry.js";

const load = async (name: string) => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  assert.equal(t.ok, true);
  if (!t.ok) throw new Error("unreachable");
  return t.value;
};

test("bad-deploy: one error_rate breakpoint on v2.15.0", async () => {
  const t = await load("bad-deploy");
  const s = summarizeMetrics(t);
  assert.equal(s.breakpoints.length, 1);
  assert.equal(s.breakpoints[0]?.what, "error_rate");
  assert.equal(s.breakpoints[0]?.version, "v2.15.0");
});

test("noisy-alert: no breakpoint", async () => {
  const t = await load("noisy-alert");
  assert.equal(summarizeMetrics(t).breakpoints.length, 0);
});

test("search_logs is capped at 50 and filters by level", async () => {
  const t = await load("bad-deploy");
  assert.ok(searchLogs(t, { limit: 500 }).length <= 50);
  assert.ok(searchLogs(t, { level: "error" }).every((l) => l.level === "error"));
  assert.equal(searchLogs(t, { pattern: "PAYMENTCONFIG" }).length, 4);
});

test("previousVersion finds what was live before a deploy", async () => {
  const t = await load("bad-deploy");
  const bad = t.deploys.find((d) => d.id === "d-4821");
  assert.ok(bad);
  assert.equal(previousVersion(t, bad), "v2.14.0");
});

test("malformed telemetry is rejected", async () => {
  const t = await loadTelemetry("fixtures/incidents/bad-deploy.json");
  assert.equal(t.ok, false);
});
