/**
 * fixtures/generate.mjs — deterministic fictional telemetry
 * ---------------------------------------------------------------------------
 * node fixtures/generate.mjs   → writes fixtures/telemetry/*.json
 *
 * Four scenarios for the checkout service, one hour each, 1-minute points.
 *   bad-deploy        error_rate 0.3% → 12% two minutes after deploy d-4821
 *   slow-dependency   p95 180 ms → 3000 ms, no deploy, DB timeouts in logs
 *   noisy-alert       nothing happens; the alert threshold is just tight
 *   mystery-errors    error_rate jumps, no deploy, no useful log line
 *   after-rollback    bad-deploy, then rollback at :52 and recovery (for watch)
 *   correlation-trap  INC-1002: two suspects line up in time, the cause is a config push
 *   correlation-trap-after  same, then rollback at :50 (no effect) and cache warm-up at :56
 * No randomness: every run writes byte-identical files.
 */
import { mkdirSync, writeFileSync } from "node:fs";

const T0 = Date.parse("2026-10-05T03:00:00Z");
const ts = (min, sec = 0) => new Date(T0 + min * 60_000 + sec * 1000).toISOString();

const point = (min, error_rate, p95_ms, version) => ({ ts: ts(min), error_rate, p95_ms, version });
const log = (min, sec, level, msg) => ({ ts: ts(min, sec), level, msg });

const baselineLogs = (from, to, version) => {
  const out = [];
  for (let m = from; m < to; m += 7) out.push(log(m, 11, "info", `checkout ok order=ord-${1000 + m} v=${version}`));
  return out;
};

const DIFFS = {
  "bad-deploy": `--- a/payments/provider.ts
+++ b/payments/provider.ts
@@ -12,9 +12,9 @@ export const providerFor = (region: string): Provider => {
-  const secret = env("PAYMENT_PROVIDER_SECRET");
-  return region === "eu" ? stripeEU(secret) : stripeUS(secret);
+  // EU traffic now goes through the new provider config; secret is read per region
+  const secret = env(\`PAYMENT_PROVIDER_SECRET_\${region.toUpperCase()}\`);
+  return region === "eu" ? stripeEU(secret) : stripeUS(secret);
 };`,
  slow: `--- a/checkout/reserve.ts
+++ b/checkout/reserve.ts
@@ -20,6 +20,8 @@ export const reserveAll = async (items: Item[]) => {
-  await inventory.reserveBatch(items.map((i) => i.sku));
+  for (const i of items) {
+    await inventory.reserve(i.sku); // TODO batch
+  }
 };`,
};

const write = (name, data) => {
  mkdirSync("fixtures/telemetry", { recursive: true });
  writeFileSync(`fixtures/telemetry/${name}.json`, JSON.stringify(data, null, 2) + "\n");
  console.log(`wrote fixtures/telemetry/${name}.json`);
};

// ── bad-deploy ─────────────────────────────────────────────────────────
{
  const metrics = [];
  for (let m = 0; m < 60; m++) {
    const v = m < 43 ? "v2.14.0" : "v2.15.0";
    const bad = m >= 45;
    metrics.push(point(m, bad ? 0.12 : 0.003, bad ? 210 : 180, v));
  }
  const logs = [
    ...baselineLogs(0, 45, "v2.14.0"),
    log(43, 2, "info", "deploy d-4821 started: v2.15.0 (payments: new provider config)"),
    log(43, 40, "info", "deploy d-4821 complete: 100% traffic on v2.15.0"),
    log(45, 3, "error", "PaymentConfigError: missing key PAYMENT_PROVIDER_SECRET_EU for provider=stripe-eu"),
    log(45, 4, "error", "checkout failed order=ord-2045 status=500 cause=PaymentConfigError"),
    log(45, 9, "error", "checkout failed order=ord-2046 status=500 cause=PaymentConfigError"),
    log(46, 1, "error", "checkout failed order=ord-2047 status=500 cause=PaymentConfigError"),
    log(50, 0, "warn", "error budget: 11.8% of the 30-day budget burned in 5 minutes"),
  ].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const deploys = [
    { id: "d-4790", version: "v2.13.2", at: ts(-900), author: "mira", summary: "copy fix in receipt email" },
    { id: "d-4805", version: "v2.14.0", at: ts(-300), author: "jonas", summary: "checkout: address autocomplete" },
    { id: "d-4821", version: "v2.15.0", at: ts(43), author: "sven", summary: "payments: switch EU traffic to new provider config", diff: DIFFS["bad-deploy"] },
  ];
  write("bad-deploy", { service: "checkout", logs, metrics, deploys });

  // after-rollback: same, rollback at :52, recovery from :54
  const after = metrics.map((p, m) => (m >= 54 ? point(m, 0.003, 180, "v2.14.0") : m >= 52 ? point(m, 0.04, 195, "v2.14.0") : p));
  write("after-rollback", {
    service: "checkout",
    logs: [...logs, log(52, 0, "info", "rollback d-4822: v2.14.0 (approved by on-call)")].sort((a, b) => (a.ts < b.ts ? -1 : 1)),
    metrics: after,
    deploys: [...deploys, { id: "d-4822", version: "v2.14.0", at: ts(52), author: "on-call", summary: "rollback of d-4821" }],
  });
}

