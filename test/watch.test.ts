import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTelemetry } from "../src/telemetry.js";
import { watchMetric } from "../src/watch.js";

const load = async (name: string) => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  if (!t.ok) throw new Error(t.errors.join());
  return t.value;
};

test("after a rollback the metric lands within the window", async () => {
  const r = watchMetric(await load("after-rollback"), "error_rate", "2026-10-05T03:45:00Z", "2026-10-05T03:52:00Z");
  assert.equal(r.landed, true);
  assert.equal(r.checks.length, 3);
  assert.equal(r.baseline, 0.003);
});

test("without the fix the metric does not land", async () => {
  const r = watchMetric(await load("bad-deploy"), "error_rate", "2026-10-05T03:45:00Z", "2026-10-05T03:52:00Z");
  assert.equal(r.landed, false);
  assert.match(r.message, /NOT LANDED/);
});

test("a check before any post-fix data counts as no data, not success", async () => {
  const r = watchMetric(await load("after-rollback"), "error_rate", "2026-10-05T03:45:00Z", "2026-10-05T03:59:30Z", 4);
  assert.equal(r.checks.filter((c) => c.value === undefined).length >= 1, true);
});

test("NOT LANDED names each required check that failed, with value and limit", async () => {
  const r = watchMetric(await load("bad-deploy"), "error_rate", "2026-10-05T03:45:00Z", "2026-10-05T03:52:00Z");
  assert.equal(r.landed, false);
  assert.ok(r.failed.length >= 1);
  for (const f of r.failed) assert.match(f, /^(full|double) check @\d\d:\d\d: error_rate (\d|no data).*(limit|after the fix)/);
  assert.equal(r.failed.some((f) => f.startsWith("half")), false);
});

test("LANDED has no failed checks", async () => {
  const r = watchMetric(await load("after-rollback"), "error_rate", "2026-10-05T03:45:00Z", "2026-10-05T03:52:00Z");
  assert.deepEqual(r.failed, []);
});
