import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

test("shop serves the local workshop without exposing network access", { timeout: 15_000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "shop-loopback-"));
  const socket = createServer().listen(0, "127.0.0.1");
  await once(socket, "listening");
  const address = socket.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>(resolve => socket.close(() => resolve()));
  const child = spawn(process.execPath, ["--import", "tsx", "demo/shop.ts"], {
    env: { ...process.env, AGENT_SHOP_PORT: String(port), AGENT_DEMO_DATA: dir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = once(child, "exit");
      child.kill();
      await closed;
    }
    await rm(dir, { recursive: true, force: true });
  });
  let output = "";
  let errors = "";
  child.stderr.on("data", (chunk: Buffer) => { errors += chunk.toString(); });
  await new Promise<void>((resolve, reject) => {
    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes("shop listening")) resolve();
    });
    child.once("error", reject);
    child.once("exit", code => reject(new Error(`Shop exited ${code}: ${errors}`)));
  });
  const base = `http://127.0.0.1:${port}`;
  assert.ok(output.includes(base));
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  const state = await health.json() as { revision: string; mode: string };
  assert.equal(state.revision, "v2.14.0");
  assert.equal(state.mode, "healthy");
  const storefront = await fetch(base);
  assert.equal(storefront.status, 200);
  assert.match(storefront.headers.get("content-type") ?? "", /text\/html/);
  assert.match(await storefront.text(), /checkout-api/);

  const external = Object.values(networkInterfaces()).flat().find(info => info && !info.internal && info.family === "IPv4");
  await t.test("refuses connections through a non-loopback interface", {
    skip: external ? false : "no non-loopback IPv4 interface",
  }, async () => {
    assert.ok(external);
    await assert.rejects(fetch(`http://${external.address}:${port}/health`, {
      signal: AbortSignal.timeout(2_000),
    }), error => {
      const cause = error && typeof error === "object" && "cause" in error ? error.cause : undefined;
      if (cause !== null && typeof cause === "object" && "code" in cause && cause.code === "ECONNREFUSED") return true;
      // Windows Firewall drops instead of refusing, so the probe times out. Still unreachable,
      // but a timeout cannot tell loopback-only from firewalled: the strict check runs on Linux/macOS CI.
      return process.platform === "win32" && error instanceof Error && error.name === "TimeoutError";
    });
  });
});
