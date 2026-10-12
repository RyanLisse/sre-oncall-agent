// Workshop A4 — the participant's own guard rule: the agent never edits
// bench/ratchet.json (the ratchet floor is human-owned). Red on
// workshop/start; add the deny in .claude/hooks/guard.mjs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const guard = (payload: object) => {
  const cwd = mkdtempSync(join(tmpdir(), "w5-guard-"));
  const r = spawnSync("node", [join(process.cwd(), ".claude/hooks/guard.mjs")], {
    input: JSON.stringify(payload), encoding: "utf8", cwd,
  });
  const out = JSON.parse(r.stdout.trim().split("\n").pop() ?? "{}");
  return out.hookSpecificOutput?.permissionDecision;
};

test("A4: participant rule — agent cannot edit bench/ratchet.json", () => {
  const d = guard({ tool_name: "Edit", tool_input: { file_path: "/repo/sre-oncall-agent/bench/ratchet.json" } });
  assert.equal(d, "deny", "the ratchet floor is human-owned: edits must be denied");
});

test("A4: guard still allows an agent artefact write", () => {
  const d = guard({ tool_name: "Write", tool_input: { file_path: "/repo/sre-oncall-agent/docs/diagnoses/INC-1.md" } });
  assert.equal(d, "allow");
});
