import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAction, type Msg } from "../src/nextAction.js";

const diag = (proposal = "rollback"): Msg => ({ kind: "diagnosis", text: JSON.stringify({ proposal }) });
const appr = (decision: string): Msg => ({ kind: "approval", text: JSON.stringify({ decision }) });
const rec = (r: object): Msg => ({ kind: "recovery", text: JSON.stringify(r) });
const complete = (full: number, double: number) => rec({
  status: "complete",
  report: {
    metric: "error_rate",
    baseline: 0.001,
    limit: 0.005,
    checks: [
      { label: "half", at: "2026-10-05T03:54:00Z", value: 0.003, ok: true },
      { label: "full", at: "2026-10-05T03:56:00Z", value: full, ok: full <= 0.005 },
      { label: "double", at: "2026-10-05T03:58:00Z", value: double, ok: double <= 0.005 },
    ],
    landed: full <= 0.005 && double <= 0.005,
    message: full <= 0.005 && double <= 0.005 ? "LANDED" : "NOT LANDED",
  },
});

test("before a diagnosis no button is allowed", () => {
  const n = nextAction("active", []);
  assert.deepEqual(n.allowed, []);
  assert.match(n.title, /investigat/i);
});

test("a pending approval allows only approve and reject", () => {
  assert.deepEqual(nextAction("active", [diag(), appr("pending")]).allowed, ["approve", "reject"]);
});

test("an approved rollback allows execute once, then nothing while recovery runs", () => {
  assert.deepEqual(nextAction("active", [diag(), appr("pending"), appr("approved")]).allowed, ["execute"]);
  const running = nextAction("active", [diag(), appr("approved"), rec({ status: "running" })]);
  assert.deepEqual(running.allowed, []);
  assert.match(running.title, /recovery checks are running/i);
});

test("LANDED permits mitigation only, then resolution; NOT LANDED remains open", () => {
  const landed = [diag(), appr("approved"), complete(0.004, 0.003)];
  assert.deepEqual(nextAction("active", landed).allowed, ["mitigated"]);
  assert.deepEqual(nextAction("mitigated", landed).allowed, ["resolve"]);
  const notLanded = [diag(), appr("approved"), complete(0.0125, 0.004)];
  const n = nextAction("active", notLanded);
  assert.deepEqual(n.allowed, []);
  assert.equal(nextAction("mitigated", notLanded).allowed.includes("resolve"), false);
  assert.match(n.title, /NOT LANDED/);
  assert.match(n.detail, /full=0\.0125/);
  assert.match(n.detail, /limit 0\.005/);
});

test("a resolved incident allows nothing — no second execute", () => {
  for (const msgs of [[diag(), appr("approved")], [diag(), appr("pending")], []]) {
    const n = nextAction("resolved", msgs);
    assert.deepEqual(n.allowed, []);
    assert.equal(n.title, "Closed");
  }
});

test("a mitigated incident allows only resolve with notes", () => {
  assert.deepEqual(nextAction("mitigated", [diag(), appr("approved"), complete(0.004, 0.003)]).allowed, ["resolve"]);
});

test("an approved non-rollback proposal is carried out outside the agent, then mitigated", () => {
  assert.deepEqual(nextAction("active", [diag("scale"), appr("approved")]).allowed, ["mitigated"]);
  assert.deepEqual(nextAction("mitigated", [diag("scale"), appr("approved")]).allowed, ["resolve"]);
});

test("legacy or malformed recovery records fail closed; stale incidents behave as active", () => {
  const legacy = nextAction("active", [diag(), appr("approved"), rec({ phase: "done", landed: true, failed: [] })]);
  assert.deepEqual(legacy.allowed, []);
  assert.match(legacy.title, /Recovery blocked/);
  const malformed = nextAction("active", [diag(), appr("approved"), rec({ status: "complete", report: { landed: true } })]);
  assert.deepEqual(malformed.allowed, []);
  assert.match(malformed.title, /Recovery blocked/);
  assert.deepEqual(nextAction("stale", [diag(), appr("pending")]).allowed, ["approve", "reject"]);
});
