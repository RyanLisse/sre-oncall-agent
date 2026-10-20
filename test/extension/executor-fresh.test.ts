// Extension: the executor's fresh evidence. Three good checkouts are not
// "resolved" while the error rate is still elevated.
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import type { Incident } from "../../src/contract.js";
import { baselineErrorRate, errorRateThreshold, freshEvidence } from "../../src/executor.js";
import { loadTelemetry } from "../../src/telemetry.js";

/** A fake shop: every `failEvery`-th checkout is a 500; the rest succeed on `revision`. */
const fakeShop = async (revision: string, failEvery: number): Promise<{ url: string; server: Server; hits: () => number }> => {
  let n = 0;
  const server = createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      n++;
      const failed = failEvery > 0 && n % failEvery === 0;
      res.writeHead(failed ? 500 : 200, { "content-type": "application/json" });
      res.end(JSON.stringify(failed ? { ok: false, revision } : { ok: true, revision, paid: true }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, server, hits: () => n };
};

test("9% errors after the rollback: NOT resolved, even though the first 3 checkouts succeed", async () => {
  const shop = await fakeShop("v2.14.0", 11); // ≈ 9% errors; checkouts 1..10 all succeed
  try {
    const ev = await freshEvidence(shop.url, "v2.14.0", { baseline: 0.003 });
    assert.equal(ev.ok, false, "must not declare resolved on a few good checkouts");
    if (!ev.ok) assert.match(ev.errors.join(), /not resolved: error_rate 0\.0[89]/);
    assert.ok(shop.hits() >= 50, "the error rate is measured over a sample, not 3 checkouts");
  } finally {
    shop.server.close();
  }
});

test("the legacy call shape (n = 3) gets the same error-rate gate", async () => {
  const shop = await fakeShop("v2.14.0", 11);
  try {
    assert.equal((await freshEvidence(shop.url, "v2.14.0", 3)).ok, false);
  } finally {
    shop.server.close();
  }
});

test("healthy after the fix: resolved, with the error rate and the bar in the evidence", async () => {
  const shop = await fakeShop("v2.14.0", 0);
  try {
    const ev = await freshEvidence(shop.url, "v2.14.0", { baseline: 0.003 });
    assert.equal(ev.ok, true);
    if (ev.ok) {
      assert.equal(ev.value.error_rate, 0);
      assert.equal(ev.value.threshold, 0.02);
      assert.ok(ev.value.verified_ok >= 3);
      assert.equal(ev.value.attempts, 100);
    }
  } finally {
    shop.server.close();
  }
});

test("wrong revision serving: refused as before", async () => {
  const shop = await fakeShop("v2.15.1", 0);
  try {
    const ev = await freshEvidence(shop.url, "v2.14.0", { sample: 12 });
    assert.equal(ev.ok, false);
    if (!ev.ok) assert.match(ev.errors.join(), /0\/3 verified successful checkouts on v2\.14\.0/);
  } finally {
    shop.server.close();
  }
});

test("unreachable shop: refused", async () => {
  const ev = await freshEvidence("http://127.0.0.1:9", "v2.14.0", { sample: 5, concurrency: 5 });
  assert.equal(ev.ok, false);
});

test("bar = max(2 × baseline, 0.02); baseline is the mean before the breakpoint", async () => {
  assert.equal(errorRateThreshold(0), 0.02);
  assert.equal(errorRateThreshold(0.003), 0.02);
  assert.equal(errorRateThreshold(0.05), 0.1);
  const t = await loadTelemetry("fixtures/telemetry/correlation-trap.json");
  if (!t.ok) throw new Error();
  const inc: Incident = { incident_id: "INC-1002", service: "checkout", alert: "x", fired_at: "2026-10-06T03:44:00Z" };
  assert.ok(Math.abs(baselineErrorRate(inc, t.value) - 0.003) < 1e-9);
});

test("caveat: a high error rate across the whole hour becomes the baseline (no breakpoint)", async () => {
  const t = await loadTelemetry("fixtures/telemetry/bad-deploy.json");
  if (!t.ok) throw new Error();
  const allHigh = { ...t.value, metrics: t.value.metrics.map((m) => ({ ...m, error_rate: 0.05 })) };
  const inc: Incident = { incident_id: "INC-1001", service: "checkout", alert: "x", fired_at: "2026-10-05T03:50:00Z" };
  const b = baselineErrorRate(inc, allHigh);
  assert.ok(Math.abs(b - 0.05) < 1e-9, `baseline ${b}`);
  assert.ok(Math.abs(errorRateThreshold(b) - 0.1) < 1e-9, "the bar is then 2× the elevated rate: only 'no worse than before'");
});
