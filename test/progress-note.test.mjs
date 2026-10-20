// npm run progress:note — the agent's only write path into PROGRESS.md.
// Append-only: one timestamped line, existing bytes untouched. npm run test:hooks
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = process.cwd();
const HEADER = "# Build log\n\nAppend-only.\n\n<!-- ENTRIES (newest at the bottom) -->\n\n## 2026-10-20T10:00:00+02:00 — Setup (A-1)\n<!-- auto: A-1 -->\n\n- **What shipped:** done\n";

// A throwaway git repo named something other than sre-oncall-agent: the
// script must find the root via `git rev-parse --show-toplevel`.
const setup = (content = HEADER) => {
  const dir = mkdtempSync(join(tmpdir(), "w5-note-any-name-"));
  assert.equal(spawnSync("git", ["init", "-q"], { cwd: dir }).status, 0, "git init");
  mkdirSync(join(dir, "scripts"), { recursive: true });
  mkdirSync(join(dir, "src/deep"), { recursive: true });
  cpSync(join(ROOT, "scripts/progress-note.mjs"), join(dir, "scripts/progress-note.mjs"));
  if (content !== null) writeFileSync(join(dir, "PROGRESS.md"), content);
  return dir;
};
const note = (dir, args, cwd = dir) =>
  spawnSync("node", [join(dir, "scripts/progress-note.mjs"), ...args], { encoding: "utf8", cwd });
const progress = (dir) => readFileSync(join(dir, "PROGRESS.md"), "utf8");
const LINE = /^- \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} \[(note|status|decision|blocker)\] .+$/;

test("append works: one timestamped line at the bottom", () => {
  const dir = setup();
  const r = note(dir, ["A3 contract tests green"]);
  assert.equal(r.status, 0, r.stderr);
  const added = progress(dir).slice(HEADER.length);
  assert.match(added, /\n$/);
  const lines = added.trimEnd().split("\n");
  assert.equal(lines.length, 1, "exactly one new line");
  assert.match(lines[0], LINE);
  assert.match(lines[0], /\[note\] A3 contract tests green$/);
});

test("existing content is preserved byte-for-byte across appends", () => {
  const dir = setup();
  const before = readFileSync(join(dir, "PROGRESS.md"));
  assert.equal(note(dir, ["--kind", "status", "A4 guard rule added"]).status, 0);
  const mid = readFileSync(join(dir, "PROGRESS.md"));
  assert.equal(note(dir, ["--kind", "decision", "keep the ratchet at 70%"]).status, 0);
  assert.equal(note(dir, ["--kind", "blocker", "console port 4320 busy"]).status, 0);
  const after = readFileSync(join(dir, "PROGRESS.md"));
  assert.ok(after.subarray(0, before.length).equals(before), "original bytes untouched");
  assert.ok(after.subarray(0, mid.length).equals(mid), "earlier notes untouched");
  const added = after.subarray(before.length).toString("utf8").trimEnd().split("\n");
  assert.deepEqual(added.map((l) => l.match(LINE)?.[1]), ["status", "decision", "blocker"]);
});

test("a file without a trailing newline gets one before the note; old text unchanged", () => {
  const dir = setup("# Build log\nlast line");
  assert.equal(note(dir, ["hello"]).status, 0);
  const s = progress(dir);
  assert.ok(s.startsWith("# Build log\nlast line\n- "));
  assert.match(s.split("\n")[2], LINE);
});

test("resolves the repo root with git rev-parse from a subdirectory", () => {
  const dir = setup();
  const r = note(dir, ["from a subdir"], join(dir, "src/deep"));
  assert.equal(r.status, 0, r.stderr);
  assert.match(progress(dir), /\[note\] from a subdir\n$/);
  assert.equal(existsSync(join(dir, "src/deep/PROGRESS.md")), false);
});

test("empty, multi-line, control-character and comment payloads are rejected; file unchanged", () => {
  const dir = setup();
  const before = readFileSync(join(dir, "PROGRESS.md"));
  const bad = [
    [""], ["   "], ["line one\nline two"], ["line one\r\nline two"], ["carriage\rreturn"],
    ["tab\there"], ["bell\u0007"], ["sep\u2028arator"], ["<!-- auto: A-9 -->"], ["x -->"],
    ["x".repeat(501)], [], ["two", "args"], ["--kind", "rewrite", "x"], ["--kind"],
  ];
  for (const args of bad) {
    const r = note(dir, args);
    assert.equal(r.status, 1, `rejected: ${JSON.stringify(args)}`);
  }
  assert.ok(readFileSync(join(dir, "PROGRESS.md")).equals(before), "no bytes written on rejection");
});

test("outside a git repo or without PROGRESS.md it fails and creates nothing", () => {
  const noGit = mkdtempSync(join(tmpdir(), "w5-note-nogit-"));
  mkdirSync(join(noGit, "scripts"));
  cpSync(join(ROOT, "scripts/progress-note.mjs"), join(noGit, "scripts/progress-note.mjs"));
  writeFileSync(join(noGit, "PROGRESS.md"), HEADER);
  const r = spawnSync("node", [join(noGit, "scripts/progress-note.mjs"), "x"], {
    encoding: "utf8", cwd: noGit, env: { ...process.env, GIT_CEILING_DIRECTORIES: tmpdir() },
  });
  assert.equal(r.status, 1);
  assert.equal(readFileSync(join(noGit, "PROGRESS.md"), "utf8"), HEADER);

  const dir = setup(null);
  assert.equal(note(dir, ["x"]).status, 1);
  assert.equal(existsSync(join(dir, "PROGRESS.md")), false);
});

test("the script only appends: no write/truncate/rename calls in its source", () => {
  const src = readFileSync(join(ROOT, "scripts/progress-note.mjs"), "utf8");
  assert.match(src, /appendFileSync\(file,/);
  for (const banned of ["writeFileSync", "truncate", "renameSync", "unlinkSync", "rmSync", "openSync", "createWriteStream"]) {
    assert.ok(!src.includes(banned), `must not use ${banned}`);
  }
});
