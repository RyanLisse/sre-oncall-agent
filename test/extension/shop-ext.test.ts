// Extension: the live shop's cache-loss mode, retries, traces and changes.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

process.env.AGENT_DEMO_DATA = mkdtempSync(join(tmpdir(), "shop-ext-"));
delete process.env.AGENT_EXT;
const shop = await import("../../demo/shop.js");

test("without the extension the snapshot has no changes/traces and error lines are unchanged", () => {
  for (let i = 0; i < 400; i++) shop.checkout();
  const s = shop.snapshot();
  assert.equal("changes" in s, false);
  assert.equal("traces" in s, false);
  assert.ok(s.logs.filter((l) => l.level === "error").every((l) => !/trace=/.test(l.msg)));
  for (const m of s.metrics) for (const k of ["first_attempts", "retries", "cache_hit_ratio"]) assert.equal(k in m, false, k);
});

test("config push + cache flush: cache-loss mode, ~9% errors, DbTimeout price_lookup, hit ratio ~0.04", () => {
  assert.ok(shop.MODES.includes("cache-loss"));
  const c = shop.recordChange("price-cache", "flush keyspace + ttl=0 (cache migration step 2/3)", "platform-bot");
  assert.match(c.id, /^cfg-\d+$/);
  const hitsSoFar = () => shop.snapshot().metrics.reduce((a, m) => a + (m.cache_hit_ratio ?? 0) * m.n, 0);
  const hits0 = hitsSoFar();
  assert.equal(shop.cacheAction("flush"), "cache-loss");
  let fails = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) {
    const r = shop.checkout();
    if (r.status >= 500) {
      fails++;
      assert.match(String(r.payload.error), /^DbTimeout price_lookup/);
    }
    assert.ok(r.ms >= 2300 && r.ms <= 2800);
  }
  const s = shop.snapshot();
  const hitRatio = (hitsSoFar() - hits0) / N; // buckets round the ratio to 2 decimals
  assert.ok(fails / N > 0.06 && fails / N < 0.12, `error rate ${fails / N}`);
  assert.ok(hitRatio > 0 && hitRatio < 0.1, `hit ratio ${hitRatio}`);
  assert.ok(s.changes?.some((x) => x.id === c.id && x.kind === "config" && x.target === "price-cache"));
  const errLine = s.logs.filter((l) => l.level === "error").at(-1);
  assert.match(errLine?.msg ?? "", /cause=DbTimeout price_lookup trace=[0-9a-f]{6} retry=0$/);
  const failing = s.traces?.find((t) => t.status === 500);
  assert.ok(failing);
  assert.deepEqual(failing?.spans.map((x) => x.status), ["ok", "ok", "miss", "timeout", "skipped"]);
  assert.ok((s.traces?.length ?? 0) <= 200);
});

test("retries are counted per bucket from the request options", () => {
  shop.checkout({ retryAttempt: 1, orderRef: "ord-77" });
  shop.checkout({ retryAttempt: 2, orderRef: "ord-77" });
  const s = shop.snapshot();
  assert.ok(s.metrics.reduce((a, m) => a + (m.retries ?? 0), 0) >= 2);
});

test("cache warm returns to the mode before the flush", () => {
  assert.equal(shop.cacheAction("warm"), "healthy");
});
