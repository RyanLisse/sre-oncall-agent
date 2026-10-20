// Extension: npm run postmortem:check exits 1 while TODO(human) lines remain, 0 without.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const script = join(process.cwd(), "scripts/postmortem-check.mjs");
const run = (cwd: string) => spawnSync("node", [script], { cwd, encoding: "utf8" });
const draft = (body: string) => {
  const cwd = mkdtempSync(join(tmpdir(), "pm-check-"));
  mkdirSync(join(cwd, "docs"));
  writeFileSync(join(cwd, "docs/postmortem-INC-1002.md"), body);
  return cwd;
};

test("exit 1 and file:line for every open TODO(human)", () => {
  const cwd = draft("# PM\n\n## Open questions\n- TODO(human): who approved cfg-912?\n- ok\n- TODO(human): why no warm-up?\n");
  const r = run(cwd);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /docs\/postmortem-INC-1002\.md:4: - TODO\(human\): who approved cfg-912\?/);
  assert.match(r.stdout, /docs\/postmortem-INC-1002\.md:6:/);
  assert.match(r.stdout, /2 open TODO\(human\)/);
});

test("exit 0 without TODO(human), and the file is not touched", () => {
  const body = "# PM\n\nAll questions answered by a human.\n";
  const cwd = draft(body);
  const r = run(cwd);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ready for human review \(not shared automatically\)/);
  assert.equal(readFileSync(join(cwd, "docs/postmortem-INC-1002.md"), "utf8"), body);
});

test("no draft yet is not ready (exit 1)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "pm-check-"));
  assert.equal(run(cwd).status, 1);
});

test("the template carries the TODO(human) rule and the sections, and is not scanned", () => {
  const tpl = readFileSync("docs/templates/postmortem.md", "utf8");
  assert.match(tpl, /write `TODO\(human\): <question>`\. Do not guess\./);
  for (const h of ["Summary", "Impact", "Timeline (UTC)", "Detection", "Contributing factors", "What went well", "Action items", "Open questions"])
    assert.match(tpl, new RegExp(`^## ${h.replace(/[()]/g, "\\$&")}$`, "m"), h);
  assert.doesNotMatch(tpl, /root cause/i);
});
