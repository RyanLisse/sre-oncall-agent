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
 * This is the operator's lever, not the agent's. The agent cannot call
 * /admin/deploy; only a human (here) or the approved executor (src/executor.ts)
 * can.
 */
import { parseArgs } from "node:util";
import { MODES, type Mode } from "./shop.js";

export const SHOP_URL = process.env.AGENT_SHOP_URL ?? `http://localhost:${process.env.AGENT_SHOP_PORT ?? 4310}`;

export const post = async (path: string, data: unknown): Promise<{ status: number; json: unknown; ms: number }> => {
  const t0 = Date.now();
  const r = await fetch(`${SHOP_URL}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  return { status: r.status, json: await r.json().catch(() => ({})), ms: Date.now() - t0 };
};

export const get = async (path: string): Promise<unknown> => (await fetch(`${SHOP_URL}${path}`)).json();

const traffic = async (rps: number): Promise<never> => {
  console.log(`▶ traffic ${rps}/s → ${SHOP_URL}/checkout  (Ctrl-C to stop)`);
  let n = 0, errs = 0;
  setInterval(() => {
    for (let i = 0; i < rps; i++) {
      post("/checkout", {}).then((r) => { n++; if (r.status >= 500) errs++; }).catch(() => errs++);
    }
  }, 1000);
  setInterval(() => { console.log(`  ${new Date().toISOString().slice(11, 19)}  requests ${n}  5xx ${errs}`); n = 0; errs = 0; }, 10_000);
  return new Promise(() => undefined);
};

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { mode: { type: "string" }, rps: { type: "string" }, author: { type: "string" }, summary: { type: "string" } },
  });
  const cmd = positionals[0];
  if (cmd === "traffic") return traffic(Number(values.rps ?? 8));
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
    };
    const r = await post("/admin/deploy", { version, mode, author: values.author ?? "sven", summary: values.summary ?? summaries[mode] });
    console.log(`▶ deployed ${version} in mode ${mode}: ${JSON.stringify(r.json)}`);
    return r.status === 200 ? 0 : 1;
  }
  console.error("usage: chaos traffic [--rps N] | chaos deploy <version> --mode <mode> | chaos degrade --mode <mode> | chaos state");
  return 1;
};

if (process.argv[1]?.endsWith("chaos.ts") || process.argv[1]?.endsWith("chaos.js")) {
  main().then((c) => process.exit(c), (e: unknown) => { console.error(e); process.exit(1); });
}
