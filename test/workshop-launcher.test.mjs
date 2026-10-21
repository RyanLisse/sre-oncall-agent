import { strict as assert } from "node:assert";
import { createServer } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { dependencyInstallSpec } from "../scripts/start.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const launcher = join(root, "scripts", "start.mjs");

const run = (args, extraEnv = {}) => {
  const env = { ...process.env, ...extraEnv };
  for (const key of ["AGENT_MODEL", "AGENT_SHOP_URL", "AGENT_DEMO_DATA", "AGENT_TELEMETRY"]) delete env[key];
  return spawnSync(process.execPath, [launcher, ...args], {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 15_000,
  });
};

const unusedPort = () =>
  new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.once("error", rejectPort);
    server.listen({ host: "127.0.0.1", port: 0 }, () => {
      const address = server.address();
      server.close(() => resolvePort(address.port));
    });
  });

test("launcher help gives facilitator-friendly offline startup and stop instructions", () => {
  const result = run(["--help"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /npm start -- --fast/);
  assert.match(result.stdout, /five minutes/);
  assert.match(result.stdout, /Ctrl-C/);
  assert.match(result.stdout, /No API key/);
});

test("launcher rejects malformed ports before starting children", () => {
  const result = run([], { AGENT_SHOP_PORT: "not-a-port" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /AGENT_SHOP_PORT must be an integer/);
  assert.doesNotMatch(result.stdout, /shop listening/);
});

test("launcher refuses ambient model configuration with an actionable offline error", () => {
  const result = spawnSync(process.execPath, [launcher], {
    cwd: root,
    env: { ...process.env, AGENT_MODEL: "ambient-model" },
    encoding: "utf8",
    timeout: 15_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /explicitly offline/);
  assert.match(result.stderr, /Unset it/);
});

test("launcher refuses a busy shop port without killing its owner", async () => {
  const shopPort = await unusedPort();
  const consolePort = await unusedPort();
  const busy = createServer();
  await new Promise((resolveListen, rejectListen) => {
    busy.once("error", rejectListen);
    busy.listen({ host: "127.0.0.1", port: shopPort }, resolveListen);
  });
  try {
    const result = run([], { AGENT_SHOP_PORT: String(shopPort), AGENT_CONSOLE_PORT: String(consolePort) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Shop preflight failed/);
    assert.match(result.stderr, /will not kill unknown processes/);
    assert.equal(busy.listening, true);
  } finally {
    await new Promise((resolveClose) => busy.close(resolveClose));
  }
});

test("Windows dependency installation invokes npm through Node or a static cmd fallback", () => {
  assert.deepEqual(
    dependencyInstallSpec({ npm_execpath: "C:\\node\\node_modules\\npm\\bin\\npm-cli.js" }, "win32"),
    { command: process.execPath, args: ["C:\\node\\node_modules\\npm\\bin\\npm-cli.js", "ci"] },
  );
  assert.deepEqual(
    dependencyInstallSpec({ ComSpec: "C:\\Windows\\System32\\cmd.exe" }, "win32"),
    { command: "C:\\Windows\\System32\\cmd.exe", args: ["/d", "/s", "/c", "npm ci"] },
  );
});
