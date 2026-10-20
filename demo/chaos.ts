/**
 * demo/chaos.ts — traffic generator + fault injection CLI
 * ---------------------------------------------------------------------------
 *   npm run traffic                          → 8 checkouts/s against the shop until Ctrl-C
 *   npm run chaos -- deploy v2.15.0 --mode bad-deploy
 *   npm run chaos -- deploy v2.15.1 --mode slow
 *   npm run chaos -- deploy v2.15.2 --mode errors
 *   npm run chaos -- degrade --mode slow         (no deploy record: a dependency/load fault)
 *   npm run chaos -- state
 *
 * Extension:
 *   npm run traffic -- --retry 2             → on a 5xx, retry the same order up to 2 times
 *   npm run chaos -- scenario correlation-trap [--wait 60]
 *   npm run chaos -- cache warm              (operator recovery; also: cache flush)
 *
 * This is the operator's lever, not the agent's. The agent cannot call
 * /admin/deploy; only a human (here) or the approved executor (src/executor.ts)
 * can.
 */
import { parseArgs } from "node:util";
import { MODES, type Mode } from "./shop.js";

export const SHOP_URL = process.env.AGENT_SHOP_URL ?? `http://localhost:${process.env.AGENT_SHOP_PORT ?? 4310}`;

export const post = async (path: string, data: unknown, headers: Record<string, string> = {}): Promise<{ status: number; json: unknown; ms: number }> => {
  const t0 = Date.now();
  const r = await fetch(`${SHOP_URL}${path}`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(data) });
  return { status: r.status, json: await r.json().catch(() => ({})), ms: Date.now() - t0 };
};

export const get = async (path: string): Promise<unknown> => (await fetch(`${SHOP_URL}${path}`)).json();

const traffic = async (rps: number, retry = 0): Promise<never> => {
  console.log(`▶ traffic ${rps}/s → ${SHOP_URL}/checkout${retry > 0 ? `  retry up to ${retry}× on 5xx` : ""}  (Ctrl-C to stop)`);
  let n = 0, errs = 0, retries = 0;
  // Extension: a client that retries the same order on a 5xx (default retry = 0: unchanged behaviour).
  const attempt = (headers: Record<string, string>, tries: number): void => {
    post("/checkout", {}, headers).then((r) => {
      n++;
      if (r.status < 500) return;
      errs++;
      const order = (r.json as { order_id?: unknown }).order_id;
      if (tries < retry && typeof order === "string") {
        retries++;
        setTimeout(() => attempt({ "x-retry-attempt": String(tries + 1), "x-order-ref": order }, tries + 1), 200);
      }
    }).catch(() => errs++);
  };
  setInterval(() => {
    for (let i = 0; i < rps; i++) attempt({}, 0);
  }, 1000);
  setInterval(() => { console.log(`  ${new Date().toISOString().slice(11, 19)}  requests ${n}  5xx ${errs}${retry > 0 ? `  retries ${retries}` : ""}`); n = 0; errs = 0; retries = 0; }, 10_000);
  return new Promise(() => undefined);
};

/** Extension: INC-1002 live. A healthy deploy, then a config push that empties the price-cache. */
export const TRAP = {
  version: "v2.15.1",
  deploySummary: "payments: per-region secret, EU key present (fix for INC-1001)",
  config: { target: "price-cache", summary: "flush keyspace + ttl=0 (cache migration step 2/3)", actor: "platform-bot" },
} as const;

const scenarioTrap = async (waitS: number): Promise<number> => {
  const d = await post("/admin/deploy", { version: TRAP.version, mode: "healthy", author: "sven", summary: TRAP.deploySummary });
  console.log(`▶ 1/3 deployed ${TRAP.version} (healthy): ${JSON.stringify(d.json)}`);
  if (d.status !== 200) return 1;
  console.log(`  waiting ${waitS} s …`);
  await new Promise((r) => setTimeout(r, waitS * 1000));
  const c = await post("/admin/config", TRAP.config);
  const f = await post("/admin/cache", { action: "flush" });
  console.log(`▶ 2/3 config push recorded and price-cache flushed (${c.status}/${f.status})`);
  if (c.status !== 200 || f.status !== 200) return 1;
  console.log("▶ 3/3 now watch the console");
  return 0;
};

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string" }, rps: { type: "string" }, author: { type: "string" }, summary: { type: "string" }, retry: { type: "string" }, wait: { type: "string" } },
  });
  const cmd = positionals[0];
  if (cmd === "traffic") {
    const retry = Number(values.retry ?? 0);
    if (!Number.isInteger(retry) || retry < 0 || retry > 5) { console.error("usage: traffic [--rps N] [--retry 0..5]"); return 1; }
    return traffic(Number(values.rps ?? 8), retry);
  }
  if (cmd === "scenario") {
    const wait = Number(values.wait ?? 60);
    if (positionals[1] !== "correlation-trap" || !Number.isFinite(wait) || wait < 0) { console.error("usage: chaos scenario correlation-trap [--wait 60]"); return 1; }
    return scenarioTrap(wait);
  }
  if (cmd === "cache") {
    const action = positionals[1];
    if (action !== "warm" && action !== "flush") { console.error("usage: chaos cache warm|flush"); return 1; }
    const r = await post("/admin/cache", { action });
    console.log(`▶ cache ${action}: ${JSON.stringify(r.json)}`);
    return r.status === 200 ? 0 : 1;
  }
  if (cmd === "state") { console.log(JSON.stringify(await get("/admin/state"), null, 2)); return 0; }
  if (cmd === "degrade") {
    const mode = values.mode as Mode | undefined;
    if (!mode || !MODES.includes(mode)) { console.error(`usage: chaos degrade --mode ${MODES.join("|")}`); return 1; }
    const r = await post("/admin/degrade", { mode });
    console.log(`▶ degraded to ${mode} with NO deploy record: ${JSON.stringify(r.json)}`);
    return r.status === 200 ? 0 : 1;
  }
  if (cmd === "deploy") {
    const version = positionals[1];
    const mode = values.mode as Mode | undefined;
    if (!version || !mode || !MODES.includes(mode)) { console.error(`usage: chaos deploy <version> --mode ${MODES.join("|")}`); return 1; }
    const summaries: Record<Mode, string> = {
      healthy: "routine release",
      "bad-deploy": "payments: switch EU traffic to new provider config",
      slow: "inventory: synchronous reserve call",
      errors: "gateway: new upstream endpoint",
      "cache-loss": "price-cache: migration step",
    };
    const r = await post("/admin/deploy", { version, mode, author: values.author ?? "sven", summary: values.summary ?? summaries[mode] });
    console.log(`▶ deployed ${version} in mode ${mode}: ${JSON.stringify(r.json)}`);
    return r.status === 200 ? 0 : 1;
  }
  console.error("usage: chaos traffic [--rps N] [--retry N] | chaos deploy <version> --mode <mode> | chaos degrade --mode <mode> | chaos state | chaos scenario correlation-trap [--wait 60] | chaos cache warm|flush");
  return 1;
};

if (process.argv[1]?.endsWith("chaos.ts") || process.argv[1]?.endsWith("chaos.js")) {
  main().then((c) => process.exit(c), (e: unknown) => { console.error(e); process.exit(1); });
}
