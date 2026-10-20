// Guard + approve scripts (the SDLC gate), ported from aetherlink-sre-agent-lab
// and adapted to sre-oncall-agent. Run: npm run test:hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, cpSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "w5-hooks-"));
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  mkdirSync(join(dir, "scripts"), { recursive: true });
  cpSync(join(ROOT, ".claude/hooks/guard.mjs"), join(dir, ".claude/hooks/guard.mjs"));
  cpSync(join(ROOT, "scripts/approve.mjs"), join(dir, "scripts/approve.mjs"));
  return dir;
};

const guard = (dir, payload) => {
  const r = spawnSync("node", [join(dir, ".claude/hooks/guard.mjs")], {
    input: JSON.stringify(payload), encoding: "utf8", cwd: dir,
  });
  const lines = r.stdout.trim().split("\n").filter(Boolean);
  const out = JSON.parse(lines.at(-1));
  return out.hookSpecificOutput?.permissionDecision;
};
const bash = (dir, command) => guard(dir, { tool_name: "Bash", tool_input: { command } });
const write = (dir, file_path) => guard(dir, { tool_name: "Write", tool_input: { file_path } });
const read = (dir, file_path) => guard(dir, { tool_name: "Read", tool_input: { file_path } });
// Paths are absolute inside the throwaway repo dir, as Claude Code sends them.

test("network is denied", (t) => {
  const dir = setup();
  const P = `${dir}/`;
  for (const c of ["curl https://x", "wget http://x", "ssh prod", "scp a b", "npm install https://x.tgz"]) {
    assert.equal(bash(dir, c), "deny", c);
  }
});

test("secrets are denied across tools", () => {
  const dir = setup();
  const P = `${dir}/`;
  assert.equal(read(dir, "/home/u/.env"), "deny");
  assert.equal(read(dir, `${P}secrets/id_rsa`), "deny");
  assert.equal(write(dir, `${P}.env`), "deny");
  assert.equal(bash(dir, "cat .env"), "deny");
});

test("approvals are human-owned: the agent cannot approve itself", () => {
  const dir = setup();
  const P = `${dir}/`;
  for (const c of ["npm run approve:git -- ryan fix/x 'ok'", "npm run approve -- x", "node scripts/approve.mjs ryan fix/x r", "cat approvals/approvals.jsonl > /tmp/x", "CLAUDECODE=0 npm run approve"]) {
    assert.equal(bash(dir, c), "deny", c);
  }
  assert.equal(write(dir, `${P}approvals/approvals.jsonl`), "deny");
});

test("merges and review-approvals are human-only", () => {
  const dir = setup();
  const P = `${dir}/`;
  assert.equal(bash(dir, "gh pr merge 12"), "deny");
  assert.equal(bash(dir, "gh pr review --approve 12"), "deny");
  assert.equal(bash(dir, "glab mr merge 12"), "deny");
});

test("git push is denied on non-fix branches, ask-then-allow on approved fix/*", () => {
  const dir = setup();
  const P = `${dir}/`;
  assert.equal(bash(dir, "git push origin main"), "deny");
  assert.equal(bash(dir, "git push origin fix/chat-refusal"), "ask");
  // human approves in their own terminal
  writeFileSync(join(dir, "approvals/approvals.jsonl"),
    JSON.stringify({ at: "t", approved_by: "ryan", ref: "fix/chat-refusal", reason: "reviewed" }) + "\n");
  assert.equal(bash(dir, "git push origin fix/chat-refusal"), "allow");
});

test("writes: secrets/outside denied, artefacts asked, agent dirs allowed", () => {
  const dir = setup();
  const P = `${dir}/`;
  assert.equal(write(dir, "/etc/passwd"), "deny", "outside the repo");
  assert.equal(write(dir, `${P}.claude/settings.json`), "deny", ".claude is human-owned");
  assert.equal(write(dir, `${P}PROGRESS.md`), "deny", "PROGRESS.md is hook-owned");
  assert.equal(write(dir, `${P}intent.md`), "ask", "SDLC artefact");
  assert.equal(write(dir, `${P}docs/spec.md`), "ask", "SDLC artefact");
  assert.equal(write(dir, `${P}docs/decisions/D1-foo.md`), "ask", "SDLC artefact");
  assert.equal(write(dir, `${P}bench/cases.json`), "ask", "SDLC artefact");
  assert.equal(write(dir, `${P}lessons/proposed/INC-1.md`), "allow", "agent artefact");
  assert.equal(write(dir, `${P}docs/diagnoses/INC-1.md`), "allow", "agent artefact");
  assert.equal(write(dir, `${P}src/contract.ts`), "ask", "source edit needs human confirmation");
});

