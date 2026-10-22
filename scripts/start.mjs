#!/usr/bin/env node
/**
 * scripts/start.mjs — one command for the whole lab
 * ---------------------------------------------------------------------------
 *   npm start            shop + traffic + console, one terminal, Ctrl+C stops launcher-owned processes
 *   npm start -- --fast  the listener opens an incident after 1 minute, not 5
 *
 * Checks Node and dependencies first, generates fixtures when they are missing,
 * then starts the three processes in order and waits for each health URL.
 * The console runs under tsx watch: it reloads on save, the shop keeps its state.
 * Breaking the shop stays a separate, deliberate action:
 *   npm run chaos -- deploy v2.15.0 --mode bad-deploy
 */
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { createInterface } from "node:readline";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "demo", "data");
const TELEMETRY_PATH = join(DATA_DIR, "telemetry.json");
const REQUIRED_FIXTURES = ["bad-deploy", "after-rollback", "slow-dependency", "noisy-alert", "mystery-errors"];

export const workshopModel = (args, env = process.env) =>
  args.includes("--offline") ? "offline" : env.AGENT_MODEL?.trim() || "sonnet";

export const dependencyInstallSpec = (env = process.env, platform = process.platform) => {
  if (platform !== "win32") return { command: "npm", args: ["ci"] };
  if (env.npm_execpath) return { command: process.execPath, args: [env.npm_execpath, "ci"] };
  return { command: env.ComSpec ?? env.COMSPEC ?? "cmd.exe", args: ["/d", "/s", "/c", "npm ci"] };
};

const port = (name, value) => {
  if (!/^[1-9]\d*$/.test(String(value))) throw new Error(`${name} must be an integer between 1 and 65535 (got "${value}")`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n > 65535) throw new Error(`${name} must be an integer between 1 and 65535 (got "${value}")`);
  return n;
};
const say = (s) => console.log(`\x1b[1m▶ ${s}\x1b[0m`);
const fail = (s) => { throw new Error(s); };

const validateLocalOverrides = (shopPort) => {
  if (process.env.AGENT_SHOP_URL) {
    let url;
    try { url = new URL(process.env.AGENT_SHOP_URL); } catch { fail(`AGENT_SHOP_URL must be a local http URL such as http://127.0.0.1:${shopPort}. Unset it or correct it and retry.`); }
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const urlPort = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (url.protocol !== "http:" || !localHosts.has(url.hostname) || urlPort !== shopPort) fail(`AGENT_SHOP_URL points outside the launched local shop. Unset it or set it to http://127.0.0.1:${shopPort}; remote or mismatched shops are refused.`);
  }
  const localPath = (value) => (isAbsolute(value) ? resolve(value) : resolve(ROOT, value));
  if (process.env.AGENT_DEMO_DATA && localPath(process.env.AGENT_DEMO_DATA) !== DATA_DIR) fail(`AGENT_DEMO_DATA must be ${DATA_DIR} so the console and launched shop use one telemetry store.`);
  if (process.env.AGENT_TELEMETRY && localPath(process.env.AGENT_TELEMETRY) !== TELEMETRY_PATH) fail(`AGENT_TELEMETRY must be ${TELEMETRY_PATH} so the console follows the launched shop.`);
};

const closeServer = (server) => new Promise((done) => {
  if (!server.listening) { done(); return; }
  server.close(() => done());
});
const reservePort = (portNumber) => new Promise((resolvePort, rejectPort) => {
  const server = createServer();
  server.once("error", (error) => rejectPort(new Error(`Port ${portNumber} is busy or unavailable (${error.code ?? error.message}). Stop the process using it and retry; the launcher will not kill unknown processes.`)));
  server.listen({ host: "127.0.0.1", port: portNumber }, () => resolvePort(server));
});
const preflightPorts = async (ports) => {
  const reservations = [];
  try {
    for (const [name, portNumber] of ports) {
      try { reservations.push(await reservePort(portNumber)); }
      catch (error) { fail(`${name} preflight failed: ${error.message}`); }
    }
  } finally {
    await Promise.all(reservations.map(closeServer));
  }
};

