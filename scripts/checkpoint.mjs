#!/usr/bin/env node
/**
 * scripts/checkpoint.mjs — catch up without overwriting your own work
 * ---------------------------------------------------------------------------
 *   npm run checkpoint              list the checkpoints from workshop.json
 *   npm run checkpoint -- core-2    put a copy in .lab/checkpoints/core-2
 *
 * Each checkpoint is a separate git worktree under .lab/ (ignored by git).
 * Your branch and your working files are never touched. Existing checkpoint
 * destinations are never overwritten; compare files and choose what to copy.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const { checkpoints } = JSON.parse(readFileSync("workshop.json", "utf8"));
const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
const id = process.argv[2];

if (!id || id === "--help" || id === "-h") {
  console.log("Checkpoints (a separate copy each; your files do not change):\n");
  for (const c of checkpoints) console.log(`  ${c.id.padEnd(8)} ${existsSync(`.lab/checkpoints/${c.id}`) ? "✓ in .lab/checkpoints/" + c.id : "  "}  ${c.say}`);
  console.log("\nUse: npm run checkpoint -- <id>");
  process.exit(0);
}
const c = checkpoints.find((x) => x.id === id);
if (!c) { console.error(`No checkpoint "${id}". Choose one of: ${checkpoints.map((x) => x.id).join(", ")}`); process.exit(1); }
const root = git("rev-parse", "--show-toplevel").stdout.trim();
const sha = git("-C", root, "rev-parse", "HEAD").stdout.trim();
const tools = git("-C", root, "show", "HEAD:src/tools.ts").stdout;
const executor = git("-C", root, "show", "HEAD:src/executor.ts").stdout;
if (!sha || tools.includes("fatal:") || executor.includes("fatal:")) { console.error("Cannot read committed HEAD sources; no checkpoint was created."); process.exit(1); }
const handlerPattern = /  list_deploys: \(args: \{ since\?: string \| undefined; until\?: string \| undefined \}\) =>\n    listDeploys\(t, args\.since, args\.until\),/g;
const registrationPattern = /      tool\(\n        "list_deploys",[\s\S]*?\n      \),/g;
const approvalPattern = /export const checkApproval = \(record: ApprovalRecord, incident: Incident\): Result<ApprovalRecord> =>\n  record\.proposal !== "rollback"[\s\S]*?fail\(\[`approval for \$\{incident\.incident_id\} is \$\{record\.decision\} by \$\{record\.decided_by\} — not executable`\]\);/;
const makeCheckpointSources = (checkpointId, committedTools, committedExecutor) => {
  if ((committedTools.match(handlerPattern) ?? []).length !== 1 || (committedTools.match(registrationPattern) ?? []).length !== 1) {
    throw new Error("HEAD src/tools.ts does not match the expected single A5 handler and registration shape.");
  }
  if (!approvalPattern.test(committedExecutor) || committedExecutor.includes("TODO(A8)")) {
    throw new Error("HEAD src/executor.ts does not contain the solved A8 gate.");
  }
  const a5Tools = committedTools
    .replace(handlerPattern, "  // TODO(A5): restore the read-only handler binding.\n  list_deploys: (_args: { since?: string | undefined; until?: string | undefined }) => [] as ReturnType<typeof listDeploys>,");
  const a8Executor = committedExecutor.replace(approvalPattern, 'export const checkApproval = (_record: ApprovalRecord, _incident: Incident): Result<ApprovalRecord> =>\n  fail(["TODO(A8): rebuild the named human approval gate before execution"]);');
  if ((a5Tools.match(/TODO\(A5\)/g) ?? []).length !== 1 || (a8Executor.match(/TODO\(A8\)/g) ?? []).length !== 1) {
    throw new Error("The source cuts did not produce exactly one A5 and one A8 exercise marker.");
  }
  return {
    tools: checkpointId === "start" ? a5Tools : committedTools,
    executor: checkpointId === "core-3" ? committedExecutor : a8Executor,
  };
};
let sources;
try { sources = makeCheckpointSources(id, tools, executor); }
catch (error) { console.error(`${error.message} No checkpoint was created.`); process.exit(1); }
const dir = resolve(root, ".lab", "checkpoints", c.id);
if (existsSync(dir)) { console.error(`Refusing to overwrite existing checkpoint: ${dir}`); process.exit(1); }
mkdirSync(dirname(dir), { recursive: true });
const r = git("-C", root, "worktree", "add", "--detach", dir, "HEAD");
if (r.status !== 0) { console.error((r.stderr || r.stdout).trim()); process.exit(1); }
if (sources.tools !== tools) writeFileSync(join(dir, "src/tools.ts"), sources.tools);
if (sources.executor !== executor) writeFileSync(join(dir, "src/executor.ts"), sources.executor);
writeFileSync(join(dir, "CHECKPOINT.md"), `# Workshop checkpoint: ${c.id}\n\nSource commit: ${sha}\nCheckpoint label: ${c.id}\n\n${c.say}\n`);
console.log(`✓ ${dir} from committed HEAD ${sha}: ${c.say}
  Your branch and files did not change.

  Compare:  git diff --no-index ${dir}/src/tools.ts src/tools.ts
  Run that copy instead: stop your lab first (Ctrl+C), then cd ${dir} && npm ci && npm start`);
