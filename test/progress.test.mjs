// Progress hook (A-1..A-9 evidence, append-only PROGRESS.md). npm run test:hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "w5-progress-"));
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  cpSync(join(ROOT, ".claude/hooks/progress.mjs"), join(dir, ".claude/hooks/progress.mjs"));
  writeFileSync(join(dir, "PROGRESS.md"), "# Build log\n\nEntries are append-only.\n\n<!-- ENTRIES (newest at the bottom) -->\n");
  return dir;
};
const run = (dir, args = []) => spawnSync("node", [join(dir, ".claude/hooks/progress.mjs"), ...args], { encoding: "utf8", cwd: dir });
const w = (dir, p, s) => { mkdirSync(join(dir, p.split("/").slice(0, -1).join("/") || "."), { recursive: true }); writeFileSync(join(dir, p), s); };

const FILL = (dir, step) => {
  switch (step) {
    case "A-1": w(dir, "node_modules/.keep", ""); w(dir, "approvals/audit.jsonl", '{"decision":"allow"}\n'); break;
    case "A-2": w(dir, "intent.md", "# Intent\n\nthis agent serves the on-call team\n"); break;
    case "A-3": w(dir, "docs/spec.md", "# Spec\nfilled\n"); w(dir, "src/contract.ts", "customer_impact\n"); break;
    case "A-4": w(dir, "approvals/audit.jsonl", '{"decision":"deny"}\n{"decision":"allow"}\n'); w(dir, ".claude/hooks/guard.mjs", 'if (/^bench\\/ratchet\\.json$/.test(rel)) decide("deny", "x")\n'); w(dir, "src/chat.ts", "MUTATION\n"); break;
    case "A-5": w(dir, "src/tools.ts", 'tool(\n  "list_deploys",\n'); break;
    case "A-6": w(dir, "docs/diagnosis-live.md", "# Live diagnosis\nfilled\n"); break;
    case "A-7": w(dir, "bench/cases.json", JSON.stringify([1, 2, 3, 4, 5, 6])); break;
    case "A-8": w(dir, "approvals/INC-1.approval.json", "{}\n"); w(dir, "src/executor.ts", 'if (!isApproved(record, id, "rollback")) return err\n'); break;
    case "A-9": w(dir, "lessons/lessons.md", "## INC-1\n## INC-2\n## INC-3\n"); w(dir, "docs/hackathon-intent.md", "# Hackathon\nfilled\n"); break;
  }
};

test("no PROGRESS.md → silent exit", () => {
  const dir = mkdtempSync(join(tmpdir(), "w5-progress-none-"));
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  cpSync(join(ROOT, ".claude/hooks/progress.mjs"), join(dir, ".claude/hooks/progress.mjs"));
  assert.equal(run(dir).status, 0);
});

test("--status prints N/9 with a checklist", () => {
  const dir = setup();
  const r = run(dir, ["--status"]);
  assert.match(r.stdout, /0\/9 assignments with evidence/);
  FILL(dir, "A-1"); FILL(dir, "A-5");
  const r2 = run(dir, ["--status"]);
  assert.match(r2.stdout, /2\/9 assignments with evidence/);
  assert.match(r2.stdout, /A-5 read-only tool/);
});

