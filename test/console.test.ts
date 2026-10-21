import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { Store } from "../src/store.js";
import { parseIncident } from "../src/contract.js";
import { z } from "zod";

test("recovery instructions distinguish active, mitigated and resolved incidents", async () => {
  const source = await readFile("console/index.html", "utf8");
  const renderer = source.slice(source.indexOf("function renderRecovery("), source.indexOf("function renderIncident("));
  for (const [state, expected] of [["active", "human review required"], ["mitigated", "resolution pending"], ["resolved", "incident resolved"]] as const) {
    const html: unknown = runInNewContext(renderer + "\nrenderRecovery(state)", {
      state, esc: String, actions: { recovery: { status: "complete", report: {
        landed: true, metric: "error_rate", baseline: 0, limit: 0.005, checks: [],
      } } },
    });
    assert.ok(typeof html === "string");
    assert.ok(html.includes(expected));
    if (state !== "active") assert.doesNotMatch(html, /must still mark mitigated/);
    if (state === "resolved") assert.doesNotMatch(html, /resolve with notes/i);
  }
});

test("console API enforces resolved, recovery and named-human gates", { timeout: 30_000 }, async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "console-gates-"));
  const store = new Store(join(dir, "oncall.sqlite"));
  const fixture: unknown = JSON.parse(await readFile("fixtures/incidents/bad-deploy.json", "utf8"));
  const parsed = parseIncident(z.object({ incident: z.unknown() }).parse(fixture).incident); assert.ok(parsed.ok);
  const seed = (id: string, landed?: boolean) => {
    store.newIncident("Test checkout", "human", id);
    store.setIncidentJson(id, JSON.stringify({ incident: { ...parsed.value, incident_id: id }, telemetry: resolve("fixtures/telemetry/bad-deploy.json") }));
    store.add(id, "agent", "diagnosis", JSON.stringify({ proposal: "rollback" }));
    store.add(id, "system", "approval", JSON.stringify({ decision: "approved" }));
    if (landed !== undefined) store.add(id, "system", "recovery", JSON.stringify({ status: "complete", report: {
      metric: "error_rate", baseline: 0, limit: 0.005, checks: [], landed, message: landed ? "LANDED" : "NOT LANDED",
    } }));
  };
  const ids = { closed: "INC-901", failed: "INC-902", landed: "INC-903", once: "INC-904", interrupted: "INC-905" };
  seed(ids.closed, true); store.setState(ids.closed, "resolved", "Test human");
  seed(ids.failed, false);
  seed(ids.landed, true);
  seed(ids.once);
  seed(ids.interrupted); store.add(ids.interrupted, "system", "recovery", JSON.stringify({ status: "running" }));
  const socket = createServer().listen(0, "127.0.0.1"); await once(socket, "listening");
  const address = socket.address(); assert.ok(address && typeof address !== "string");
  const port = address.port; await new Promise<void>(r => socket.close(() => r()));
  const child = spawn(process.execPath, ["--import", "tsx", "console/server.ts"], { env: { ...process.env,
    AGENT_CONSOLE_PORT: String(port), AGENT_DB: join(dir, "oncall.sqlite"), AGENT_APPROVALS_DIR: join(dir, "approvals"),
    AGENT_DEMO_DATA: dir, AGENT_TELEMETRY: join(dir, "missing.json"), AGENT_LISTEN_MS: "600000", AGENT_MODEL: "",
  }, stdio: ["ignore", "pipe", "pipe"] });
  t.after(async () => { if (child.exitCode === null) { const closed = once(child, "exit"); child.kill(); await closed; } });
  await new Promise<void>((resolveReady, reject) => {
    child.stdout.on("data", (chunk: Buffer) => { if (chunk.toString().includes("on-call console")) resolveReady(); });
    child.once("error", reject); child.once("exit", code => reject(new Error(`Console exited ${code}`)));
  });
  const nonLoopback = Object.values(networkInterfaces()).flat().find(info => info && !info.internal && info.family === "IPv4");
  await t.test("console is unreachable via a non-loopback interface", {
    skip: nonLoopback ? false : "no non-loopback IPv4 interface",
  }, async () => {
    assert.ok(nonLoopback);
    await assert.rejects(fetch(`http://${nonLoopback.address}:${port}/api/health`, { signal: AbortSignal.timeout(2_000) }));
  });
  const post = (label: string, action: string, body: unknown = {}) => {
    const id = Object.entries(ids).find(([key]) => label === `INC-${key.toUpperCase()}`)?.[1];
    assert.ok(id);
    return fetch(`http://127.0.0.1:${port}/api/incidents/${id}/${action}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  }); };
  for (const action of ["execute", "approve", "reject"]) assert.equal((await post("INC-CLOSED", action, { by: "Test human" })).status, 409);
  assert.equal((await post("INC-CLOSED", "state", { state: "active", by: "Test human" })).status, 400);
  assert.equal((await post("INC-FAILED", "state", { state: "mitigated", by: "Test human" })).status, 409);
  assert.equal((await post("INC-FAILED", "execute")).status, 409);
  assert.equal((await post("INC-INTERRUPTED", "execute")).status, 409);
  assert.equal((await post("INC-LANDED", "state", { state: "resolved", by: "Test human", notes: "too soon" })).status, 409);
  assert.equal((await post("INC-LANDED", "state", { state: "mitigated", by: " " })).status, 400);
  assert.equal((await post("INC-LANDED", "state", { state: "mitigated", by: "Test human" })).status, 200);
  assert.equal((await post("INC-LANDED", "state", { state: "resolved", by: "Test human", notes: " " })).status, 400);
  const attempts = await Promise.all([post("INC-ONCE", "execute"), post("INC-ONCE", "execute")]);
  assert.deepEqual(attempts.map(r => r.status).sort(), [202, 409]);
  const details = await fetch(`http://127.0.0.1:${port}/api/incidents/${ids.once}`).then(r => r.json()) as { messages: { kind: string; text: string }[] };
  assert.equal(details.messages.filter(m => m.kind === "recovery" && m.text.includes('"running"')).length, 1);
});
