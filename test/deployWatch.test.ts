import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluatePolicy, parseStopCommand, parseWatchCommand, type Observation } from "../src/deployWatch.js";

test("the three documented commands parse", () => {
  assert.deepEqual(parseWatchCommand("Watch the next deployment for five minutes."), { ok: true, value: { target: "next", minutes: 5 } });
  assert.deepEqual(parseWatchCommand("Watch this deployment for 5 minutes."), { ok: true, value: { target: "this", minutes: 5 } });
  assert.deepEqual(parseWatchCommand("Monitor the deploy."), { ok: true, value: { target: "this", minutes: 5 } });
});

test("the full video prompt is accepted; its extra sentences describe the fixed policy", () => {
  const r = parseWatchCommand("Watch the next deployment for five minutes. Check checkout success, errors and latency. Investigate any regression and ask me before rolling back.");
  assert.equal(r.ok, true);
});

test("arbitrary extra instructions are rejected, not silently applied", () => {
  const r = parseWatchCommand("Watch the next deployment for five minutes. If it fails, roll back automatically.");
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.errors[0] ?? "", /rejected/);
});

test("duration bounds and non-commands", () => {
  assert.equal(parseWatchCommand("Watch this deployment for 20 minutes.").ok, false);
  assert.equal(parseWatchCommand("Roll back now").ok, false);
  assert.equal(parseStopCommand("Stop the deployment watch."), true);
  assert.equal(parseStopCommand("Stop watching"), true);
});

const o = (ok: boolean, ms = 200, verified = true): Observation => ({ at: "t", verified, ok, ms, revision: "v" });

test("policy: three consecutive verified failures", () => {
  assert.equal(evaluatePolicy([o(true), o(false), o(false), o(false)], 0).failed, true);
  assert.equal(evaluatePolicy([o(false), o(false), o(true), o(false)], 0).failed, false);
});

test("policy: an unverified check breaks the streak", () => {
  assert.equal(evaluatePolicy([o(false), o(false), o(false, 200, false), o(false)], 0).failed, false);
});

test("policy: three consecutive slow requests, or ≥3 5xx in metrics", () => {
  assert.equal(evaluatePolicy([o(true, 1500), o(true, 1200), o(true, 1100)], 0).reason, "3 consecutive verified requests over 1000 ms");
  assert.equal(evaluatePolicy([o(true)], 3).reason, "3 5xx responses in metrics since the watch began");
});
