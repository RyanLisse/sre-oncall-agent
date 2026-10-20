#!/usr/bin/env node
// PreToolUse guard for the Workshop 5 lab (sre-oncall-agent).
// Ported from aetherlink-sre-agent-lab (.claude/hooks/guard.mjs) and adapted to this repo.
// Decisions are appended to approvals/audit.jsonl; check-approval.mjs reads approvals/approvals.jsonl.
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

const SECRET = /(\.env|secrets|\.pem$|\.key$|id_rsa|credentials|\.ssh|application_default_credentials|gcloud)/i;
const NETWORK = /\b(curl|wget|nc|ncat|ssh|scp|sftp|telnet|ftp|Invoke-WebRequest|iwr|irm)\b|https?:\/\//i;
const APPROVAL_TOUCH = /approvals\/|scripts\/(approve|check-approval)|npm run approve|CLAUDECODE/;
const HUMAN_ONLY = /gh pr (merge|review --approve)|glab mr (merge|approve)|gh api .*\/(merges|approve)/;
const GATED = /\bgit push\b|gh pr (create|ready|edit)|glab mr (create|update)|\bkubectl\b|\bhelm\b|\bsystemctl\b|\bdocker (run|exec|push)\b|\bpsql\b/;
const SDLC_ARTEFACT = /^(intent\.md|HANDOFF\.md|CLAUDE\.md|REVIEW\.md|WORKSHOP\.md|FACILITATOR\.md|docs\/(spec|plan|diagnosis-live)\.md|docs\/decisions\/[^/]+\.md|bench\/cases\.json|test\/[^/]+\.test\.(ts|mjs)|test\/workshop\/[^/]+\.test\.ts)$/;
const AGENT_WRITES = /^docs\/(diagnoses|verify|show-me|pr|handoff)\/|^lessons\/proposed\//;

// The repo root comes from git, falling back to the cwd (e.g. an unpacked ZIP),
// never from the folder name: participants may clone into any directory.
function repoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim() || process.cwd();
  } catch {
    return process.cwd();
  }
}
const ROOT = repoRoot();
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
// Resolve symlinks (e.g. macOS /var -> /private/var) via the nearest existing ancestor.
function realish(p) {
  let head = p;
  while (!existsSync(head) && dirname(head) !== head) head = dirname(head);
  return join(real(head), relative(head, p));
}
// Repo-relative path ("src/x.ts") or null when the target is outside the repo.
function repoRelative(p) {
  if (!p) return "";
  const abs = resolve(process.cwd(), p);
  for (const [root, target] of [[ROOT, abs], [real(ROOT), realish(abs)]]) {
    const r = relative(root, target).replace(/\\/g, "/");
    if (r === "") return "";
    if (!r.startsWith("../") && r !== ".." && !isAbsolute(r)) return r;
  }
  return null;
}

const auditDir = join(ROOT, "approvals");
if (!existsSync(auditDir)) mkdirSync(auditDir, { recursive: true });

function decide(decision, reason) {
  try {
    appendFileSync(
      join(auditDir, "audit.jsonl"),
      JSON.stringify({ at: new Date().toISOString(), decision, reason, input: raw.slice(0, 500) }) + "\n",
    );
  } catch { /* never block on logging */ }
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
}

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;
let input;
try { input = JSON.parse(raw); } catch {
  decide("deny", "guard: malformed input, failing closed");
  process.exit(0);
}

function approvalFor(ref) {
  const file = join(auditDir, "approvals.jsonl");
  if (!existsSync(file)) return null;
  return readFileSync(file, "utf8")
    .split("\n").filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .find((a) => a && a.ref === ref && a.approved_by) ?? null;
}

const tool = input.tool_name ?? "";
const cmd = input.tool_input?.command ?? "";
const path = (input.tool_input?.file_path ?? input.tool_input?.path ?? "").replace(/\\/g, "/");
const inside = repoRelative(path);
const rel = inside ?? path;

if (tool === "Bash" || tool === "PowerShell") {
  if (NETWORK.test(cmd)) decide("deny", "offline lab: no network calls from the agent (curl/wget/ssh/URLs)");
  else if (SECRET.test(cmd)) decide("deny", "guard: command touches a secret path");
  else if (APPROVAL_TOUCH.test(cmd)) decide("deny", "approvals are signed by a human in their own terminal, not by the agent");
  else if (HUMAN_ONLY.test(cmd)) decide("deny", "merges and review approvals are human-only actions");
  else if (GATED.test(cmd)) {
    const m = cmd.match(/fix\/[\w.-]+/);
    const ref = m ? m[0] : null;
    if (ref && approvalFor(ref)) decide("allow", `push of ${ref} is covered by a named approval`);
    else decide(ref ? "ask" : "deny",
      ref ? `git push of ${ref}: needs a named human approval (npm run approve:git -- <name> ${ref} "<reason>")`
          : "gated command (push/deploy/k8s): humans only");
  } else decide("allow", "command not gated");
} else if (tool === "Read" || tool === "Grep" || tool === "Glob") {
  if (SECRET.test(path)) decide("deny", "guard: secret path");
  else decide("allow", "read is fine");
} else if (tool === "Write" || tool === "Edit" || tool === "MultiEdit" || tool === "NotebookEdit") {
  if (SECRET.test(path)) decide("deny", "guard: secret path");
  else if (inside === null) decide("deny", "guard: outside the repo");
  else if (APPROVAL_TOUCH.test(rel) || /^\.claude\//.test(rel) || rel === "PROGRESS.md")
    decide("deny", "guard: approvals, .claude/ and PROGRESS.md are human/hook owned");
  else if (AGENT_WRITES.test(rel)) decide("allow", "agent artefact dir");
  else if (/^bench\/ratchet\.json$/.test(rel)) decide("deny", "participant rule (A4): the ratchet floor is human-owned — the agent never edits it");
  else if (SDLC_ARTEFACT.test(rel)) decide("ask", "SDLC artefact: confirm this edit with the human");
  else decide("ask", "edit needs a human confirmation");
} else decide("allow", "tool not gated");
