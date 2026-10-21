import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = join(ROOT, "demo", "data");
const TELEMETRY_PATH = join(DATA_DIR, "telemetry.json");
const REQUIRED_FIXTURES = ["bad-deploy", "after-rollback", "slow-dependency", "noisy-alert", "mystery-errors"];
const DEFAULT_SHOP_PORT = 4310;
const DEFAULT_CONSOLE_PORT = 4320;
const READY_TIMEOUT_MS = 20_000;

const usage = () => {
  console.log(`Workshop launcher (offline by default)

Usage:
  npm start
  npm start -- --fast
  npm start -- --help

Starts the local shop, traffic generator, and on-call console without
approving, executing, or creating a chaos deployment. The normal detection
window is five minutes; --fast uses one minute for a rehearsal.

Before starting, the launcher checks Node 22+, node:sqlite, dependencies,
fixture data, and both local ports. If a port is busy, stop that service
yourself and retry; this launcher never kills an unknown process.

Stop with Ctrl-C. After editing code, stop this launcher and run npm start
again. No API key or Git installation is needed.`);
};

const fail = (message) => {
  throw new Error(message);
};

const parseArgs = (args) => {
  let fast = false;
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return { help: true, fast: false };
    if (arg === "--fast") {
      fast = true;
      continue;
    }
    fail(`Unknown option "${arg}". Run npm start -- --help for usage.`);
  }
  return { help: false, fast };
};

const parsePort = (raw, name, fallback) => {
  const value = raw ?? String(fallback);
  if (!/^[1-9]\d*$/.test(value)) {
    fail(`${name} must be an integer from 1 to 65535 (received "${value}"). Set ${name} and retry.`);
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) {
    fail(`${name} must be an integer from 1 to 65535 (received "${value}"). Set ${name} and retry.`);
  }
  return port;
};

const localPath = (value) => (isAbsolute(value) ? resolve(value) : resolve(ROOT, value));

const validateLocalOverrides = (shopPort) => {
  if (process.env.AGENT_MODEL) {
    fail(`AGENT_MODEL is set, but this workshop is explicitly offline. Unset it (for example: "unset AGENT_MODEL" or "Remove-Item Env:AGENT_MODEL") and run npm start again. No API key is needed.`);
  }

  if (process.env.AGENT_SHOP_URL) {
    let url;
    try {
      url = new URL(process.env.AGENT_SHOP_URL);
    } catch {
      fail(`AGENT_SHOP_URL must be a local http URL for the launched shop, such as http://127.0.0.1:${shopPort}. Unset it or correct it and retry.`);
    }
    const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
    const urlPort = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
    if (url.protocol !== "http:" || !localHosts.has(url.hostname) || urlPort !== shopPort) {
      fail(`AGENT_SHOP_URL points outside the launched local shop. Unset it or set it to http://127.0.0.1:${shopPort}; remote or mismatched shops are refused.`);
    }
  }

  if (process.env.AGENT_DEMO_DATA && localPath(process.env.AGENT_DEMO_DATA) !== DATA_DIR) {
    fail(`AGENT_DEMO_DATA must be ${DATA_DIR} so the console and launched shop use one telemetry store. Unset it or point it there, then retry.`);
  }
  if (process.env.AGENT_TELEMETRY && localPath(process.env.AGENT_TELEMETRY) !== TELEMETRY_PATH) {
    fail(`AGENT_TELEMETRY must be ${TELEMETRY_PATH} so the console follows the launched shop. Unset it or point it there, then retry.`);
  }
};

const closeServer = (server) =>
  new Promise((resolveClose) => {
    if (!server.listening) {
      resolveClose();
      return;
    }
    server.close(() => resolveClose());
  });

const reservePort = (port) =>
  new Promise((resolveReserve, rejectReserve) => {
    const server = createServer();
    server.once("error", (error) => {
      rejectReserve(new Error(`Port ${port} is busy or unavailable (${error.code ?? error.message}). Stop the process using it and retry; the launcher will not kill unknown processes.`));
    });
    server.listen({ host: "127.0.0.1", port }, () => resolveReserve(server));
  });

const preflightPorts = async (ports) => {
  const reservations = [];
  try {
    for (const [name, port] of ports) {
      try {
        reservations.push(await reservePort(port));
      } catch (error) {
        fail(`${name} preflight failed: ${error.message}`);
      }
    }
  } finally {
    await Promise.all(reservations.map(closeServer));
  }
};

