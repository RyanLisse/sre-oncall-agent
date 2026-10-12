#!/usr/bin/env node
// Progress hook for the Workshop 5 lab (sre-oncall-agent), adapted from aetherlink-sre-agent-lab.
// Append-only: on each hook event, appends a PROGRESS.md entry for every assignment (A-1..A-9)
// whose local evidence is new. `npm run progress` prints the live checklist.
// The hook never rewrites entries; humans fill in the "<fill in: …>" bullets.
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";

const FILE = "PROGRESS.md";

function evidence() {
  const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  const audit = read("approvals/audit.jsonl");
  const cases = (() => { try { return JSON.parse(read("bench/cases.json")); } catch { return []; } })();
  const lessons = read("lessons/lessons.md");
  return [
    {
      key: "A-1", name: "setup",
      done: existsSync("node_modules") && audit.includes("allow"),
      title: "Setup: install, green tests, console smoke",
      shipped: "Dependencies installed; the suite ran and the guard hook produced its first audit entries.",
      validation: "`npm ci`, `npm test`, `npm run test:workshop`, `npm run console` + `/api/health`.",
      hint: "run npm ci, npm test, npm run test:workshop, then npm run console and open localhost:4320",
    },
    {
      key: "A-2", name: "intent",
      done: existsSync("intent.md") && !read("intent.md").includes("<fill"),
      title: "Intent: who the agent serves + the boundary",
      shipped: "intent.md filled in: audience, read-only boundary (propose, never mutate; humans close) and three stranger-verifiable checks.",
      validation: "A stranger can point at intent.md's three checks and run them.",
      hint: "fill intent.md: who it serves, the boundary, three verifiable checks",
    },
    {
      key: "A-3", name: "spec + contract",
      done: read("docs/spec.md").length > 0 && !read("docs/spec.md").includes("<fill")
        && read("src/contract.ts").includes("customer_impact"),
      title: "Spec + contract: evidence rules and customer_impact red to green",
      shipped: "Contract rebuilt test-first: evidence rules reject uncited claims; new required field customer_impact enforced end to end.",
      validation: "`npm run test:workshop` shows workshop-contract green; `npm test` still green.",
      hint: "rebuild the evidence rules + customer_impact in src/contract.ts; fill docs/spec.md",
    },
    {
      key: "A-4", name: "design + controls",
      done: audit.includes('"deny"') && read(".claude/hooks/guard.mjs").includes("ratchet.json")
        && read("src/chat.ts").includes("MUTATION"),
      title: "Controls: chat refuses mutations + guard hook wired",
      shipped: "routeMessage refuses mutation requests in chat again; guard.mjs gained a participant-chosen deny rule and is wired in settings.json.",
      validation: "`npm run test:workshop` + `npm run test:hooks` green; a deny line exists in approvals/audit.jsonl.",
      hint: "restore the MUTATION refusal in src/chat.ts; add a deny rule to .claude/hooks/guard.mjs (humans edit hooks, the agent may not)",
    },
    {
      key: "A-5", name: "read-only tool",
      done: /tool\(\s*"list_deploys"/.test(read("src/tools.ts")),
      title: "Build: list_deploys tool + capability binding",
      shipped: "list_deploys re-implemented as a read-only telemetry tool and bound to its capability in the handlers map.",
      validation: "`npm run test:workshop` green; the console investigation trace shows a list_deploys call.",
      hint: "re-implement list_deploys in src/tools.ts (handler + registration); prove it in the console trace",
    },
    {
      key: "A-6", name: "live diagnosis",
      done: existsSync("docs/diagnosis-live.md") && !read("docs/diagnosis-live.md").includes("<fill"),
      title: "Diagnose a live incident from the console",
      shipped: "A real chaos run (shop + traffic + bad deploy) produced an incident; the diagnosis with evidence refs was captured in docs/diagnosis-live.md.",
      validation: "Console incident detail shows hypothesis + evidence refs; a chat challenge was answered without mutating.",
      hint: "npm run shop + traffic, then chaos deploy v2.15.0 --mode bad-deploy; save the diagnosis to docs/diagnosis-live.md",
    },
    {
      key: "A-7", name: "eval + ratchet",
      done: Array.isArray(cases) && cases.length > 5,
      title: "Eval: bench + one new case + ratchet held",
      shipped: "A new incident shape was added to bench/cases.json; the ratchet floor was tried and could only go up.",
      validation: "`npm run bench` prints PASS bench (N/M); lowering bench/ratchet.json exits 1.",
      hint: "npm run bench; add a case to bench/cases.json; try lowering bench/ratchet.json",
    },
    {
      key: "A-8", name: "gate",
      done: (existsSync("approvals") ? readdirSync("approvals") : []).some((f) => f.endsWith(".approval.json"))
        && read("src/executor.ts").includes("isApproved"),
      title: "Gate: executor verifies a NAMED approval before executing",
      shipped: "The executor gate rebuilt: it verifies the approval signature for this incident + proposal before planRollback runs.",
      validation: "Console: approve with your name, Execute, watch LANDED; chat still refuses 'roll back now'.",
      hint: "restore isApproved in src/executor.ts checkApproval; approve + execute in the console",
    },
    {
      key: "A-9", name: "maintain + hackathon",
      done: (lessons.match(/^## INC-/gm) ?? []).length > 2
        && existsSync("docs/hackathon-intent.md") && !read("docs/hackathon-intent.md").includes("<fill"),
      title: "Maintain: resolution notes became a lesson + hackathon intent",
      shipped: "A resolved incident's notes landed in lessons/lessons.md with provenance; lessons/proposed reviewed; docs/hackathon-intent.md written.",
      validation: "lessons/lessons.md has a new dated entry with the incident id and author name.",
      hint: "resolve the incident with notes; review lessons/proposed; write docs/hackathon-intent.md",
    },
  ];
}

function stamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  const off = -d.getTimezoneOffset(), s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${s}${p(a / 60)}:${p(a % 60)}`;
}

function entry(step) {
  return `\n## ${stamp()} — ${step.title} (${step.key})\n<!-- auto: ${step.key} -->\n\n- **What shipped:** ${step.shipped}\n- **Why it mattered:** <fill in: what this step proves about the AI SDLC>\n- **How, and what was rejected:** <fill in>\n- **Validation:** ${step.validation}\n- **Deliberately not done:** <fill in>\n`;
}

if (!existsSync(FILE)) process.exit(0); // no PROGRESS.md yet: stay silent
const done = readFileSync(FILE, "utf8");

if (process.argv.includes("--status")) {
  const rows = evidence();
  const n = rows.filter((s) => s.done).length;
  console.log(`sre-oncall-agent (Workshop 5): ${n}/${rows.length} assignments with evidence`);
  for (const s of rows) console.log(`${s.done ? "✓" : "·"} ${s.key} ${s.name} — ${s.done ? s.title : "open: " + s.hint}`);
  process.exit(0);
}

for (const s of evidence()) {
  if (s.done && !done.includes(`<!-- auto: ${s.key} -->`)) appendFileSync(FILE, entry(s));
}
process.exit(0);