// ── slow-dependency ────────────────────────────────────────────────────
{
  const metrics = [];
  for (let m = 0; m < 60; m++) metrics.push(point(m, 0.003, m >= 38 ? 3000 : 180, "v2.14.0"));
  const logs = [
    ...baselineLogs(0, 60, "v2.14.0"),
    log(38, 5, "error", "DbTimeout: query inventory.reserve exceeded 2500 ms (pool=12/12 busy)"),
    log(39, 1, "error", "DbTimeout: query inventory.reserve exceeded 2500 ms (pool=12/12 busy)"),
    log(41, 7, "warn", "connection pool saturated for 3 minutes"),
  ].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  const deploys = [{ id: "d-4805", version: "v2.14.0", at: ts(-300), author: "jonas", summary: "checkout: address autocomplete" }];
  write("slow-dependency", { service: "checkout", logs, metrics, deploys });
}

// ── noisy-alert ────────────────────────────────────────────────────────
{
  const metrics = [];
  for (let m = 0; m < 60; m++) metrics.push(point(m, m % 10 === 0 ? 0.006 : 0.003, 180 + (m % 5) * 4, "v2.14.0"));
  write("noisy-alert", {
    service: "checkout",
    logs: baselineLogs(0, 60, "v2.14.0"),
    metrics,
    deploys: [{ id: "d-4805", version: "v2.14.0", at: ts(-300), author: "jonas", summary: "checkout: address autocomplete" }],
  });
}

// ── mystery-errors ─────────────────────────────────────────────────────
{
  const metrics = [];
  for (let m = 0; m < 60; m++) metrics.push(point(m, m >= 50 ? 0.05 : 0.003, 180, "v2.14.0"));
  write("mystery-errors", {
    service: "checkout",
    logs: [...baselineLogs(0, 60, "v2.14.0"), log(50, 30, "warn", "upstream returned 502 (no body)")].sort((a, b) => (a.ts < b.ts ? -1 : 1)),
    metrics,
    deploys: [{ id: "d-4805", version: "v2.14.0", at: ts(-300), author: "jonas", summary: "checkout: address autocomplete" }],
  });
}

