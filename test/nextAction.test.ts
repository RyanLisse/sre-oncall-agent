import assert from "node:assert/strict";
import { test } from "node:test";
import { nextAction, type Msg } from "../src/nextAction.js";

const diag = (proposal = "rollback"): Msg => ({ kind: "diagnosis", text: JSON.stringify({ proposal }) });
const appr = (decision: string): Msg => ({ kind: "approval", text: JSON.stringify({ decision }) });
const rec = (r: object): Msg => ({ kind: "recovery", text: JSON.stringify(r) });

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
  const running = nextAction("active", [diag(), appr("approved"), rec({ phase: "running" })]);
  assert.deepEqual(running.allowed, []);
});

test("LANDED allows mitigated; NOT LANDED never allows mitigated or execute", () => {
  assert.deepEqual(nextAction("active", [diag(), appr("approved"), rec({ phase: "done", landed: true, failed: [] })]).allowed, ["mitigated"]);
  const n = nextAction("active", [diag(), appr("approved"), rec({ phase: "done", landed: false, failed: ["full check: error_rate 0.0125 > limit 0.005"] })]);
  assert.equal(n.allowed.includes("mitigated"), false);
  assert.equal(n.allowed.includes("execute"), false);
  assert.match(n.detail, /full check/);
});

test("a resolved incident allows nothing — no second execute", () => {
  for (const msgs of [[diag(), appr("approved")], [diag(), appr("pending")], []]) {
    assert.deepEqual(nextAction("resolved", msgs).allowed, []);
  }
});

test("a mitigated incident allows only resolve with notes", () => {
  assert.deepEqual(nextAction("mitigated", [diag(), appr("approved"), rec({ phase: "done", landed: true, failed: [] })]).allowed, ["resolve"]);
});

test("an approved non-rollback proposal is carried out outside the agent, then mitigated", () => {
  assert.deepEqual(nextAction("active", [diag("scale"), appr("approved")]).allowed, ["mitigated", "resolve"]);
});

test("a rejected proposal allows resolve only; a stale incident behaves as active", () => {
  assert.deepEqual(nextAction("active", [diag(), appr("rejected")]).allowed, ["resolve"]);
  assert.deepEqual(nextAction("stale", [diag(), appr("pending")]).allowed, ["approve", "reject"]);
});
