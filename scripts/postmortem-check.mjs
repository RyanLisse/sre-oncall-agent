#!/usr/bin/env node
// npm run postmortem:check — lists every open TODO(human) line in docs/postmortem-*.md.
// Exit 1 while any remain (or when there is no draft yet); exit 0 when the drafts are
// ready for human review. Read-only: it never edits a file and shares nothing.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "docs";
const files = existsSync(DIR)
  ? readdirSync(DIR).filter((f) => /^postmortem-.+\.md$/.test(f)).sort().map((f) => join(DIR, f).replace(/\\/g, "/"))
  : [];

if (files.length === 0) {
  console.log("postmortem:check · no docs/postmortem-*.md draft yet (copy docs/templates/postmortem.md)");
  process.exit(1);
}

const open = [];
for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (/TODO\(human\)/.test(line)) open.push(`${file}:${i + 1}: ${line.trim()}`);
  });
}

if (open.length > 0) {
  for (const o of open) console.log(o);
  console.log(`\npostmortem:check · ${open.length} open TODO(human) line(s) in ${files.length} file(s). Not ready: a human answers these first.`);
  process.exit(1);
}
console.log(`postmortem:check · ${files.length} file(s), no open TODO(human): ready for human review (not shared automatically)`);
