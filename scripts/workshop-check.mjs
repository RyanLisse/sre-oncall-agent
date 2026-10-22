#!/usr/bin/env node
// Workshop consistency check for sre-oncall-agent.
//   node scripts/workshop-check.mjs            report the cut markers in the checked-out tree
//   node scripts/workshop-check.mjs --expect-start   assert: both exercise markers are present
//   node scripts/workshop-check.mjs --expect-solved  assert: no exercise markers are present
// Local only; node built-ins. Exit 0 = consistent, 1 = inconsistent, 2 = bad usage.
import { readFileSync, existsSync } from "node:fs";

const MARKERS = [
  ["A5 list_deploys", "src/tools.ts", /TODO\(A5\)/],
  ["A8 executor gate", "src/executor.ts", /TODO\(A8\)/],
];

const mode = process.argv[2] ?? "report";
if (!["report", "--expect-start", "--expect-solved"].includes(mode)) {
  console.error("usage: workshop-check.mjs [--expect-start|--expect-solved]");
  process.exit(2);
}

let present = 0;
const counts = [];
for (const [label, file, re] of MARKERS) {
  const count = existsSync(file) ? (readFileSync(file, "utf8").match(new RegExp(re.source, "g")) ?? []).length : 0;
  counts.push(count);
  present += count ? 1 : 0;
  console.log(`${count ? "stub" : "done"}  ${label.padEnd(20)} ${file}${count > 1 ? ` (${count} markers)` : ""}`);
}
const workshopSuite = existsSync("test/workshop") && existsSync("test/workshop/contract.test.ts");
console.log(`${workshopSuite ? "ok  " : "MISS"}  workshop suite       test/workshop/*.test.ts`);

if (mode === "--expect-start" && (counts.some((count) => count !== 1) || !workshopSuite)) {
  console.error(`\nworkshop:check FAIL — expected one of each exercise marker, found ${present}`);
  process.exit(1);
}
if (mode === "--expect-solved" && (present !== 0 || !workshopSuite)) {
  console.error(`\nworkshop:check FAIL — expected no cut markers, found ${present}`);
  process.exit(1);
}
console.log(`\nworkshop:check ${mode === "report" ? `— ${present}/${MARKERS.length} markers` : "PASS"}`);
