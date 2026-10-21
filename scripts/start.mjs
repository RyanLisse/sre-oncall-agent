#!/usr/bin/env node
/**
 * scripts/start.mjs — one command for the whole lab
 * ---------------------------------------------------------------------------
 *   npm start            shop + traffic + console, one terminal, Ctrl+C stops all
 *   npm start -- --fast  the listener opens an incident after 1 minute, not 5
 *
 * Checks Node and dependencies first, generates fixtures when they are missing,
 * then starts the three processes in order and waits for each health URL.
 * Breaking the shop stays a separate, deliberate action:
 *   npm run chaos -- deploy v2.15.0 --mode bad-deploy
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const fast = process.argv.includes("--fast");
const SHOP_PORT = process.env.AGENT_SHOP_PORT ?? "4310";
const CONSOLE_PORT = process.env.AGENT_CONSOLE_PORT ?? "4320";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const say = (s) => console.log(`\x1b[1m▶ ${s}\x1b[0m`);
const fail = (s) => { console.error(`\x1b[31m✗ ${s}\x1b[0m`); process.exit(1); };

// ── 1. preflight ─────────────────────────────────────────────────────────
const major = Number(process.versions.node.split(".")[0]);
if (major < 22) fail(`Node ${process.versions.node} is too old. Install Node 22 or newer, then run npm start again.`);
if (!existsSync("node_modules/tsx") || !existsSync("node_modules/@anthropic-ai/claude-agent-sdk")) {
  say("dependencies missing → npm ci");
  if (spawnSync(npm, ["ci"], { stdio: "inherit", shell: process.platform === "win32" }).status !== 0) fail("npm ci failed. Read the error above.");
}
if (!existsSync("fixtures/telemetry/bad-deploy.json")) {
  say("fixtures missing → npm run fixtures");
  if (spawnSync(process.execPath, ["fixtures/generate.mjs"], { stdio: "inherit" }).status !== 0) fail("npm run fixtures failed.");
}
const up = (url) => fetch(url).then((r) => r.ok, () => false);
for (const [name, port] of [["shop", SHOP_PORT], ["console", CONSOLE_PORT]])
  if (await up(`http://localhost:${port}/${name === "shop" ? "health" : "api/health"}`))
    fail(`Port ${port} is already in use (${name}). Stop the other terminal with Ctrl+C, then run npm start again.`);

// ── 2. start, in order, with prefixed output ─────────────────────────────
const tsx = join("node_modules", "tsx", "dist", "cli.mjs");
const env = { ...process.env, ...(fast ? { AGENT_LISTEN_WINDOW_MIN: "1" } : {}) };
const children = [];
const colors = { shop: 36, traffic: 35, console: 33 };
const run = (name, args) => {
  const c = spawn(process.execPath, [tsx, ...args], { env, stdio: ["ignore", "pipe", "pipe"] });
  const prefix = `\x1b[${colors[name]}m${name.padEnd(7)}\x1b[0m │ `;
  for (const s of [c.stdout, c.stderr]) {
    let buf = "";
    s.on("data", (d) => { buf += d; const lines = buf.split("\n"); buf = lines.pop() ?? ""; for (const l of lines) console.log(prefix + l); });
  }
  c.on("exit", (code) => { if (!stopping) { console.error(`${prefix}stopped (exit ${code}). Stopping the lab.`); stop(1); } });
  children.push(c);
};
const waitFor = async (url, what) => {
  for (let i = 0; i < 60; i++) { if (await up(url)) return; await new Promise((r) => setTimeout(r, 500)); }
  fail(`${what} did not answer on ${url} within 30 s. Read its lines above.`);
};
let stopping = false;
const stop = (code = 0) => { stopping = true; for (const c of children) c.kill("SIGTERM"); setTimeout(() => process.exit(code), 300); };
process.on("SIGINT", () => { console.log("\nStopping shop, traffic and console …"); stop(0); });
process.on("SIGTERM", () => stop(0));

run("shop", ["demo/shop.ts"]);
await waitFor(`http://localhost:${SHOP_PORT}/health`, "The shop");
run("traffic", ["demo/chaos.ts", "traffic"]);
run("console", ["console/server.ts"]);
await waitFor(`http://localhost:${CONSOLE_PORT}/api/health`, "The console");

console.log(`
\x1b[1m✓ Lab running.\x1b[0m Keep this terminal open. Ctrl+C stops everything.

  Console   http://localhost:${CONSOLE_PORT}
  Shop      http://localhost:${SHOP_PORT}         (storefront + fault buttons; health: /health)
  Hub       npm run hub                  (participant card, slides, docs)

  Detection window: ${fast ? "1 minute (--fast)" : "5 minutes (npm start -- --fast for 1 minute)"}

  Break the shop when you choose to, in a SECOND terminal:
    npm run chaos -- deploy v2.15.0 --mode bad-deploy
  or with a fault button in the shop.
`);