const ensureRuntime = async () => {
  if (Number(process.versions.node.split(".")[0]) < 22) fail(`Node 22 or newer is required (found ${process.version}). Install a current Node release and run npm start again.`);
  try { await import("node:sqlite"); }
  catch (error) { fail(`This Node build cannot load node:sqlite (${error.message}). Install Node 22+ with node:sqlite support and run npm start again.`); }
};

const ensureDependencies = async () => {
  const missing = ["tsx", "@anthropic-ai/claude-agent-sdk", "zod"].some((name) => !existsSync(join(ROOT, "node_modules", ...name.split("/"), "package.json")));
  if (!missing) return;
  say("Dependencies are missing; running npm ci once.");
  const spec = dependencyInstallSpec();
  const result = spawnSync(spec.command, spec.args, { cwd: ROOT, stdio: "inherit", shell: false });
  if (result.status !== 0) fail("npm ci could not install dependencies. Run npm ci from the workshop directory and retry.");
};

const ensureFixtures = async () => {
  if (!REQUIRED_FIXTURES.some((name) => !existsSync(join(ROOT, "fixtures", "telemetry", `${name}.json`)))) return;
  say("Fixture data is missing; generating deterministic fixtures.");
  const result = spawnSync(process.execPath, ["fixtures/generate.mjs"], { cwd: ROOT, stdio: "inherit" });
  if (result.status !== 0) fail("Fixture generation failed. Read the error above.");
};

