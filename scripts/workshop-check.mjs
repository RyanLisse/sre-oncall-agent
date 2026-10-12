#!/usr/bin/env node
// Workshop consistency check for sre-oncall-agent.
//   node scripts/workshop-check.mjs            report the cut markers in the checked-out tree
//   node scripts/workshop-check.mjs --expect-start   assert: all 4 markers present (workshop/start)
//   node scripts/workshop-check.mjs --expect-solved  assert: no markers (main / w5-step-8-maintain)
// Local only; node built-ins. Exit 0 = consistent, 1 = inconsistent, 2 = bad usage.
import { readFileSync, existsSync } from "node:fs";

const MARKERS = [
  ["A3 contract rules", "src/contract.ts", /TODO\(A3\)/],
  ["A4 chat refusal", "src/chat.ts", /TODO\(A4\)/],
  ["A4 guard rule", ".claude/hooks/guard.mjs", /TODO\(A4\)/],
  ["A5 list_deploys", "src/tools.ts", /TODO\(A5\)/],
  ["A8 executor gate", "src/executor.ts", /TODO\(A8\)/],
];

const mode = process.argv[2] ?? "report";
if (!["report", "--expect-start", "--expect-solved"].includes(mode)) {
  console.error("usage: workshop-check.mjs [--expect-start|--expect-solved]");
  process.exit(2);
}

let present = 0;
for (const [label, file, re] of MARKERS) {
  const hit = existsSync(file) && re.test(readFileSync(file, "utf8"));
  present += hit ? 1 : 0;
  console.log(`${hit ? "stub" : "done"}  ${label.padEnd(20)} ${file}`);
}
const workshopSuite = existsSync("test/workshop") && existsSync("test/workshop/contract.test.ts");
console.log(`${workshopSuite ? "ok  " : "MISS"}  workshop suite       test/workshop/*.test.ts`);

if (mode === "--expect-start" && (present !== MARKERS.length || !workshopSuite)) {
  console.error(`\nworkshop:check FAIL — expected ${MARKERS.length} cut markers, found ${present}`);
  process.exit(1);
}
if (mode === "--expect-solved" && (present !== 0 || !workshopSuite)) {
  console.error(`\nworkshop:check FAIL — expected no cut markers, found ${present}`);
  process.exit(1);
}
console.log(`\nworkshop:check ${mode === "report" ? `— ${present}/${MARKERS.length} markers` : "PASS"}`);
