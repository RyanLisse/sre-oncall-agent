// The skill scanner flags an untrusted skill and passes a clean one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

const scan = (dir: string) =>
  spawnSync("node", ["scripts/scan-skill.mjs", dir], { encoding: "utf8" });

test("skill:scan flags a suspicious skill", () => {
  const r = scan("test/fixtures/suspicious-skill");
  assert.equal(r.status, 1);
  assert.match(r.stdout, /flag/i);
});

test("skill:scan passes a clean skill", () => {
  const r = scan("test/fixtures/clean-skill");
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0 flag/i);
});
