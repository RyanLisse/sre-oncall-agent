// Workshop A5 — a read-only tool: list_deploys bound to its capability.
// Red on workshop/start; rebuild in src/tools.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTelemetryServer, handlers } from "../../src/tools.js";
import { loadTelemetry } from "../../src/telemetry.js";

test("A5: list_deploys is bound to telemetry.listDeploys and returns deploys", async () => {
  const t = await loadTelemetry("fixtures/telemetry/bad-deploy.json");
  if (!t.ok) throw new Error("fixture telemetry missing");
  const deploys = handlers(t.value).list_deploys({});
  assert.ok(Array.isArray(deploys), "handler must return the deploy list");
  assert.ok(deploys.length >= 1, "fixture has at least one deploy");
});

test("A5: list_deploys is registered on the telemetry MCP server", async () => {
  const t = await loadTelemetry("fixtures/telemetry/bad-deploy.json");
  if (!t.ok) throw new Error("fixture telemetry missing");
  const server = createTelemetryServer(t.value);
  const inst = server.instance as unknown as { _registeredTools?: Record<string, unknown>; server?: { _registeredTools?: Record<string, unknown> } };
  const registered = inst._registeredTools ?? inst.server?._registeredTools ?? {};
  assert.ok("list_deploys" in registered, "server must register a list_deploys tool");
});
