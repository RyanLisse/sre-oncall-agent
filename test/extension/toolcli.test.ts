// Extension: npm run tool — the same read-only handlers, with a reproduce line.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const tool = (...args: string[]) => {
  const r = spawnSync("npm", ["run", "-s", "tool", "--", ...args], { encoding: "utf8", shell: process.platform === "win32" });
  return { status: r.status, out: r.stdout, err: r.stderr, json: (() => { try { return JSON.parse(r.stdout) as { reproduce: string; result: unknown }; } catch { return undefined; } })() };
};

test("changes trap --window 15m: cfg-912 and d-4830, a reproduce line, no lt-77", () => {
  const r = tool("changes", "trap", "--window", "15m");
  assert.equal(r.status, 0, r.err);
  assert.match(r.out, /cfg-912/);
  assert.match(r.out, /d-4830/);
  assert.doesNotMatch(r.out, /lt-77/);
  assert.match(r.json?.reproduce ?? "", /^list_changes \{"since":"2026-10-06T03:29:00\.000Z","until":"2026-10-06T03:44:00\.000Z"\}$/);
});

test("alert trap prints the rule, fired_at and window", () => {
  const r = tool("alert", "trap");
  assert.equal(r.status, 0, r.err);
  const res = r.json?.result as Record<string, unknown>;
  assert.equal(res.alert, "CheckoutErrorRate");
  assert.match(String(res.expr), /checkout_requests_total/);
  assert.equal(res.fired_at, "2026-10-06T03:44:00.000Z");
  assert.deepEqual(res.window, { since: "2026-10-06T03:39:00.000Z", until: "2026-10-06T03:44:00.000Z" });
});

test("metrics trap --by retry splits first attempts and retries", () => {
  const r = tool("metrics", "trap", "--by", "retry", "--window", "15m");
  assert.equal(r.status, 0, r.err);
  assert.match(r.json?.reproduce ?? "", /^summarize_metrics .*"group_by":"retry"/);
  const groups = (r.json?.result as { groups: { by: string; series: { first_attempts: number; retries: number }[] } }).groups;
  assert.equal(groups.by, "retry");
  assert.ok(groups.series.every((p) => p.first_attempts === 480));
  assert.ok(groups.series.some((p) => p.retries > 400));
});

test("logs trap --level error carries trace ids; trace trap 7f3a9c names the timeout", () => {
  const logs = tool("logs", "trap", "--level", "error");
  assert.equal(logs.status, 0, logs.err);
  assert.match(logs.out, /trace=7f3a9c/);
  const tr = tool("trace", "trap", "7f3a9c");
  assert.equal(tr.status, 0, tr.err);
  assert.match(tr.json?.reproduce ?? "", /^get_trace \{"trace_id":"7f3a9c"\}$/);
  assert.match(tr.out, /"postgres\.price_lookup"[\s\S]*"timeout"/);
  assert.equal(tool("trace", "trap", "nope").status, 1);
});

test("trap-after reads past the alert: the rollback and cfg-913 show up", () => {
  const r = tool("changes", "trap-after", "--window", "30m");
  assert.equal(r.status, 0, r.err);
  assert.match(r.out, /d-4831/);
  assert.match(r.out, /cfg-913/);
});

test("bad usage exits 2", () => {
  assert.equal(tool().status, 2);
  assert.equal(tool("changes", "trap", "--window", "soon").status, 2);
  assert.equal(tool("rollback", "trap").status, 2);
});

test("only aliases and .json files under fixtures/incidents/ are accepted; nothing else is read or echoed", () => {
  for (const bad of ["/etc/passwd", "package.json", "fixtures/incidents/../../package.json", "fixtures/telemetry/bad-deploy.json", "README.md", "__proto__", "constructor"]) {
    const r = tool("changes", bad);
    assert.equal(r.status, 2, bad);
    assert.match(r.err, /incident must be one of trap \| trap-after \| inc-1001, or a \.json file under fixtures\/incidents\//, bad);
    assert.equal(r.out, "", bad);
    assert.doesNotMatch(r.err + r.out, /root:|"name": "sre-oncall-agent"|"scripts"|SRE on-call lab/, bad);
  }
  const ok = tool("changes", "fixtures/incidents/correlation-trap.json", "--window", "15m");
  assert.equal(ok.status, 0, ok.err);
  assert.match(ok.out, /cfg-912/);
});

test("a malformed incident under fixtures/incidents/ fails cleanly (contract errors, no stack)", () => {
  const r = tool("changes", "fixtures/incidents/malformed.json");
  assert.equal(r.status, 1);
  assert.match(r.err, /^FAIL incident file fixtures\/incidents\/malformed\.json: /);
  assert.doesNotMatch(r.err, /RangeError|at .*tool\.ts/);
});
