/**
 * demo/shop.ts — the fictional checkout service, with fault injection
 * ---------------------------------------------------------------------------
 * A tiny HTTP server that behaves like the service the agent watches:
 *
 *   GET  /                    → demo/shop.html: storefront, simulated customers, fault buttons
 *   POST /checkout            → { ok, order_id, revision, ms } or 500
 *   GET  /health              → { revision, mode, uptime_s }
 *   GET  /admin/state         → current revision + mode
 *   POST /admin/deploy        → { version, mode } switch revision (a "deploy")
 *   POST /admin/degrade       → { mode } change behaviour WITHOUT a deploy (a dependency/load fault)
 *
 * Modes (the faults you can inject):
 *   healthy      0.3% errors, ~180 ms
 *   bad-deploy   12% errors (PaymentConfigError), ~210 ms
 *   slow         0.3% errors, ~3000 ms (DbTimeout in logs)
 *   errors       5% errors, no useful log line (upstream 502)
 *
 * The shop writes its own telemetry to demo/data/telemetry.json in exactly
 * the shape src/telemetry.ts reads: logs, per-bucket metrics, deploys. That
 * file IS the capability binding for the live demo — the agent never talks
 * to the shop; it reads what the shop recorded, like it would read Grafana.
 *
 *   npm run shop                    (port 4310, AGENT_SHOP_PORT to change)
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MODES = ["healthy", "bad-deploy", "slow", "errors"] as const;
export type Mode = (typeof MODES)[number];

const here = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.AGENT_DEMO_DATA ?? join(here, "data");
export const TELEMETRY_PATH = join(DATA_DIR, "telemetry.json");
const PORT = Number(process.env.AGENT_SHOP_PORT ?? 4310);
const BUCKET_MS = 10_000;

interface LogLine { ts: string; level: "info" | "warn" | "error"; msg: string }
interface Bucket { ts: string; n: number; errors: number; lat: number[]; version: string }
interface Deploy { id: string; version: string; at: string; author: string; summary: string; diff?: string }

const state = {
  version: "v2.14.0",
  mode: "healthy" as Mode,
  started: Date.now(),
  deployCounter: 4805,
  orders: 2000,
  logs: [] as LogLine[],
  buckets: new Map<number, Bucket>(),
  // History predates the demo so the first minute of traffic is never blamed on a deploy.
  deploys: [
    { id: "d-4790", version: "v2.13.2", at: new Date(Date.now() - 15 * 60 * 60_000).toISOString(), author: "mira", summary: "copy fix in receipt email" },
    { id: "d-4805", version: "v2.14.0", at: new Date(Date.now() - 5 * 60 * 60_000).toISOString(), author: "jonas", summary: "checkout: address autocomplete" },
  ] as Deploy[],
};

const log = (level: LogLine["level"], msg: string) => {
  state.logs.push({ ts: new Date().toISOString(), level, msg });
  if (state.logs.length > 5000) state.logs.splice(0, state.logs.length - 5000);
};

/** Deterministic-enough pseudo random: good enough for a demo, seedable via AGENT_DEMO_SEED. */
let seed = Number(process.env.AGENT_DEMO_SEED ?? 42);
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

interface Profile { errRate: number; latency: () => number; failure: (order: string) => { status: number; msg: string } }
const profile = (mode: Mode): Profile =>
  (({
    healthy: { errRate: 0.003, latency: () => 160 + rnd() * 40, failure: (o: string) => ({ status: 500, msg: `checkout failed order=${o} status=500 cause=TransientError` }) },
    "bad-deploy": { errRate: 0.12, latency: () => 190 + rnd() * 40, failure: (o: string) => ({ status: 500, msg: `checkout failed order=${o} status=500 cause=PaymentConfigError` }) },
    slow: { errRate: 0.003, latency: () => 2800 + rnd() * 400, failure: (o: string) => ({ status: 500, msg: `checkout failed order=${o} status=500 cause=DbTimeout` }) },
    errors: { errRate: 0.05, latency: () => 170 + rnd() * 30, failure: (o: string) => ({ status: 502, msg: `checkout failed order=${o} status=502 cause=upstream returned 502 (no body)` }) },
  }) satisfies Record<Mode, Profile>)[mode];

const bucketFor = (now: number): Bucket => {
  const key = Math.floor(now / BUCKET_MS) * BUCKET_MS;
  let b = state.buckets.get(key);
  if (!b) {
    b = { ts: new Date(key).toISOString(), n: 0, errors: 0, lat: [], version: state.version };
    state.buckets.set(key, b);
    for (const k of [...state.buckets.keys()].sort((a, c) => a - c).slice(0, -720)) state.buckets.delete(k); // keep 2h
  }
  return b;
};

const p95 = (xs: number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] as number);
};

/** The telemetry file in the shape src/telemetry.ts reads. */
export const snapshot = () => ({
  service: "checkout",
  logs: state.logs,
  metrics: [...state.buckets.values()]
    .filter((b) => b.n > 0)
    .map((b) => ({ ts: b.ts, error_rate: Number((b.errors / b.n).toFixed(4)), p95_ms: p95(b.lat), version: b.version, n: b.n })),
  deploys: state.deploys,
});

const flush = () => {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(TELEMETRY_PATH, `${JSON.stringify(snapshot(), null, 2)}\n`);
};