const archiveTelemetry = () => {
  if (!existsSync(TELEMETRY_PATH)) return undefined;
  const archiveDir = join(DATA_DIR, "archive");
  mkdirSync(archiveDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  let destination = join(archiveDir, `telemetry-${stamp}.json`);
  let suffix = 1;
  while (existsSync(destination)) destination = join(archiveDir, `telemetry-${stamp}-${suffix++}.json`);
  copyFileSync(TELEMETRY_PATH, destination);
  return destination;
};

const prefixOutput = (stream, prefix) => {
  const lines = createInterface({ input: stream });
  lines.on("line", (line) => console.log(`[${prefix}] ${line}`));
};
const spawnChild = (name, args, env) => {
  const child = spawn(process.execPath, [join(ROOT, "node_modules/tsx/dist/cli.mjs"), ...args], {
    cwd: ROOT,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  prefixOutput(child.stdout, name);
  prefixOutput(child.stderr, `${name}:err`);
  return child;
};
const stopChild = async (child) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  if (!child.pid) { child.kill("SIGTERM"); return; }
  if (process.platform === "win32") {
    await new Promise((done) => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.once("close", done);
      killer.once("error", done);
    });
  } else {
    try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  }
  await new Promise((done) => {
    const timer = setTimeout(done, 2000);
    child.once("close", () => { clearTimeout(timer); done(); });
  });
};

const main = async () => {
const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Workshop launcher (real Claude Agent SDK by default)\n\nUsage:\n  npm start\n  npm start -- --fast\n  npm start -- --fast --offline\n  npm start -- --help\n\nStart Claude Code in a second terminal in the same checkpoint. See docs/claude-code.md for CLI login and separate SDK authentication. Model calls use your provider and may cost money. AGENT_MODEL overrides the default sonnet model. --offline explicitly selects scripted output, not model evidence. There is no automatic offline fallback.\n\nStarts the local shop, traffic generator and on-call console without approving, executing or creating a chaos deployment. Detection normally takes five minutes; --fast uses one minute. Keep this terminal open; Ctrl-C stops only children started here.");
  return;
}
if (args.some((arg) => !["--fast", "--offline"].includes(arg))) fail(`Unknown option "${args.find((arg) => !["--fast", "--offline"].includes(arg))}". Run npm start -- --help for usage.`);
const fast = args.includes("--fast");
const SHOP_PORT = port("AGENT_SHOP_PORT", process.env.AGENT_SHOP_PORT ?? "4310");
const CONSOLE_PORT = port("AGENT_CONSOLE_PORT", process.env.AGENT_CONSOLE_PORT ?? "4320");
if (SHOP_PORT === CONSOLE_PORT) fail("AGENT_SHOP_PORT and AGENT_CONSOLE_PORT must be different.");
await ensureRuntime();
validateLocalOverrides(SHOP_PORT);
await preflightPorts([["Shop", SHOP_PORT], ["Console", CONSOLE_PORT]]);
// ── 1. preflight ─────────────────────────────────────────────────────────
await ensureDependencies();
await ensureFixtures();
const archived = archiveTelemetry();

// ── 2. start, in order, with prefixed output ─────────────────────────────
const env = {
  ...process.env,
  AGENT_MODEL: workshopModel(args),
  AGENT_SHOP_PORT: String(SHOP_PORT),
  AGENT_CONSOLE_PORT: String(CONSOLE_PORT),
  AGENT_SHOP_URL: `http://127.0.0.1:${SHOP_PORT}`,
  AGENT_DEMO_DATA: DATA_DIR,
  AGENT_TELEMETRY: TELEMETRY_PATH,
  AGENT_LISTEN_WINDOW_MIN: fast ? "1" : process.env.AGENT_LISTEN_WINDOW_MIN ?? "5",
};
// Started from inside a Claude Code session, the SDK would refuse to nest; the console is its own session.
delete env.CLAUDECODE;
const children = [];
let failure;
let stopping = false;
let interrupted = false;
let resolveSession;
const run = (name, args) => {
  const c = spawnChild(name, args, env);
  c.on("error", (error) => {
    if (!stopping) { failure = new Error(`${name} could not start: ${error.message}. Check dependencies and retry.`); resolveSession?.(); }
  });
  c.on("exit", (code, signal) => {
    if (!stopping) { failure = new Error(`${name} exited unexpectedly (${signal ?? `code ${code}`}). Stop the lab and inspect its logs.`); resolveSession?.(); }
  });
  children.push(c);
  return c;
};
const waitFor = async (url, what) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (interrupted) return;
    if (failure) throw failure;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
    } catch { /* retry until the readiness deadline */ }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  fail(`${what} did not answer on ${url} within 30 seconds. Read the prefixed logs above.`);
};
const stop = async () => {
  if (stopping) return;
  stopping = true;
  for (const child of [...children].reverse()) await stopChild(child);
};
const shutdown = () => {
  interrupted = true;
  console.log("\nStopping workshop children started by this launcher.");
  resolveSession?.();
};
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  if (interrupted) return;
  if (archived) console.log(`Archived previous telemetry at ${archived}`);
  console.log(env.AGENT_MODEL === "offline"
    ? "Runtime: offline (explicit scripted fallback, not model evidence)."
    : `Runtime: Claude Agent SDK / ${env.AGENT_MODEL}. Model calls use your configured provider. No automatic offline fallback. See docs/claude-code.md for authentication.`);
  console.log(`Detection window: ${env.AGENT_LISTEN_WINDOW_MIN} minute${env.AGENT_LISTEN_WINDOW_MIN === "1" ? "" : "s"}${fast ? " (--fast)" : ""}`);
  run("shop", ["demo/shop.ts"]);
  await waitFor(`http://127.0.0.1:${SHOP_PORT}/health`, "Shop");
  if (interrupted) return;
  // tsx watch reloads only the console; the shop and traffic keep their state.
  run("console", ["watch", "--clear-screen=false", "console/server.ts"]);
  await waitFor(`http://127.0.0.1:${CONSOLE_PORT}/api/health`, "Console");
  if (interrupted) return;
  run("traffic", ["demo/chaos.ts", "traffic"]);

  console.log(`
  \x1b[1m✓ Lab running.\x1b[0m Keep this terminal open. Ctrl+C stops only children started here.

  Console   http://127.0.0.1:${CONSOLE_PORT}
  Shop      http://127.0.0.1:${SHOP_PORT}         (storefront + fault buttons; health: /health)
  Hub       http://127.0.0.1:${CONSOLE_PORT}/hub

  Detection window: ${fast ? "1 minute (--fast)" : "5 minutes (npm start -- --fast for 1 minute)"}

  Break the shop when you choose to, in a SECOND terminal:
    npm run chaos -- deploy v2.15.0 --mode bad-deploy
  or with a fault button in the shop.
`);
  await new Promise((resolve) => { resolveSession = resolve; if (failure || interrupted) resolve(); });
  if (failure) throw failure;
} finally {
  await stop();
  process.removeListener("SIGINT", shutdown);
  process.removeListener("SIGTERM", shutdown);
}
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => { console.error(`\x1b[31m✗ ${error.message}\x1b[0m`); process.exitCode = 1; });
}
