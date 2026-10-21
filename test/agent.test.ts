import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { checkTrace, extractTrace, investigate } from "../src/agent.js";
import type { Incident } from "../src/contract.js";
import { offlineQuery, offlineVerdict, type AgentEvent, type QueryFn } from "../src/runtime.js";
import { loadTelemetry, type Telemetry } from "../src/telemetry.js";

const load = async (name: string): Promise<Telemetry> => {
  const t = await loadTelemetry(`fixtures/telemetry/${name}.json`);
  if (!t.ok) throw new Error(t.errors.join());
  return t.value;
};

const incident = (id: string, fired_at: string, alert = "Error rate high"): Incident => ({
  incident_id: id,
  service: "checkout",
  alert,
  fired_at,
});

const deps = async (t: Telemetry, query: QueryFn, extra: Partial<Parameters<typeof investigate>[1]> = {}) => ({
  query,
  model: undefined,
  modelLabel: "test",
  telemetry: t,
  lessons: { dir: await mkdtemp(join(tmpdir(), "lessons-")) },
  now: () => new Date("2026-10-05T04:00:00Z"),
  ...extra,
});

test("dry run proposes no lesson", async () => {
  const t = await load("bad-deploy");
  const run = await investigate(incident("INC-1001", "2026-10-05T03:50:00Z"), await deps(t, offlineQuery(t), { proposeLessons: false }));
  assert.equal(run.lessonFile, undefined);
});

test("maxTurns too low ends with a readable stop reason", async () => {
  const t = await load("bad-deploy");
  const run = await investigate(incident("INC-1001", "2026-10-05T03:50:00Z"), await deps(t, offlineQuery(t), { maxTurns: 2 }));
  assert.equal(run.result.ok, false);
  if (!run.result.ok) assert.match(run.result.errors[0] ?? "", /maxTurns \(2\) reached/);
});

test("a verdict that cites tools never called is rejected", () => {
  const trace = [{ tool: "summarize_metrics", input: {}, output: "" }];
  const errors = checkTrace(trace, ["metrics", "deploys"]);
  assert.ok(errors.some((e) => /list_deploys/.test(e)));
});

test("a model that skips the tools and answers from the alert fails the contract", async () => {
  const t = await load("bad-deploy");
  const lazy: QueryFn = async function* () {
    const v = offlineVerdict(incident("INC-1001", "2026-10-05T03:50:00Z"), t);
    yield { type: "result", subtype: "success", structured_output: v, num_turns: 1 } satisfies AgentEvent;
  };
  const run = await investigate(incident("INC-1001", "2026-10-05T03:50:00Z"), await deps(t, lazy));
  assert.equal(run.result.ok, false);
  if (!run.result.ok) assert.match(run.result.errors.join(), /never called/);
});

test("identity: a verdict about another incident is rejected", async () => {
  const t = await load("bad-deploy");
  const wrong: QueryFn = async function* (args) {
    for await (const e of offlineQuery(t)(args)) {
      if (e.type === "result" && e.subtype === "success") {
        yield { ...e, structured_output: { ...(e.structured_output as object), incident_id: "INC-9999" } };
      } else yield e;
    }
  };
  const run = await investigate(incident("INC-1001", "2026-10-05T03:50:00Z"), await deps(t, wrong));
  assert.equal(run.result.ok, false);
  if (!run.result.ok) assert.match(run.result.errors.join(), /incident_id conflict/);
});

test("extractTrace ignores the SDK's StructuredOutput tool and subagent-internal events", () => {
  const events: AgentEvent[] = [
    { type: "assistant", parent_tool_use_id: null, message: { content: [{ type: "tool_use", id: "a", name: "StructuredOutput", input: {} }] } },
    { type: "user", parent_tool_use_id: null, message: { content: [{ type: "tool_result", tool_use_id: "a", content: "x" }] } },
    { type: "assistant", parent_tool_use_id: "sub", message: { content: [{ type: "tool_use", id: "b", name: "mcp__telemetry__search_logs", input: {} }] } },
  ];
  assert.deepEqual(extractTrace(events), []);
});

test("data before theory: every deploys:<id> the offline verdict cites came back from list_deploys", async () => {
  const { handlers } = await import("../src/tools.js");
  const cases: [string, string][] = [
    ["bad-deploy", "2026-10-05T03:50:00Z"], ["slow-dependency", "2026-10-05T03:43:00Z"],
    ["noisy-alert", "2026-10-05T03:51:00Z"], ["mystery-errors", "2026-10-05T03:55:00Z"],
  ];
  for (const [name, at] of cases) {
    const t = await load(name);
    const listed = new Set(handlers(t).list_deploys({ since: new Date(Date.parse(at) - 3_600_000).toISOString(), until: at }).map((d) => d.id));
    const cited = offlineVerdict(incident("INC-1", at), t).evidence.filter((e) => e.source === "deploys" || e.source === "diff").map((e) => e.ref);
    for (const ref of cited) assert.ok(listed.has(ref), `${name}: cites ${ref} but list_deploys returned ${[...listed].join(",") || "nothing"}`);
  }
});

test("a missing signal is unknown: with no deploys listed, a bad deploy is a data gap, never ruled out", async () => {
  const t = { ...(await load("bad-deploy")), deploys: [] };
  const v = offlineVerdict(incident("INC-1", "2026-10-05T03:50:00Z"), t);
  assert.equal(v.proposal, "investigate-more");
  assert.ok(v.data_gaps.some((g) => g.startsWith("list_deploys")));
  assert.equal(v.ruled_out.some((r) => /bad deploy/.test(r)), false, v.ruled_out.join(" | "));
});
