import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketMs, deployBehind, loadTelemetry, previousVersion, searchLogs, summarizeMetrics } from "../src/telemetry.js";

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

test("a 2× wobble below the absolute floor, or on a thin bucket, is not a breakpoint", () => {
  const base = { service: "s", logs: [], deploys: [] };
  const wobble = { ...base, metrics: [
    { ts: "2026-01-01T00:00:00Z", error_rate: 0.003, p95_ms: 180, version: "v" },
    { ts: "2026-01-01T00:01:00Z", error_rate: 0.007, p95_ms: 300, version: "v" },
  ] };
  assert.equal(summarizeMetrics(wobble).breakpoints.length, 0);
  const thin = { ...base, metrics: [
    { ts: "2026-01-01T00:00:00Z", error_rate: 0.0, p95_ms: 180, version: "v", n: 40 },
    { ts: "2026-01-01T00:01:00Z", error_rate: 0.5, p95_ms: 180, version: "v", n: 2 },
  ] };
  assert.equal(summarizeMetrics(thin).breakpoints.length, 0);
});

test("a deploy one second after the bucket start still explains that bucket", () => {
  const t = { service: "s", logs: [], deploys: [
    { id: "d-1", version: "v1", at: "2026-01-01T00:00:00Z", author: "a", summary: "s" },
    { id: "d-2", version: "v2", at: "2026-01-01T00:05:01.300Z", author: "a", summary: "s" },
  ], metrics: [
    { ts: "2026-01-01T00:04:50Z", error_rate: 0, p95_ms: 180, version: "v1", n: 50 },
    { ts: "2026-01-01T00:05:00Z", error_rate: 0.1, p95_ms: 180, version: "v1", n: 50 },
  ] };
  assert.equal(bucketMs(t), 10_000);
  assert.equal(deployBehind(t, "2026-01-01T00:05:00Z")?.id, "d-2");
});
