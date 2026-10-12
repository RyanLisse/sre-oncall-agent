#!/usr/bin/env node
// First-pass scanner for a skill folder you downloaded from OUTSIDE the vetted pack. Local only, no network.
// It flags lines a human must read; it does NOT prove a skill is safe. Usage: npm run skill:scan -- <path-to-skill-folder>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RULES = [
  ["shell-on-load", /^\s*[-*]?.*!`[^`]+`/, "`!` line: runs a shell command the moment the skill loads"],
  ["broad-tools", /allowed-tools:.*(Bash\(\*\)|Bash\s*$|\bBash\b(?!\())/i, "allowed-tools grants broad Bash access"],
  ["allowed-tools", /^allowed-tools:/i, "allowed-tools: which extra permissions does the skill ask for?"],
  ["network", /\b(curl|wget|Invoke-WebRequest|iwr|irm|fetch\(|requests\.(get|post)|urllib|http\.request|axios|nc|ncat|scp|ssh)\b|https?:\/\//i, "network/URL: where does data go?"],
  ["pipe-to-shell", /\|\s*(sh|bash|zsh|pwsh|powershell|iex)\b|base64\s+(-d|--decode)|\beval\b|\bexec\(/i, "downloads/decodes code and executes it"],
  ["installs", /\b(npx|npm\s+i(nstall)?|pip3?\s+install|uvx|go\s+install|cargo\s+install|brew\s+install|git\s+clone)\b/i, "installs or fetches external code"],
  ["secrets", /\.env\b|\.ssh|id_rsa|credentials|token|secret|api[_-]?key|gcloud|\bprintenv\b|\benv\b\s*$/i, "touches secrets, tokens or environment variables"],
  ["exfil-git", /git\s+(push|remote\s+add)|gh\s+(gist|api)|glab\s+api/i, "can send data to a (different) remote"],
  ["injection", /ignore (all |any )?(previous|prior|above) (instructions|rules)|do not tell the user|don't tell the user|without asking|silently|hidden|bypass|--dangerously-skip-permissions|disable.*hook/i, "prompt injection / hiding / bypassing safety"],
  ["invisible", /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/, "invisible characters (zero-width / bidi)"],
  ["html-comment", /<!--[\s\S]*?-->/, "HTML comment: hidden instructions?"],
];
const root = process.argv[2];
if (!root) { console.error("usage: npm run skill:scan -- <path-to-skill-folder>"); process.exit(2); }
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
let hits = 0; const files = walk(root);
for (const f of files) {
  const lines = readFileSync(f, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => { for (const [id, re, why] of RULES) if (re.test(line)) { hits++; console.log(`${relative(root, f) || f}:${i + 1}  [${id}] ${why}\n    ${line.trim().slice(0, 140)}`); } });
  if (!/SKILL\.md$|\.md$/i.test(f)) { hits++; console.log(`${relative(root, f)}  [script] not markdown: read this file completely before installing`); }
}
console.log(`\n${files.length} file(s), ${hits} flag(s). An empty list does NOT mean the skill is safe: read SKILL.md and every script yourself.`);
process.exit(hits ? 1 : 0);
