#!/usr/bin/env node
/**
 * scripts/checkpoint.mjs — catch up without overwriting your own work
 * ---------------------------------------------------------------------------
 *   npm run checkpoint              list the checkpoints from workshop.json
 *   npm run checkpoint -- core-2    put a copy in .lab/checkpoints/core-2
 *
 * Each checkpoint is a separate git worktree under .lab/ (ignored by git).
 * Your branch and your working files are never touched. Compare a file and
 * copy it yourself if you choose. Do not work inside .lab/checkpoints/: the
 * next run of this command resets that copy.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const { checkpoints } = JSON.parse(readFileSync("workshop.json", "utf8"));
const git = (...args) => spawnSync("git", args, { encoding: "utf8" });
const id = process.argv[2];

if (!id) {
  console.log("Checkpoints (a separate copy each; your files do not change):\n");
  for (const c of checkpoints) console.log(`  ${c.id.padEnd(8)} ${existsSync(`.lab/checkpoints/${c.id}`) ? "✓ in .lab/checkpoints/" + c.id : "  "}  ${c.say}`);
  console.log("\nUse: npm run checkpoint -- <id>");
  process.exit(0);
}
const c = checkpoints.find((x) => x.id === id);
if (!c) { console.error(`No checkpoint "${id}". Choose one of: ${checkpoints.map((x) => x.id).join(", ")}`); process.exit(1); }
if (git("rev-parse", "--verify", "--quiet", `${c.ref}^{commit}`).status !== 0) {
  console.error(`The ref ${c.ref} is not in your clone. Run: git fetch --tags   then try again.`);
  process.exit(1);
}
const dir = `.lab/checkpoints/${c.id}`;
const r = existsSync(dir) ? git("-C", dir, "checkout", "--detach", "--force", c.ref) : git("worktree", "add", "--detach", dir, c.ref);
if (r.status !== 0) { console.error(r.stderr.trim()); process.exit(1); }
console.log(`✓ ${dir} now holds ${c.ref}: ${c.say}
  Your branch and files did not change.

  Compare:  git diff --no-index ${dir}/src/tools.ts src/tools.ts
  Copy one file, if you choose:  cp ${dir}/src/tools.ts src/tools.ts
  Run that copy instead: stop your lab first (Ctrl+C), then cd ${dir} && npm ci && npm start`);
