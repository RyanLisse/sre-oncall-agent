/**
 * fixtures/generate.mjs — deterministic fictional telemetry
 * ---------------------------------------------------------------------------
 * node fixtures/generate.mjs   → writes fixtures/telemetry/*.json
 *
 * Six scenarios for checkout, with one-minute points.
 *   bad-deploy        error_rate 0.3% → 12% two minutes after deploy d-4821
 *   slow-dependency   p95 180 ms → 3000 ms, no deploy, DB timeouts in logs
 *   noisy-alert       nothing happens; the alert threshold is just tight
 *   mystery-errors    error_rate jumps, no deploy, no useful log line
 *   after-rollback    bad-deploy, then rollback at :52 and recovery (for watch)
 *   recovered-deploy  breakpoint after a deploy, then healthy before the alert
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

// ── recovered-deploy ───────────────────────────────────────────────────
{
  const metrics = [];
  for (let m = 0; m < 50; m++) {
    const recovering = m >= 48;
    const failing = m >= 45 && !recovering;
    metrics.push(point(m, failing ? 0.12 : 0.003, failing ? 1100 : 180, m < 43 ? "v2.14.0" : "v2.16.0"));
  }
  const logs = [
    ...baselineLogs(0, 45, "v2.14.0"),
    log(43, 2, "info", "deploy d-4822 started: v2.16.0"),
    log(43, 40, "info", "deploy d-4822 complete: 100% traffic on v2.16.0"),
    log(45, 3, "error", "PaymentConfigError: missing key PAYMENT_PROVIDER_SECRET_EU for provider=stripe-eu"),
    log(45, 4, "error", "checkout failed order=ord-2045 status=500 cause=PaymentConfigError"),
    log(48, 0, "info", "checkout error rate returned to baseline"),
  ].sort((a, b) => (a.ts < b.ts ? -1 : 1));
  write("recovered-deploy", {
    service: "checkout",
    logs,
    metrics,
    deploys: [
      { id: "d-4805", version: "v2.14.0", at: ts(-300), author: "jonas", summary: "checkout: address autocomplete" },
      { id: "d-4822", version: "v2.16.0", at: ts(43), author: "sven", summary: "payments: switch EU traffic to new provider config" },
    ],
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