const runCommand = (command, args, options = {}) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: "inherit", ...options });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${args.join(" ")} exited with ${signal ?? `code ${code}`}`));
    });
  });

const dependencyInstallSpec = (env = process.env, platform = process.platform) => {
  if (platform !== "win32") return { command: "npm", args: ["ci"] };
  if (env.npm_execpath) return { command: process.execPath, args: [env.npm_execpath, "ci"] };
  return { command: env.ComSpec ?? env.COMSPEC ?? "cmd.exe", args: ["/d", "/s", "/c", "npm ci"] };
};

const ensureRuntime = async () => {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    fail(`Node 22 or newer is required (found ${process.version}). Install a current Node release and run npm start again.`);
  }
  try {
    await import("node:sqlite");
  } catch (error) {
    fail(`This Node build cannot load node:sqlite (${error.message}). Install Node 22+ with node:sqlite support and run npm start again.`);
  }
};

const ensureDependencies = async () => {
  const missing = ["tsx", "@anthropic-ai/claude-agent-sdk", "zod"].some(
    (name) => !existsSync(join(ROOT, "node_modules", ...name.split("/"), "package.json")),
  );
  if (!missing) return;
  console.log("Dependencies are missing; running npm ci once.");
  const install = dependencyInstallSpec();
  try {
    await runCommand(install.command, install.args);
  } catch (error) {
    fail(`npm ci could not install dependencies: ${error.message}. Run npm ci from the workshop directory and retry.`);
  }
};

const ensureFixtures = async () => {
  const missing = REQUIRED_FIXTURES.some((name) => !existsSync(join(ROOT, "fixtures", "telemetry", `${name}.json`)));
  if (!missing) return;
  console.log("Fixture data is missing; generating deterministic fixtures.");
  await runCommand(process.execPath, ["fixtures/generate.mjs"]);
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
  const child = spawn(process.execPath, ["--import", "tsx", ...args], {
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
  if (process.platform === "win32") {
    await new Promise((resolveStop) => {
      const killer = spawn("taskkill.exe", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
      killer.once("close", resolveStop);
      killer.once("error", resolveStop);
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
  await new Promise((resolveStop) => {
    const timer = setTimeout(resolveStop, 2_000);
    child.once("close", () => {
      clearTimeout(timer);
      resolveStop();
    });
  });
};

const waitForReady = async (session, url, label) => {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError = "not responding";
  while (Date.now() < deadline) {
    if (session.failure) throw session.failure;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 150));
  }
  throw new Error(`${label} did not become ready at ${url} within ${READY_TIMEOUT_MS / 1000}s (${lastError}).`);
};

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

export { archiveTelemetry, dependencyInstallSpec, parsePort, preflightPorts, validateLocalOverrides };

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  await ensureRuntime();
  const shopPort = parsePort(process.env.AGENT_SHOP_PORT, "AGENT_SHOP_PORT", DEFAULT_SHOP_PORT);
  const consolePort = parsePort(process.env.AGENT_CONSOLE_PORT, "AGENT_CONSOLE_PORT", DEFAULT_CONSOLE_PORT);
  if (shopPort === consolePort) fail(`AGENT_SHOP_PORT and AGENT_CONSOLE_PORT must be different (both are ${shopPort}). Choose two local ports and retry.`);
  validateLocalOverrides(shopPort);
  await preflightPorts([
    ["Shop", shopPort],
    ["Console", consolePort],
  ]);
  await ensureDependencies();
  await ensureFixtures();
  const archived = archiveTelemetry();

  const env = {
    ...process.env,
    AGENT_SHOP_PORT: String(shopPort),
    AGENT_CONSOLE_PORT: String(consolePort),
    AGENT_SHOP_URL: `http://127.0.0.1:${shopPort}`,
    AGENT_DEMO_DATA: DATA_DIR,
    AGENT_TELEMETRY: TELEMETRY_PATH,
    AGENT_LISTEN_WINDOW_MIN: options.fast ? "1" : process.env.AGENT_LISTEN_WINDOW_MIN ?? "5",
  };
  const session = { children: [], failure: undefined, stopping: false, interrupted: false, resolve: undefined };
  const stopAll = async () => {
    if (session.stopping) return;
    session.stopping = true;
    for (const child of [...session.children].reverse()) await stopChild(child);
  };
  const onChildExit = (name, child) => {
    child.once("exit", (code, signal) => {
      if (!session.stopping) {
        session.failure = new Error(`${name} exited unexpectedly (${signal ?? `code ${code}`}). Stop the workshop and inspect the prefixed logs.`);
        session.resolve?.();
      }
    });
  };
  const addChild = (name, args) => {
    const child = spawnChild(name, args, env);
    session.children.push(child);
    child.once("error", (error) => {
      if (!session.stopping) {
        session.failure = new Error(`${name} could not start: ${error.message}. Check dependencies and retry.`);
        session.resolve?.();
      }
    });
    onChildExit(name, child);
    return child;
  };
  const shutdown = () => {
    session.interrupted = true;
    session.failure = new Error("Launcher interrupted");
    console.log("Stopping workshop children (only processes started by this launcher).");
    session.resolve?.();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    if (archived) console.log(`Archived previous telemetry at ${archived}`);
    console.log(`Detection window: ${env.AGENT_LISTEN_WINDOW_MIN} minute${env.AGENT_LISTEN_WINDOW_MIN === "1" ? "" : "s"}${options.fast ? " (--fast)" : ""}`);
    const shop = addChild("shop", ["demo/shop.ts"]);
    await waitForReady(session, `http://127.0.0.1:${shopPort}/health`, "Shop");
    addChild("console", ["console/server.ts"]);
    await waitForReady(session, `http://127.0.0.1:${consolePort}/api/health`, "Console");
    addChild("traffic", ["demo/chaos.ts", "traffic"]);
    console.log(`Console: http://127.0.0.1:${consolePort}/`);
    console.log("Separate terminal chaos command: npm run chaos -- deploy v2.15.0 --mode bad-deploy");
    console.log("Stop with Ctrl-C. After edits, stop this launcher and run npm start again.");
    await new Promise((resolveSession) => {
      session.resolve = resolveSession;
      if (session.failure) resolveSession();
    });
    if (session.failure && !session.interrupted) throw session.failure;
  } catch (error) {
    if (!session.interrupted) throw error;
  } finally {
    await stopAll();
    process.removeListener("SIGINT", shutdown);
    process.removeListener("SIGTERM", shutdown);
  }
};

if (isMain) {
  main().catch((error) => {
    console.error(`Workshop launcher stopped: ${error.message}`);
    process.exitCode = 1;
  });
}
