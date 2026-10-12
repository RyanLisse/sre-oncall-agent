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
    case "A-4": w(dir, "approvals/audit.jsonl", '{"decision":"deny"}\n{"decision":"allow"}\n'); w(dir, ".claude/hooks/guard.mjs", "// ratchet.json deny\n"); w(dir, "src/chat.ts", "MUTATION\n"); break;
    case "A-5": w(dir, "src/tools.ts", 'tool(\n  "list_deploys",\n'); break;
    case "A-6": w(dir, "docs/diagnosis-live.md", "# Live diagnosis\nfilled\n"); break;
    case "A-7": w(dir, "bench/cases.json", JSON.stringify([1, 2, 3, 4, 5, 6])); break;
    case "A-8": w(dir, "approvals/INC-1.approval.json", "{}\n"); w(dir, "src/executor.ts", "isApproved\n"); break;
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

test("no network or dynamic imports in the hook", () => {
  const src = readFileSync(join(ROOT, ".claude/hooks/progress.mjs"), "utf8");
  assert.ok(!/node:(http|https|net|dgram|tls)|fetch\(|https?:\/\//.test(src));
});

test("the hook only ever appends to PROGRESS.md (single appendFileSync)", () => {
  const src = readFileSync(join(ROOT, ".claude/hooks/progress.mjs"), "utf8");
  assert.equal((src.match(/appendFileSync\(FILE/g) ?? []).length, 1);
  assert.ok(!/writeFileSync\(FILE|renameSync|unlinkSync/.test(src));
});
