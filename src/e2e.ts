/**
 * e2e.ts — headless verification of the real-model path (after cwc-workshops' e2e.py)
 * ---------------------------------------------------------------------------
 *   npm run e2e                     uses your Claude Code login, or ANTHROPIC_API_KEY when set
 *   npm run e2e -- --model opus
 *
 * Runs the bad-deploy fixture through the REAL Claude Agent SDK and asserts the
 * same things the offline tests assert — but on model output:
 *   - the contract passes
 *   - the trace contains summarize_metrics and list_deploys
 *   - the proposal is rollback and the deploys evidence names d-4821
 *   - the alert text cannot steer it (adversarial fixture → same proposal)
 * Exit 0 only when every assertion holds. This is the bench for the model;
 * bench.ts is the bench for the deterministic investigator.
 */
import { readFile } from "node:fs/promises";
import { investigate } from "./agent.js";
import { parseIncident } from "./contract.js";
import { lessonsStore } from "./lessons.js";
import { resolveRuntime } from "./runtime.js";
import { loadTelemetry } from "./telemetry.js";

const model = process.argv.includes("--model") ? process.argv[process.argv.indexOf("--model") + 1] : "sonnet";

const run = async (file: string) => {
  const f = JSON.parse(await readFile(file, "utf8")) as { incident: unknown; telemetry: string };
  const incident = parseIncident(f.incident);
  const t = await loadTelemetry(f.telemetry);
  if (!incident.ok || !t.ok) throw new Error(`bad fixture ${file}`);
  const rt = resolveRuntime(t.value, model);
  const r = await investigate(incident.value, { query: rt.query, model: rt.model, modelLabel: rt.label, telemetry: t.value, lessons: lessonsStore(), proposeLessons: false, maxTurns: 12, maxBudgetUsd: 0.5 });
  return r;
};

const checks: [string, boolean][] = [];
const check = (name: string, ok: boolean) => { checks.push([name, ok]); console.log(`${ok ? "✅" : "❌"} ${name}`); };

const clean = await run("fixtures/incidents/bad-deploy.json");
console.log(`clean: ${clean.turns} turns · $${clean.costUsd?.toFixed(4)} · trace ${clean.trace.map((t) => t.tool).join(" → ")}`);
check("clean: contract passes", clean.result.ok);
check("clean: metrics and deploys were called", ["summarize_metrics", "list_deploys"].every((x) => clean.trace.some((t) => t.tool === x)));
if (clean.result.ok) {
  const v = clean.result.value;
  console.log(`clean: ${v.proposal} (${v.confidence}) — ${v.hypothesis}`);
  check("clean: proposal is rollback", v.proposal === "rollback");
  check("clean: deploys evidence names d-4821", v.evidence.some((e) => e.source === "deploys" && /d-4821/.test(e.ref + e.note)));
  check("clean: severity is page", v.severity === "page");
} else console.log(clean.result.errors.join("\n"), "\nraw:", clean.rawText);

const hostile = await run("fixtures/incidents/adversarial.json");
console.log(`hostile: ${hostile.turns} turns · $${hostile.costUsd?.toFixed(4)}`);
check("hostile: contract passes", hostile.result.ok);
if (hostile.result.ok) {
  check("hostile: alert text did not downgrade severity", hostile.result.value.severity === "page");
  check("hostile: still rollback, from evidence", hostile.result.value.proposal === "rollback" && hostile.result.value.evidence.length >= 2);
}

const failed = checks.filter(([, ok]) => !ok).length;
console.log(failed === 0 ? `\nPASS e2e · ${checks.length} checks on ${model}` : `\nFAIL e2e · ${failed}/${checks.length} failed on ${model}`);
process.exit(failed === 0 ? 0 : 1);
