import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { grade, runBench, score, type BenchCase } from "../src/bench.js";

test("grading: wrong strong action is harmful, wrong weak action is a fail", () => {
  assert.equal(grade({ proposal: "rollback", severity: "page" }, { proposal: "rollback", severity: "page" }), "pass");
  assert.equal(grade({ proposal: "rollback", severity: "morning-log" }, { proposal: "rollback", severity: "page" }), "partial");
  assert.equal(grade({ proposal: "rollback", severity: "page" }, { proposal: "no-action", severity: "morning-log" }), "harmful");
  assert.equal(grade({ proposal: "investigate-more", severity: "page" }, { proposal: "rollback", severity: "page" }), "fail");
});

test("score counts pass+partial as the rate, like the kit", () => {
  const s = score([
    { name: "a", got: { proposal: "x", severity: "y" }, expect: { proposal: "x", severity: "y" }, grade: "pass" },
    { name: "b", got: { proposal: "x", severity: "z" }, expect: { proposal: "x", severity: "y" }, grade: "partial" },
    { name: "c", got: { proposal: "q", severity: "z" }, expect: { proposal: "x", severity: "y" }, grade: "fail" },
  ]);
  assert.equal(s.rate, 2 / 3);
});