test("PROGRESS.md: direct writes stay denied, npm run progress:note is the agent's append path", () => {
  const dir = setup();
  const P = `${dir}/`;
  assert.equal(write(dir, `${P}PROGRESS.md`), "deny", "Write stays denied");
  assert.equal(guard(dir, { tool_name: "Edit", tool_input: { file_path: `${P}PROGRESS.md`, old_string: "a", new_string: "ab" } }), "deny", "Edit stays denied");
  assert.equal(bash(dir, 'npm run progress:note -- --kind status "A3 contract green"'), "allow", "append script allowed");
});

test("fail closed on malformed input", () => {
  const dir = setup();
  const P = `${dir}/`;
  const r = spawnSync("node", [join(dir, ".claude/hooks/guard.mjs")], { input: "not json{", encoding: "utf8", cwd: dir });
  const out = JSON.parse(r.stdout.trim().split("\n").at(-1));
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
});

test("every decision is logged to approvals/audit.jsonl", () => {
  const dir = setup();
  const P = `${dir}/`;
  bash(dir, "curl https://x");
  write(dir, `${P}src/x.ts`);
  const audit = readFileSync(join(dir, "approvals/audit.jsonl"), "utf8").trim().split("\n");
  assert.equal(audit.length, 2);
  assert.ok(audit.every((l) => JSON.parse(l).decision));
});

test("scripts/approve.mjs refuses inside Claude Code and bot names", () => {
  const dir = setup();
  const P = `${dir}/`;
  const run = (env, name = "ryan") => spawnSync("node", [join(dir, "scripts/approve.mjs"), name, "fix/x", "why"], {
    encoding: "utf8", cwd: dir, env: { ...process.env, ...env },
  });
  assert.equal(run({ CLAUDECODE: "1" }).status, 1, "refuses inside Claude Code");
  for (const bot of ["claude", "agent", "bot", "assistant"]) {
    assert.equal(run({}, bot).status, 1, `bot name ${bot} refused`);
  }
  const okRun = run({});
  assert.equal(okRun.status, 0, okRun.stderr);
  const line = JSON.parse(readFileSync(join(dir, "approvals/approvals.jsonl"), "utf8").trim());
  assert.equal(line.approved_by, "ryan");
  assert.equal(line.ref, "fix/x");
});

test("repo root comes from git, not the folder name: a clone in any folder works", () => {
  // e.g. `git clone <url> sre-oncall-agent-workshop-start`, hook invoked from a subfolder
  const base = mkdtempSync(join(tmpdir(), "w5-hooks-renamed-"));
  const dir = join(base, "sre-oncall-agent-workshop-start");
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  mkdirSync(join(dir, "src/deep"), { recursive: true });
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir }).status, 0, "git init");
  cpSync(join(ROOT, ".claude/hooks/guard.mjs"), join(dir, ".claude/hooks/guard.mjs"));
  const sub = join(dir, "src/deep");
  const g = (payload) => {
    const r = spawnSync("node", [join(dir, ".claude/hooks/guard.mjs")], {
      input: JSON.stringify(payload), encoding: "utf8", cwd: sub,
    });
    return JSON.parse(r.stdout.trim().split("\n").at(-1)).hookSpecificOutput?.permissionDecision;
  };
  const w = (file_path) => g({ tool_name: "Write", tool_input: { file_path } });
  for (const root of [dir, realpathSync(dir)]) {
    assert.equal(w(`${root}/src/contract.ts`), "ask", "inside the renamed repo: not 'outside the repo'");
    assert.equal(w(`${root}/docs/diagnoses/INC-1.md`), "allow", "agent artefact in the renamed repo");
    assert.equal(w(`${root}/.claude/settings.json`), "deny", ".claude stays human-owned");
    assert.equal(w(`${root}/PROGRESS.md`), "deny", "PROGRESS.md stays hook-owned");
    assert.equal(w(`${root}/approvals/approvals.jsonl`), "deny", "approvals stay human-owned");
  }
  assert.equal(w("../x.ts"), "ask", "relative path resolves from the cwd, inside the repo");
  assert.equal(w(`${base}/sre-oncall-agent/src/x.ts`), "deny", "a sibling folder named sre-oncall-agent is outside the repo");
  assert.equal(w(`${dir}-evil/src/x.ts`), "deny", "a prefix-sharing sibling is outside the repo");
  assert.equal(w("/etc/passwd"), "deny", "outside the repo");
  // the audit log lands at the repo root, not in the cwd subfolder
  assert.ok(existsSync(join(dir, "approvals/audit.jsonl")), "audit at repo root");
  assert.ok(!existsSync(join(sub, "approvals")), "no approvals/ in the subfolder");
});
