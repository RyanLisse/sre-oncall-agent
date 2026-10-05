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

test("the committed cases clear the committed ratchet", async () => {
  const cases = JSON.parse(await readFile("bench/cases.json", "utf8")) as BenchCase[];
  const ratchet = JSON.parse(await readFile("bench/ratchet.json", "utf8")) as { min_rate: number; max_harmful: number };
  const s = await runBench(cases);
  assert.ok(s.rate >= ratchet.min_rate, `rate ${s.rate} below ratchet ${ratchet.min_rate}`);
  assert.ok(s.harmful <= ratchet.max_harmful);
});