const body = (req: IncomingMessage): Promise<unknown> =>
  new Promise((res) => {
    let s = "";
    req.on("data", (c: Buffer) => (s += c.toString()));
    req.on("end", () => {
      try { res(s ? JSON.parse(s) : {}); } catch { res({}); }
    });
  });

const send = (res: ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
};

/** Apply a "deploy": switch revision and fault mode, record it. Exported for the executor. */
const DIFFS: Partial<Record<Mode, string>> = {
  "bad-deploy": `--- a/payments/provider.ts\n+++ b/payments/provider.ts\n@@ -12,9 +12,9 @@\n-  const secret = env("PAYMENT_PROVIDER_SECRET");\n+  const secret = env(\`PAYMENT_PROVIDER_SECRET_\${region.toUpperCase()}\`);`,
  slow: `--- a/checkout/reserve.ts\n+++ b/checkout/reserve.ts\n@@ -20,6 +20,8 @@\n-  await inventory.reserveBatch(items.map((i) => i.sku));\n+  for (const i of items) {\n+    await inventory.reserve(i.sku); // TODO batch\n+  }`,
  errors: `--- a/gateway/upstream.ts\n+++ b/gateway/upstream.ts\n@@ -3,4 +3,4 @@\n-const UPSTREAM = "https://api.internal/v1";\n+const UPSTREAM = "https://api-v2.internal/v2"; // no timeout configured yet`,
};

export const applyDeploy = (version: string, mode: Mode, author: string, summary: string): Deploy => {
  state.deployCounter += 1;
  const diff = DIFFS[mode];
  const d: Deploy = { id: `d-${state.deployCounter}`, version, at: new Date().toISOString(), author, summary, ...(diff ? { diff } : {}) };
  log("info", `deploy ${d.id} started: ${version}`);
  state.version = version;
  state.mode = mode;
  state.deploys.push(d);
  log("info", `deploy ${d.id} complete: 100% traffic on ${version}`);
  if (mode === "bad-deploy") log("error", "PaymentConfigError: missing key PAYMENT_PROVIDER_SECRET_EU for provider=stripe-eu");
  flush();
  return d;
};

/** A fault with no change record: the dependency or the load, not us. */
export const degrade = (mode: Mode): void => {
  state.mode = mode;
  log("warn", mode === "slow" ? "connection pool saturated for 3 minutes" : mode === "errors" ? "upstream returned 502 (no body)" : `mode → ${mode}`);
  flush();
};

export const checkout = (): { status: number; payload: Record<string, unknown>; ms: number } => {
  const p = profile(state.mode);
  const ms = Math.round(p.latency());
  const order = `ord-${++state.orders}`;
  const b = bucketFor(Date.now());
  b.n += 1;
  b.lat.push(ms);
  if (rnd() < p.errRate) {
    b.errors += 1;
    const f = p.failure(order);
    log("error", f.msg);
    if (state.mode === "slow") log("error", "DbTimeout: query inventory.reserve exceeded 2500 ms (pool=12/12 busy)");
    return { status: f.status, payload: { ok: false, order_id: order, revision: state.version, ms, error: f.msg.split("cause=")[1] }, ms };
  }
  if (state.mode === "slow" && rnd() < 0.3) log("warn", "connection pool saturated");
  if (b.n % 7 === 0) log("info", `checkout ok order=${order} v=${state.version}`);
  return { status: 200, payload: { ok: true, order_id: order, revision: state.version, ms, paid: true }, ms };
};

if (process.argv[1]?.endsWith("shop.ts") || process.argv[1]?.endsWith("shop.js")) {
  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    if (req.method === "POST" && url === "/checkout") {
      const r = checkout();
      setTimeout(() => send(res, r.status, r.payload), Math.min(r.ms, 3200)); // real latency, capped
      return;
    }
    if (req.method === "GET" && url === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(readFileSync(join(here, "shop.html"))); }
    if (req.method === "GET" && url === "/health") return send(res, 200, { revision: state.version, mode: state.mode, uptime_s: Math.round((Date.now() - state.started) / 1000) });
    if (req.method === "GET" && url === "/admin/state") return send(res, 200, { revision: state.version, mode: state.mode, deploys: state.deploys });
    if (req.method === "POST" && url === "/admin/deploy") {
      const b = (await body(req)) as { version?: string; mode?: string; author?: string; summary?: string };
      if (!b.version || !MODES.includes(b.mode as Mode)) return send(res, 400, { error: `need { version, mode: ${MODES.join("|")} }` });
      return send(res, 200, applyDeploy(b.version, b.mode as Mode, b.author ?? "operator", b.summary ?? `${b.mode} deploy`));
    }
    if (req.method === "POST" && url === "/admin/degrade") {
      const b = (await body(req)) as { mode?: string };
      if (!MODES.includes(b.mode as Mode)) return send(res, 400, { error: `need { mode: ${MODES.join("|")} }` });
      degrade(b.mode as Mode);
      return send(res, 200, { revision: state.version, mode: state.mode, deploy: null });
    }
    send(res, 404, { error: "not found" });
  });
  setInterval(flush, 2000).unref();
  flush();
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`▶ shop listening on http://127.0.0.1:${PORT}  revision ${state.version}  mode ${state.mode}`);
    console.log(`  telemetry → ${TELEMETRY_PATH}`);
    console.log(`  inject a fault:  npm run chaos -- deploy v2.15.0 --mode bad-deploy`);
  });
}