// ── correlation-trap (INC-1002, extension) ─────────────────────────────
// The night after INC-1001. Two suspects line up in time (a doubled request
// volume and deploy d-4830); the cause is config push cfg-912, which is not a
// deploy. correlation-trap-after: rollback at :50 changes nothing, the cache
// warm-up at :56 does.
{
  const T1 = Date.parse("2026-10-06T03:00:00Z");
  const at = (min, sec = 0) => new Date(T1 + min * 60_000 + sec * 1000).toISOString();
  const line = (min, sec, level, msg, trace_id) => ({ ts: at(min, sec), level, msg, ...(trace_id ? { trace_id } : {}) });
  const byTs = (a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0);
  // Fixed retry jitter for minutes 39..59 (and beyond): 430 ± 10, no randomness.
  const JITTER = [0, 4, -3, 7, -6, 2, -9, 5, 1, -2, 8, -5, 3, -7, 6, -1, 9, -4, 0, -8, 10];
  const mp = (min, version, first_attempts, retries, error_rate, p95_ms, cache_hit_ratio) => ({
    ts: at(min), error_rate, p95_ms, version, n: first_attempts + retries, first_attempts, retries, cache_hit_ratio,
  });
  const trapPoint = (m) => {
    const version = m < 32 ? "v2.14.0" : "v2.15.1";
    if (m >= 10 && m < 15) return mp(m, version, 960, 0, 0.003, 190, 0.97); // load test lt-77, warm cache
    if (m < 32) return mp(m, version, 480, 0, 0.003, 180, 0.96);
    if (m < 38) return mp(m, version, 480, 0, 0.003, 182, 0.96);
    if (m === 38) return mp(m, version, 480, 0, 0.09, 2600, 0.04);
    return mp(m, version, 480, 430 + JITTER[(m - 39) % JITTER.length], 0.09, 2600, 0.05);
  };
  const metrics = [];
  for (let m = 0; m < 60; m++) metrics.push(trapPoint(m));

  const okLines = [];
  for (let m = 0; m < 38; m += 7) okLines.push(line(m, 11, "info", `checkout ok order=ord-${5000 + m} v=${m < 32 ? "v2.14.0" : "v2.15.1"}`));
  const fail = (min, sec, order, trace, retry) =>
    line(min, sec, "error", `checkout failed order=${order} status=500 cause=DbTimeout price_lookup trace=${trace} retry=${retry}`, trace);
  const logs = [
    ...okLines,
    line(10, 0, "info", "loadtest lt-77 started: 2x checkout load (perf-team)"),
    line(15, 0, "info", "loadtest lt-77 finished: p95 190 ms, error_rate 0.3%"),
    line(20, 5, "info", "checkout ok order=ord-5101 v=v2.14.0 trace=a11c02", "a11c02"),
    line(32, 10, "info", "deploy d-4830 started: v2.15.1 (payments: per-region secret)"),
    line(32, 12, "info", "deploy d-4830 complete: 100% traffic on v2.15.1"),
    line(35, 40, "info", "checkout ok order=ord-5190 v=v2.15.1 trace=b7e410", "b7e410"),
    line(37, 31, "warn", "price-cache: keyspace empty"),
    fail(38, 2, "ord-5212", "e1a001", 0),
    fail(38, 4, "ord-5213", "e1a002", 0),
    line(38, 20, "warn", "price-cache miss storm: hit_ratio=0.04"),
    fail(39, 1, "ord-5212", "e1a003", 1),
    fail(39, 3, "ord-5213", "e1a004", 1),
    fail(40, 10, "ord-5212", "e1a005", 2),
    fail(41, 12, "ord-5230", "7f3a9c", 0),
    fail(41, 14, "ord-5230", "7f3a9d", 1),
    line(42, 30, "info", "checkout ok order=ord-5244 v=v2.15.1 trace=c09e55 slow=2400ms", "c09e55"),
    fail(42, 40, "ord-5251", "e1a006", 0),
    fail(42, 50, "ord-5251", "e1a007", 1),
    fail(43, 1, "ord-5251", "d2f001", 2),
    line(43, 30, "warn", "error budget: 8.7% of the 30-day budget burned in 5 minutes"),
  ].sort(byTs);

  const span = (name, ms, status, attrs) => ({ name, ms, status, ...(attrs ? { attrs } : {}) });
  const healthy = (cacheMs, chargeMs) => [
    span("edge", 2, "ok"),
    span("checkout", 4, "ok"),
    span("price-cache", cacheMs, "ok", { result: "hit" }),
    span("payments.charge", chargeMs, "ok", { provider: "stripe-eu" }),
  ];
  const timedOut = [
    span("edge", 2, "ok"),
    span("checkout", 3, "ok"),
    span("price-cache", 1, "miss", { result: "miss" }),
    span("postgres.price_lookup", 2500, "timeout", { timeout_ms: 2500 }),
    span("payments.charge", 0, "skipped"),
  ];
  const traces = [
    { trace_id: "a11c02", at: at(20, 5), status: 200, order_ref: "ord-5101", retry_attempt: 0, version: "v2.14.0", spans: healthy(2, 140) },
    { trace_id: "b7e410", at: at(35, 40), status: 200, order_ref: "ord-5190", retry_attempt: 0, version: "v2.15.1", spans: healthy(2, 151) },
    { trace_id: "7f3a9c", at: at(41, 12), status: 500, order_ref: "ord-5230", retry_attempt: 0, version: "v2.15.1", spans: timedOut },
    { trace_id: "7f3a9d", at: at(41, 14), status: 500, order_ref: "ord-5230", retry_attempt: 1, version: "v2.15.1", spans: timedOut },
    {
      trace_id: "c09e55", at: at(42, 30), status: 200, order_ref: "ord-5244", retry_attempt: 0, version: "v2.15.1",
      spans: [span("edge", 2, "ok"), span("checkout", 3, "ok"), span("price-cache", 1, "miss", { result: "miss" }), span("postgres.price_lookup", 2210, "ok"), span("payments.charge", 148, "ok", { provider: "stripe-eu" })],
    },
    { trace_id: "d2f001", at: at(43, 1), status: 500, order_ref: "ord-5251", retry_attempt: 2, version: "v2.15.1", spans: timedOut },
  ];

  const D4830_DIFF = `--- a/payments/provider.ts
+++ b/payments/provider.ts
@@ -12,9 +12,9 @@ export const providerFor = (region: string): Provider => {
   const secret = env(\`PAYMENT_PROVIDER_SECRET_\${region.toUpperCase()}\`);
-  if (!secret) throw new PaymentConfigError(region);
+  if (!secret) throw new PaymentConfigError(\`missing key for \${region}\`);
   return region === "eu" ? stripeEU(secret) : stripeUS(secret);
 };
--- a/config/secrets.eu.ref
+++ b/config/secrets.eu.ref
@@ -0,0 +1 @@
+PAYMENT_PROVIDER_SECRET_EU=vault://payments/eu/stripe`;
  const deploys = [
    { id: "d-4790", version: "v2.13.2", at: at(-2340), author: "mira", summary: "copy fix in receipt email" },
    { id: "d-4805", version: "v2.14.0", at: at(-1740), author: "jonas", summary: "checkout: address autocomplete" },
    { id: "d-4830", version: "v2.15.1", at: at(32, 10), author: "sven", summary: "payments: per-region secret, EU key present (fix for INC-1001)", diff: D4830_DIFF },
  ];
  const changes = [
    { id: "lt-77", kind: "loadtest", at: at(10), until: at(15), actor: "perf-team", summary: "2x checkout load, warm cache", target: "checkout" },
    { id: "d-4830", kind: "deploy", at: at(32, 10), actor: "sven", summary: "payments: per-region secret, EU key present (fix for INC-1001)", target: "checkout", ref: "v2.15.1" },
    { id: "cfg-912", kind: "config", at: at(37, 30), actor: "platform-bot", summary: "flush keyspace + ttl=0 (cache migration step 2/3)", target: "price-cache" },
  ];
  write("correlation-trap", { service: "checkout", scenario: "correlation-trap", logs, metrics, deploys, changes, traces });

  // after: identical until 03:49; rollback at 03:50 changes nothing; warm-up at 03:56 does.
  const afterPoint = (m) => {
    if (m < 50) return trapPoint(m);
    if (m < 58) return mp(m, "v2.14.0", 480, 430 + JITTER[(m - 39) % JITTER.length], 0.09, 2600, m < 56 ? 0.05 : 0.4);
    return mp(m, "v2.14.0", 480, 0, 0.004, 185, 0.9);
  };
  const afterMetrics = [];
  for (let m = 0; m < 70; m++) afterMetrics.push(afterPoint(m));
  const afterLogs = [
    ...logs,
    line(50, 0, "info", "deploy d-4831 started: v2.14.0 (rollback of d-4830)"),
    line(50, 3, "info", "deploy d-4831 complete: 100% traffic on v2.14.0"),
    fail(52, 10, "ord-5302", "e1a008", 0),
    fail(52, 40, "ord-5302", "e1a009", 1),
    line(56, 0, "info", "price-cache: ttl=300, warming from snapshot"),
    line(58, 0, "info", "price-cache hit_ratio=0.90"),
    ...[59, 63, 67].map((m) => line(m, 11, "info", `checkout ok order=ord-${5300 + m} v=v2.14.0`)),
  ].sort(byTs);
  write("correlation-trap-after", {
    service: "checkout",
    scenario: "correlation-trap",
    logs: afterLogs,
    metrics: afterMetrics,
    deploys: [...deploys, { id: "d-4831", version: "v2.14.0", at: at(50), author: "on-call", summary: "rollback of d-4830" }],
    changes: [
      ...changes,
      { id: "d-4831", kind: "deploy", at: at(50), actor: "on-call", summary: "rollback of d-4830", target: "checkout", ref: "v2.14.0" },
      { id: "cfg-913", kind: "config", at: at(56), actor: "ops-human", summary: "price-cache ttl=300 + warm from snapshot", target: "price-cache" },
    ],
    traces,
  });
}
