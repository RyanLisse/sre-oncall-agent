/**
 * ops.ts — operator commands around the agent: doctor · live · watch-deploy · execute
 * ---------------------------------------------------------------------------
 *   npm run doctor                                   preflight: node, deps, fixtures, bench, shop, key
 *   npm run live -- --alert "Error rate 12% ..."     build an incident file from the live shop telemetry
 *   npm run watch-deploy -- "Watch the next deployment for five minutes."
 *   npm run execute -- <incident-file>               approved rollback + fresh evidence (separate system)
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { parseIncident } from "./contract.js";
import { parseStopCommand, parseWatchCommand, runWatch } from "./deployWatch.js";
import { execute } from "./executor.js";
import { loadTelemetry } from "./telemetry.js";

const SHOP = process.env.AGENT_SHOP_URL ?? `http://localhost:${process.env.AGENT_SHOP_PORT ?? 4310}`;
const LIVE_TELEMETRY = process.env.AGENT_DEMO_DATA ? `${process.env.AGENT_DEMO_DATA}/telemetry.json` : "demo/data/telemetry.json";

const shopHealth = async (): Promise<{ revision: string; mode: string } | undefined> => {
  try { return (await (await fetch(`${SHOP}/health`)).json()) as { revision: string; mode: string }; } catch { return undefined; }
};

// ── doctor ───────────────────────────────────────────────────────────────
const doctor = async (): Promise<number> => {
  const rows: [string, boolean, string][] = [];
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  rows.push(["node ≥ 22", nodeMajor >= 22, process.versions.node]);
  rows.push(["@anthropic-ai/claude-agent-sdk installed", existsSync("node_modules/@anthropic-ai/claude-agent-sdk/package.json"), existsSync("node_modules/@anthropic-ai/claude-agent-sdk/package.json") ? (JSON.parse(readFileSync("node_modules/@anthropic-ai/claude-agent-sdk/package.json", "utf8")) as { version: string }).version : "run npm install"]);
  rows.push(["fixtures generated", existsSync("fixtures/telemetry/bad-deploy.json"), existsSync("fixtures/telemetry/bad-deploy.json") ? "fixtures/telemetry/*.json" : "run npm run fixtures"]);
  rows.push(["diagrams generated", existsSync("docs/diagrams/01-architecture.svg"), existsSync("docs/diagrams/01-architecture.svg") ? "docs/diagrams/*.svg" : "run npm run diagrams"]);
  const ratchet = JSON.parse(readFileSync("bench/ratchet.json", "utf8")) as { min_rate: number; max_harmful: number };
  rows.push(["bench ratchet", ratchet.max_harmful === 0, `min_rate ${ratchet.min_rate} · max_harmful ${ratchet.max_harmful}`]);
  rows.push(["lessons.md present", existsSync("lessons/lessons.md"), "lessons/lessons.md"]);
  rows.push(["ANTHROPIC_API_KEY in shell", Boolean(process.env.ANTHROPIC_API_KEY), process.env.ANTHROPIC_API_KEY ? "set (real --model runs possible)" : "not set — offline only (fine for the tutorial)"]);
  const h = await shopHealth();
  rows.push(["demo shop reachable", Boolean(h), h ? `${SHOP} · ${h.revision} · mode ${h.mode}` : `${SHOP} — start with npm run shop (optional)`]);
  rows.push(["live telemetry file", existsSync(LIVE_TELEMETRY), existsSync(LIVE_TELEMETRY) ? LIVE_TELEMETRY : "appears once the shop runs"]);
  for (const [name, okk, note] of rows) console.log(`${okk ? "✅" : "⚠️ "} ${name.padEnd(42)} ${note}`);
  const hard = rows.slice(0, 3).every((r) => r[1]);
  console.log(hard ? "\nPASS doctor · offline path ready" : "\nFAIL doctor · fix the ⚠️ rows above first");
  return hard ? 0 : 1;
};

// ── live: snapshot the shop's telemetry into an incident file ────────────
const live = async (alert: string, out: string): Promise<number> => {
  const t = await loadTelemetry(LIVE_TELEMETRY);
  if (!t.ok) { console.error(`FAIL no live telemetry at ${LIVE_TELEMETRY} — is the shop running with traffic?`); return 1; }
  const id = `INC-${Math.floor(Date.now() / 1000) % 100000}`;
  const incident = { incident_id: id, service: "checkout", alert, fired_at: new Date().toISOString() };
  const parsed = parseIncident(incident);
  if (!parsed.ok) { console.error(parsed.errors.join("\n")); return 1; }
  const snapshotPath = out.replace(/\.json$/, ".telemetry.json");
  await mkdir("demo/incidents", { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify(t.value, null, 2)}\n`);
  await writeFile(out, `${JSON.stringify({ incident, telemetry: snapshotPath }, null, 2)}\n`);
  console.log(`▶ ${id} written → ${out}  (telemetry snapshot: ${snapshotPath}, ${t.value.metrics.length} buckets, ${t.value.deploys.length} deploys)`);
  console.log(`  next: npm run investigate -- ${out}`);
  return 0;
};

// ── watch-deploy: the chat command, bounded, no model ────────────────────
const watchDeploy = async (text: string): Promise<number> => {
  if (parseStopCommand(text)) { console.log("nothing to stop in a one-shot CLI; Ctrl-C stops a running watch"); return 0; }
  const cmd = parseWatchCommand(text);
  if (!cmd.ok) { console.error(`FAIL ${cmd.errors.join("; ")}`); return 1; }
  const ac = new AbortController();
  process.on("SIGINT", () => ac.abort());
  console.log(`▶ watching ${cmd.value.target} deployment for ${cmd.value.minutes} min · ${SHOP} · policy: 3 consecutive failures | 3 consecutive >1000 ms | ≥3 5xx`);
  const r = await runWatch(cmd.value, {
    shopUrl: SHOP,
    intervalMs: Number(process.env.AGENT_WATCH_INTERVAL_MS ?? 10_000),
    signal: ac.signal,
    onTick: (o, p) => console.log(`  ${o.at.slice(11, 19)}  ${o.verified ? (o.ok ? "ok " : "FAIL") : "unverified"}  ${String(o.ms).padStart(5)} ms  rev ${o.revision ?? "?"}  streak f${p.consecutiveFailures}/s${p.consecutiveSlow}`),
  });
  console.log(`\n${r.outcome.toUpperCase()} watch · revision ${r.revision} · ${r.observations.length} checks${r.reason ? ` · ${r.reason}` : ""}`);
  if (r.outcome === "failed") {
    const out = `demo/incidents/watch-${Date.now()}.json`;
    await live(`Deployment watch failed on ${r.revision}: ${r.reason}`, out);
    console.log("No automatic rollback. Investigate, then a human decides.");
    return 2;
  }
  return 0;
};

// ── execute: the separate system ─────────────────────────────────────────
const runExecute = async (incidentFile: string): Promise<number> => {
  const f = JSON.parse(await readFile(incidentFile, "utf8")) as { incident: unknown; telemetry: string };
  const incident = parseIncident(f.incident);
  if (!incident.ok) { console.error(incident.errors.join("\n")); return 1; }
  console.log(`▶ executor · ${incident.value.incident_id} · ${SHOP}`);
  const r = await execute(incident.value, { shopUrl: SHOP, approvalsDir: process.env.AGENT_APPROVALS_DIR ?? "approvals", telemetryPath: f.telemetry, log: (l) => console.log(`  ${l}`) });
  if (!r.ok) { console.error(`\nREFUSED executor\n  - ${r.errors.join("\n  - ")}`); return 1; }
  console.log(`\nPASS executor · ${r.value.plan.from_version} → ${r.value.plan.to_version} with fresh evidence. Now run watch to confirm the metric lands; a human closes.`);
  return 0;
};

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { alert: { type: "string" }, out: { type: "string" } } });
  const cmd = positionals[0];
  if (cmd === "doctor") return doctor();
  if (cmd === "live") return live(values.alert ?? "Error rate above threshold on checkout", values.out ?? `demo/incidents/live-${Date.now()}.json`);
  if (cmd === "watch-deploy") return watchDeploy(positionals.slice(1).join(" ") || "Watch this deployment for five minutes.");
  if (cmd === "execute") { if (!positionals[1]) { console.error("usage: execute <incident-file>"); return 1; } return runExecute(positionals[1]); }
  console.error("usage: ops doctor | live --alert <text> | watch-deploy <command> | execute <incident-file>");
  return 1;
};

main().then((c) => process.exit(c), (e: unknown) => { console.error(e); process.exit(1); });
