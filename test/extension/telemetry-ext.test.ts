// Extension: optional telemetry fields, list_changes, get_trace. npm run test:ext
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { test } from "node:test";
import { checkTrace } from "../../src/agent.js";
import { allowedToolsFor, createTelemetryServer, EXT_TOOL_NAMES, handlers, TOOL_NAMES } from "../../src/tools.js";
import { getTrace, listChanges, loadTelemetry, parseTelemetry, summarizeMetrics, type Telemetry } from "../../src/telemetry.js";

const load = async (name: string): Promise<Telemetry> => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  if (!t.ok) throw new Error(t.errors.join());
  return t.value;
};

test("every committed fixture still parses (the new fields are optional)", async () => {
  for (const f of readdirSync("fixtures/telemetry").filter((x) => x.endsWith(".json"))) {
    const t = await loadTelemetry(`fixtures/telemetry/${f}`);
    assert.equal(t.ok, true, f);
  }
});

test("optional fields parse; a wrong shape for changes/traces is rejected", () => {
  const base = { service: "s", logs: [], metrics: [], deploys: [] };
  assert.equal(parseTelemetry(base).ok, true);
  assert.equal(parseTelemetry({ ...base, changes: [], traces: [] }).ok, true);
  assert.equal(parseTelemetry({ ...base, changes: {} }).ok, false);
  assert.equal(parseTelemetry({ ...base, traces: "x" }).ok, false);
});

test("old fixtures: summarize_metrics output carries no extension keys", async () => {
  const s = summarizeMetrics(await load("bad-deploy"), "2026-10-05T02:50:00Z", "2026-10-05T03:50:00Z");
  for (const k of ["first_attempts_mean", "retries_mean", "cache_hit_ratio_mean", "groups"]) assert.equal(k in s, false, k);
  for (const bp of s.breakpoints) assert.deepEqual(Object.keys(bp).sort(), ["from", "to", "ts", "version", "what"]);
});

test("listChanges: cfg-912 and d-4830 in the window, oldest first; older deploys merged in", async () => {
  const t = await load("correlation-trap");
  const inWindow = listChanges(t, "2026-10-06T03:29:00Z", "2026-10-06T03:44:00Z");
  assert.deepEqual(inWindow.map((c) => c.id), ["d-4830", "cfg-912"]);
  assert.equal(inWindow[1]?.kind, "config");
  const all = listChanges(t);
  assert.deepEqual(all.map((c) => c.id), ["d-4790", "d-4805", "lt-77", "d-4830", "cfg-912"]);
  assert.equal(all.filter((c) => c.id === "d-4830").length, 1, "a deploy that is also a change appears once");
  assert.equal(all.find((c) => c.id === "d-4805")?.kind, "deploy");
});

test("listChanges: a load test counts when it overlaps the window", async () => {
  const t = await load("correlation-trap");
  assert.ok(listChanges(t, "2026-10-06T03:12:00Z", "2026-10-06T03:20:00Z").some((c) => c.id === "lt-77"));
  assert.ok(!listChanges(t, "2026-10-06T03:16:00Z", "2026-10-06T03:20:00Z").some((c) => c.id === "lt-77"));
});

test("listChanges on telemetry without changes = the deploys, oldest first", async () => {
  const t = await load("bad-deploy");
  assert.deepEqual(listChanges(t).map((c) => c.id), ["d-4790", "d-4805", "d-4821"]);
});

test("getTrace('7f3a9c'): spans in order, a timeout on postgres, payments skipped", async () => {
  const t = await load("correlation-trap");
  const tr = getTrace(t, "7f3a9c");
  assert.ok(!("error" in tr));
  if ("error" in tr) return;
  assert.deepEqual(tr.spans.map((s) => s.name), ["edge", "checkout", "price-cache", "postgres.price_lookup", "payments.charge"]);
  assert.equal(tr.spans.find((s) => s.status === "timeout")?.name, "postgres.price_lookup");
  assert.equal(tr.spans.find((s) => s.name === "price-cache")?.status, "miss");
  assert.equal(tr.spans.find((s) => s.name === "payments.charge")?.status, "skipped");
  assert.ok("error" in getTrace(t, "nope"));
  assert.ok("error" in getTrace(await load("bad-deploy"), "7f3a9c"));
});

test("W5 tool list unchanged; EXT tools registered only with changes/traces or AGENT_EXT=1", async () => {
  assert.deepEqual([...TOOL_NAMES], ["search_logs", "summarize_metrics", "list_deploys", "get_diff"]);
  const registered = (t: Telemetry) => {
    const inst = createTelemetryServer(t).instance as unknown as { _registeredTools?: Record<string, unknown>; server?: { _registeredTools?: Record<string, unknown> } };
    return Object.keys(inst._registeredTools ?? inst.server?._registeredTools ?? {});
  };
  const prev = process.env.AGENT_EXT;
  delete process.env.AGENT_EXT;
  try {
    const old = await load("bad-deploy");
    const trap = await load("correlation-trap");
    for (const n of EXT_TOOL_NAMES) {
      assert.ok(!registered(old).includes(n), `${n} must not register on W5 telemetry`);
      assert.ok(registered(trap).includes(n), `${n} must register on telemetry with changes/traces`);
    }
    assert.equal(allowedToolsFor(old).length, 4);
    assert.equal(allowedToolsFor(trap).length, 6);
    assert.equal(allowedToolsFor(old, { AGENT_EXT: "1" }).length, 6);
  } finally {
    if (prev !== undefined) process.env.AGENT_EXT = prev;
  }
});

test("handlers: list_changes / get_trace / summarize_metrics group_by are read-only views", async () => {
  const t = await load("correlation-trap");
  const before = JSON.stringify(t);
  const h = handlers(t);
  assert.ok(h.list_changes({}).length >= 3);
  assert.ok(!("error" in h.get_trace({ trace_id: "d2f001" })));
  const byVersion = h.summarize_metrics({ group_by: "version" }).groups;
  assert.equal(byVersion?.by, "version");
  if (byVersion?.by === "version") assert.deepEqual(byVersion.versions.map((v) => v.version), ["v2.14.0", "v2.15.1"]);
  assert.equal(JSON.stringify(t), before, "telemetry is not mutated");
});

test("checkTrace: changes:/traces: refs need list_changes / get_trace in the trace", () => {
  const entry = (tool: string) => ({ tool, input: {}, output: "" });
  const base = [entry("summarize_metrics"), entry("list_deploys"), entry("search_logs")];
  assert.deepEqual(checkTrace(base, ["metrics", "deploys"]), [], "W5 call shape unchanged");
  const errs = checkTrace(base, ["deploys", "logs"], ["changes:cfg-912", "traces:7f3a9c"]);
  assert.equal(errs.length, 2);
  assert.match(errs.join(), /list_changes was never called/);
  assert.match(errs.join(), /get_trace was never called/);
  assert.deepEqual(checkTrace([...base, entry("list_changes"), entry("get_trace")], ["deploys", "logs"], ["changes:cfg-912", "traces:7f3a9c"]), []);
});
