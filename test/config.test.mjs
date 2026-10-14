// Wiring checks for .claude/settings.json. npm run test:hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));

test("every configured hook is an exec-form node command on a committed file", () => {
  const groups = ["PreToolUse", "PostToolUse", "SessionStart", "Stop"];
  const seen = new Set();
  for (const g of groups) {
    for (const entry of settings.hooks[g] ?? []) {
      for (const h of entry.hooks) {
        assert.equal(h.type, "command");
        assert.match(h.command, /^node \$\{CLAUDE_PROJECT_DIR\}\/\.claude\/hooks\/[\w.-]+\.mjs$/);
        seen.add(h.command);
      }
    }
  }
  for (const cmd of seen) {
    const file = cmd.replace(/^node \$\{CLAUDE_PROJECT_DIR\}\//, "");
    assert.ok(existsSync(file), `${file} must exist in the repo`);
  }
  assert.equal(seen.size, 2, "guard.mjs + progress.mjs wired");
});

test("PreToolUse matcher covers the gated tools", () => {
  const m = settings.hooks.PreToolUse[0].matcher;
  for (const t of ["Bash", "Read", "Grep", "Glob", "Write", "Edit", "MultiEdit"]) assert.ok(m.includes(t), t);
});

test("permission boundaries: secrets, approvals and bypass locked down", () => {
  const deny = settings.permissions.deny.join("\n");
  for (const p of ["WebFetch", "WebSearch", "**/.env*", "**/*.pem", "approvals/**", ".claude/**", "PROGRESS.md", "lessons/lessons.md", "npm run approve", "gh pr merge"]) {
    assert.ok(deny.includes(p), `deny must cover ${p}`);
  }
  assert.equal(settings.disableBypassPermissionsMode, "disable");
});

test("approve.mjs is not callable by the agent", () => {
  const deny = settings.permissions.deny.join("\n");
  assert.match(deny, /scripts\/approve|npm run approve/);
});
