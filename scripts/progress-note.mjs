#!/usr/bin/env node
// Append ONE timestamped line to PROGRESS.md. This is the only way the agent
// writes PROGRESS.md: Edit/Write on it stay denied (settings.json + guard.mjs).
//
//   npm run progress:note -- "<text>"
//   npm run progress:note -- --kind status|decision|blocker "<text>"
//
// Append-only by construction: fs.appendFileSync; it never rewrites or shortens the file.
// Rejects empty, multi-line, control-character and HTML-comment payloads, so a
// note can never fake an `<!-- auto: A-n -->` marker or rewrite an old line.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const KINDS = ["note", "status", "decision", "blocker"];
const MAX = 500;

const fail = (msg) => { console.error(`progress:note: ${msg}`); process.exit(1); };

function repoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return fail("not inside a git repository (git rev-parse --show-toplevel failed)");
  }
}

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

const args = process.argv.slice(2);
let kind = "note";
const k = args.indexOf("--kind");
if (k !== -1) {
  kind = args[k + 1] ?? "";
  args.splice(k, 2);
  if (!KINDS.includes(kind)) fail(`--kind must be one of ${KINDS.join(", ")}`);
}
if (args.length !== 1) fail('usage: npm run progress:note -- [--kind status|decision|blocker] "<text>"');

const text = args[0].trim();
if (text === "") fail("empty note");
if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(args[0])) fail("one line only: no newlines or control characters");
if (text.includes("<!--") || text.includes("-->")) fail("no HTML comments in a note");
if (text.length > MAX) fail(`note longer than ${MAX} characters`);

const file = join(repoRoot(), "PROGRESS.md");
if (!existsSync(file)) fail(`${file} not found`);

const existing = readFileSync(file, "utf8");
const lead = existing.length === 0 || existing.endsWith("\n") ? "" : "\n";
appendFileSync(file, `${lead}- ${stamp()} [${kind}] ${text}\n`);
console.log(`progress:note: appended [${kind}] to PROGRESS.md`);
