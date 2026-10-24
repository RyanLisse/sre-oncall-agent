// Wiring checks for .claude/settings.json. npm run test:hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const settings = JSON.parse(readFileSync(".claude/settings.json", "utf8"));

test("solo participants have a complete route without a facilitator", () => {
  const solo = readFileSync("SOLO.md", "utf8");
  const route = solo.split("## Optional legacy offline reference")[0];
  for (const section of ["Before you start", "Core 1", "Core 2", "Core 3", "Completion checklist", "Review when you are the only participant", "Pause, resume or get unstuck"]) {
    assert.ok(route.includes(section), section);
  }
  assert.match(route, /without a facilitator or a presentation/);
  assert.match(route, /self-review; no independent\s+reviewer/);
  assert.match(route, /RELEASE BLOCKED/);
  assert.match(route, /restart archives old telemetry/);
  assert.match(solo, /Step 0 expects solved code/);
  for (const file of ["PARTICIPANT.md", "WORKSHOP.md", "AGENTS.md", "CLAUDE.md", "CARD.md", "hub/index.html"]) {
    assert.ok(readFileSync(file, "utf8").includes("SOLO.md"), file);
  }
  const git = readFileSync("docs/sdlc-git.md", "utf8");
  assert.doesNotMatch(git, /stop and ask the facilitator|ask the facilitator\s+to confirm/);
  assert.match(git, /git worktree list/);
  assert.match(git, /git ls-remote --exit-code https:\/\/github.com\/RyanLisse\/sre-oncall-agent.git refs\/heads\/workshop\/start/);
});

test("release skill hands Git actions to the participant on the learner remote", () => {
  const skill = readFileSync(".claude/skills/review-and-ship/SKILL.md", "utf8");
  assert.match(skill, /git diff workshop-base/);
  assert.match(skill, /Do not commit, approve, push, open a PR or MR, or merge/);
  assert.match(skill, /verified `learner` remote/);
  assert.match(skill, /RELEASE BLOCKED/);
  assert.doesNotMatch(skill, /Try the push once|git push -u origin|git diff main/);
});

test("optional concepts name the current tools and point back to the assignment", () => {
  const course = readFileSync("course/index.html", "utf8");
  assert.match(course, /Optional concepts, not the assignment/);
  assert.match(course, /Four read-only tools/);
  assert.match(course, /get_diff/);
  assert.match(course, /https:\/\/github.com\/RyanLisse\/sre-oncall-agent\/blob\/main\/SOLO.md/);
  assert.doesNotMatch(course, /Three Tools, No Levers|has three read-only tools|forbids adding a fourth/);
  assert.match(readFileSync("docs/video/README.md", "utf8"), /archived reference, not the current Workshop 5 instructions/);
});

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

test("PROGRESS.md: the agent appends via npm run progress:note; Edit/Write stay denied", () => {
  const { allow, deny } = settings.permissions;
  assert.ok(allow.includes("Bash(npm run progress*)"), "progress:note is covered by the allow list");
  assert.ok(deny.includes("Edit(./PROGRESS.md)") && deny.includes("Write(./PROGRESS.md)"), "direct edits stay denied");
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts["progress:note"], "node scripts/progress-note.mjs");
});