test("each completed assignment appends exactly one marked entry", () => {
  const dir = setup();
  FILL(dir, "A-2");
  assert.equal(run(dir).status, 0);
  const log = readFileSync(join(dir, "PROGRESS.md"), "utf8");
  assert.equal((log.match(/<!-- auto: A-2 -->/g) ?? []).length, 1);
  assert.match(log, /## \d{4}-\d{2}-\d{2}T.*\(A-2\)/);
  assert.match(log, /fill in:/);
});

test("append-only and idempotent: rerunning adds nothing twice", () => {
  const dir = setup();
  for (const k of ["A-1", "A-2", "A-6"]) FILL(dir, k);
  run(dir);
  const once = readFileSync(join(dir, "PROGRESS.md"), "utf8");
  run(dir);
  const twice = readFileSync(join(dir, "PROGRESS.md"), "utf8");
  assert.equal(twice, once);
  assert.ok(once.startsWith("# Build log"));
});

test("workshop/start shape: exercise markers inside TODO comments do not count (0/9)", () => {
  const dir = setup();
  w(dir, "src/contract.ts", "// TODO(A3): rebuild the evidence rules, incl. customer_impact\n");
  w(dir, "src/chat.ts", "// TODO(A4): rebuild the mutation refusal (MUTATION)\n");
  w(dir, "src/tools.ts", '// TODO(A5): register tool("list_deploys", …) here\nlist_deploys: () => []\n');
  w(dir, "src/executor.ts", '// TODO(A8): isApproved(record, id, "rollback") must hold\n');
  w(dir, ".claude/hooks/guard.mjs", "// TODO(A4): deny Edit/Write to bench/ratchet.json\n");
  w(dir, "approvals/audit.jsonl", '{"decision":"deny"}\n{"decision":"allow"}\n');
  w(dir, "approvals/INC-9.approval.json", "{}\n");
  w(dir, "docs/spec.md", "# Spec\n<fill in: …>\n");
  w(dir, "docs/diagnosis-live.md", "<fill in: …>\n");
  w(dir, "docs/hackathon-intent.md", "<fill in: …>\n");
  const r = run(dir, ["--status"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0\/9 assignments with evidence/);
});

test("no network or dynamic imports in the hook", () => {
  const src = readFileSync(join(ROOT, ".claude/hooks/progress.mjs"), "utf8");
  assert.ok(!/node:(http|https|net|dgram|tls)|fetch\(|https?:\/\//.test(src));
});

test("the hook only ever appends to PROGRESS.md (single appendFileSync)", () => {
  const src = readFileSync(join(ROOT, ".claude/hooks/progress.mjs"), "utf8");
  assert.equal((src.match(/appendFileSync\(FILE/g) ?? []).length, 1);
  assert.ok(!/writeFileSync\(FILE|renameSync|unlinkSync/.test(src));
});

test("works from any folder name and from a subfolder: root comes from git", () => {
  const base = mkdtempSync(join(tmpdir(), "w5-progress-renamed-"));
  const dir = join(base, "sre-oncall-agent-workshop-start");
  mkdirSync(join(dir, ".claude/hooks"), { recursive: true });
  mkdirSync(join(dir, "src/deep"), { recursive: true });
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir }).status, 0, "git init");
  cpSync(join(ROOT, ".claude/hooks/progress.mjs"), join(dir, ".claude/hooks/progress.mjs"));
  writeFileSync(join(dir, "PROGRESS.md"), "# Build log\n\n<!-- ENTRIES (newest at the bottom) -->\n");
  FILL(dir, "A-2");
  const r = spawnSync("node", [join(dir, ".claude/hooks/progress.mjs")], { encoding: "utf8", cwd: join(dir, "src/deep") });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(dir, "PROGRESS.md"), "utf8"), /<!-- auto: A-2 -->/, "evidence read and entry appended at the repo root");
});

test("a labeled package hook prefers its own root over an enclosing Git repository", () => {
  const parent = mkdtempSync(join(tmpdir(), "w5-progress-package-parent-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: parent }).status, 0, "enclosing git init");
  const parentProgress = "# Parent progress\n<!-- ENTRIES -->\n";
  writeFileSync(join(parent, "PROGRESS.md"), parentProgress);
  const pkg = join(parent, "exports", "starter");
  mkdirSync(join(pkg, ".claude/hooks"), { recursive: true });
  cpSync(join(ROOT, ".claude/hooks/progress.mjs"), join(pkg, ".claude/hooks/progress.mjs"));
  writeFileSync(join(pkg, "WORKSHOP-PACKAGE.md"), "# Workshop 5 package: STARTER\n");
  writeFileSync(join(pkg, "PROGRESS.md"), "# Package progress\n\n<!-- ENTRIES -->\n");
  writeFileSync(join(pkg, "intent.md"), "# Intent\n\nserve on-call engineers\n");

  const r = spawnSync("node", [join(pkg, ".claude/hooks/progress.mjs")], { encoding: "utf8", cwd: pkg });
  assert.equal(r.status, 0, r.stderr);
  assert.match(readFileSync(join(pkg, "PROGRESS.md"), "utf8"), /<!-- auto: A-2 -->/);
  assert.equal(readFileSync(join(parent, "PROGRESS.md"), "utf8"), parentProgress);
});
