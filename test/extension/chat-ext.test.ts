// Extension: the console's "Ask the agent" path gets list_changes + get_trace, read-only.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ask } from "../../src/chat.js";
import type { QueryArgs, QueryFn } from "../../src/runtime.js";
import { createTelemetryServer, EXT_TOOL_NAMES, TOOL_NAMES } from "../../src/tools.js";
import { loadTelemetry, type Telemetry } from "../../src/telemetry.js";

const load = async (name: string): Promise<Telemetry> => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  if (!t.ok) throw new Error(t.errors.join());
  return t.value;
};

/** Captures the options ask() hands to the model; answers with a fixed result. */
const capture = (): { query: QueryFn; seen: () => QueryArgs | undefined } => {
  let seen: QueryArgs | undefined;
  const query: QueryFn = async function* (args) {
    seen = args;
    yield { type: "result", subtype: "success", result: "ok" };
  };
  return { query, seen: () => seen };
};

const READ_ONLY = new Set<string>([...TOOL_NAMES, ...EXT_TOOL_NAMES].map((n) => `mcp__telemetry__${n}`));

test("chat on telemetry with changes/traces: the model may call list_changes and get_trace", async () => {
  const prev = process.env.AGENT_EXT;
  delete process.env.AGENT_EXT;
  try {
    const c = capture();
    assert.equal(await ask("What changed before the errors?", { telemetry: await load("correlation-trap"), model: "test-model", query: c.query }), "ok");
    const o = c.seen()?.options;
    assert.ok(o);
    for (const n of EXT_TOOL_NAMES) {
      assert.ok(o?.allowedTools?.includes(`mcp__telemetry__${n}`), `${n} allowed`);
      assert.ok((o?.tools as string[] | undefined)?.includes(`mcp__telemetry__${n}`), `${n} offered`);
    }
    assert.ok((o?.allowedTools ?? []).every((t) => READ_ONLY.has(t)), "only read-only telemetry tools");
  } finally {
    if (prev !== undefined) process.env.AGENT_EXT = prev;
  }
});

test("chat on W5 telemetry keeps exactly the four W5 tools", async () => {
  const prev = process.env.AGENT_EXT;
  delete process.env.AGENT_EXT;
  try {
    const c = capture();
    await ask("How is production doing?", { telemetry: await load("bad-deploy"), model: "test-model", query: c.query });
    assert.deepEqual(c.seen()?.options.allowedTools, TOOL_NAMES.map((n) => `mcp__telemetry__${n}`));
  } finally {
    if (prev !== undefined) process.env.AGENT_EXT = prev;
  }
});

test("the MCP server chat uses registers no tool outside the read-only set", async () => {
  const inst = createTelemetryServer(await load("correlation-trap")).instance as unknown as { _registeredTools?: Record<string, unknown>; server?: { _registeredTools?: Record<string, unknown> } };
  const names = Object.keys(inst._registeredTools ?? inst.server?._registeredTools ?? {});
  assert.ok(names.length >= 5);
  for (const n of names) assert.ok(READ_ONLY.has(`mcp__telemetry__${n}`), n);
});

test("offline chat answer lists the latest changes, cfg-912 included; W5 telemetry answer unchanged", async () => {
  const trap = await ask("anything changed?", { telemetry: await load("correlation-trap"), model: "offline" });
  assert.match(trap, /Latest changes \(all kinds\): cfg-912 config price-cache/);
  const w5 = await ask("anything changed?", { telemetry: await load("bad-deploy"), model: "offline" });
  assert.doesNotMatch(w5, /Latest changes/);
});
