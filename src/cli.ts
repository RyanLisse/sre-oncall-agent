/**
 * cli.ts — `npm run investigate` and `npm run watch`
 * ---------------------------------------------------------------------------
 * Local, reproducible, offline by default.
 *
 *   npm run investigate -- fixtures/incidents/bad-deploy.json --dry-run
 *   npm run approve  -- fixtures/incidents/bad-deploy.json --by ryan          (or --reject)
 *   npm run watch    -- fixtures/incidents/bad-deploy.json --metric error_rate \
 *                       --fix-at 2026-10-05T03:52:00Z --after fixtures/telemetry/after-rollback.json
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { investigate } from "./agent.js";
import { decide, draftApproval, isApproved, readApproval, writeApproval } from "./approval.js";
import { lessonsStore } from "./lessons.js";
import { parseIncident, parseJson } from "./router.js";
import { resolveRuntime, type AgentEvent } from "./runtime.js";
import { loadTelemetry } from "./telemetry.js";
import { watchMetric, type WatchMetric } from "./watch.js";

const printMessage = (message: AgentEvent): void => {
  if (message.type === "assistant" && message.parent_tool_use_id === null) {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) console.log(block.text);
      if (block.type === "tool_use") console.log(`Tool: ${block.name} ${JSON.stringify(block.input ?? {})}`);
    }
  } else if (message.type === "result") {
    console.log(`Done: ${message.subtype}`);
  }
};

interface IncidentFile {
  readonly incident: unknown;
  readonly telemetry: string;
}

const readIncidentFile = async (path: string): Promise<{ incident: unknown; telemetryPath: string } | string[]> => {
  const json = parseJson(await readFile(path, "utf8"));
  if (!json.ok) return json.errors;
  const f = json.value as Partial<IncidentFile>;
  if (typeof f.telemetry !== "string" || f.incident === undefined)
    return ["incident file: expected { incident: {...}, telemetry: \"<path>\" }"];
  return { incident: f.incident, telemetryPath: f.telemetry };
};

const main = async (): Promise<number> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      "dry-run": { type: "boolean", default: false },
      out: { type: "string" },
      model: { type: "string" },
      "max-turns": { type: "string" },
      "max-budget-usd": { type: "string" },
      watch: { type: "boolean", default: false },
      metric: { type: "string" },
      after: { type: "string" },
      "fix-at": { type: "string" },
      approve: { type: "boolean", default: false },
      reject: { type: "boolean", default: false },
      by: { type: "string" },
    },
  });

  const inputPath = positionals[0] ?? "fixtures/incidents/bad-deploy.json";
  const file = await readIncidentFile(inputPath);
  if (Array.isArray(file)) {
    console.error(`FAIL input ${inputPath}\n  - ${file.join("\n  - ")}`);
    return 1;
  }
  const incident = parseIncident(file.incident);
  if (!incident.ok) {
    console.error(`FAIL input ${inputPath}\n  - ${incident.errors.join("\n  - ")}`);
    return 1;
  }

  const approvalsDir = process.env.AGENT_APPROVALS_DIR ?? "approvals";

  // ── approve/reject mode: a named human signs the pending record ──────
  if (values.approve || values.reject) {
    if (values.approve && values.reject) {
      console.error("FAIL choose --approve or --reject, not both");
      return 1;
    }
    const existing = await readApproval(approvalsDir, incident.value.incident_id);
    if (!existing.ok) {
      console.error(`FAIL no pending approval for ${incident.value.incident_id} — run investigate (without --dry-run) first\n  - ${existing.errors.join("\n  - ")}`);
      return 1;
    }
    const signed = decide(existing.value, values.approve ? "approved" : "rejected", values.by ?? "", new Date().toISOString());
    if (!signed.ok) {
      console.error(`FAIL approval\n  - ${signed.errors.join("\n  - ")}`);
      return 1;
    }
    const path = await writeApproval(approvalsDir, signed.value);
    console.log(`▶ ${signed.value.decision.toUpperCase()} ${signed.value.proposal} for ${signed.value.incident_id} by ${signed.value.decided_by}`);
    console.log(`   ${signed.value.summary}`);
    console.log(`saved ${path}`);
    console.log(
      signed.value.decision === "approved"
        ? `\nPASS approval · an executor may now check isApproved(record, "${signed.value.incident_id}", "${signed.value.proposal}"). This tool executes nothing.`
        : "\nPASS approval · rejected. Nothing happens.",
    );
    return 0;
  }

  // ── watch mode: deterministic, no model ──────────────────────────────
  if (values.watch) {
    const metric = (values.metric ?? "error_rate") as WatchMetric;
    if (metric !== "error_rate" && metric !== "p95_ms") {
      console.error("FAIL --metric must be error_rate or p95_ms");
      return 1;
    }
    const afterPath = values.after ?? file.telemetryPath;
    const t = await loadTelemetry(afterPath);
    if (!t.ok) {
      console.error(`FAIL telemetry ${afterPath}\n  - ${t.errors.join("\n  - ")}`);
      return 1;
    }
    const fixAt = values["fix-at"];
    if (fixAt === undefined || Number.isNaN(Date.parse(fixAt))) {
      console.error("FAIL --fix-at <ISO time the human applied the fix> is required");
      return 1;
    }
    // Watching is only meaningful after an approved mitigation.
    const approval = await readApproval(approvalsDir, incident.value.incident_id);
    const gate = approval.ok && isApproved(approval.value, incident.value.incident_id, approval.value.proposal);
    const report = watchMetric(t.value, metric, incident.value.fired_at, fixAt);
    console.log(`▶ watch ${incident.value.incident_id} · ${metric} · fix at ${fixAt} · ${afterPath}`);
    console.log(gate ? `   approved: ${approval.ok ? approval.value.proposal : ""} by ${approval.ok ? approval.value.decided_by : ""}` : "   WARNING: no approved record for this incident — watching anyway, but nothing should have been changed");
    console.log(report.message);
    console.log(report.landed ? "\nPASS watch · the human may close the incident (only a human closes)." : "\nOPEN watch · do not close yet.");
    return report.landed ? 0 : 2;
  }

  // ── investigate mode ─────────────────────────────────────────────────
  const telemetry = await loadTelemetry(file.telemetryPath);
  if (!telemetry.ok) {
    console.error(`FAIL telemetry ${file.telemetryPath}\n  - ${telemetry.errors.join("\n  - ")}`);
    return 1;
  }

  const maxTurns = values["max-turns"] === undefined ? undefined : Number(values["max-turns"]);
  if (maxTurns !== undefined && !(Number.isInteger(maxTurns) && maxTurns >= 1)) {
    console.error(`FAIL --max-turns must be a whole number ≥ 1 (got ${values["max-turns"]})`);
    return 1;
  }

  const runtime = resolveRuntime(telemetry.value, values.model);
  console.log(`▶ incident ${incident.value.incident_id} · ${incident.value.service} · runtime ${runtime.label}`);
  console.log(`  alert: ${incident.value.alert}`);

  const run = await investigate(incident.value, {
    query: runtime.query,
    model: runtime.model,
    modelLabel: runtime.label,
    telemetry: telemetry.value,
    lessons: lessonsStore(),
    proposeLessons: !values["dry-run"],
    onMessage: printMessage,
    ...(maxTurns !== undefined ? { maxTurns } : {}),
    ...(values["max-budget-usd"] ? { maxBudgetUsd: Number(values["max-budget-usd"]) } : {}),
  });
  console.log(`loop: ${run.turns ?? "?"} turn(s) used · maxTurns ${run.maxTurns}`);

  console.log("\n── trace (what the agent looked at) ──");
  run.trace.forEach((t, i) => console.log(`${i + 1}. ${t.tool} ${JSON.stringify(t.input ?? {})}\n   → ${t.output.slice(0, 160)}${t.output.length > 160 ? "…" : ""}`));

  if (!run.result.ok) {
    console.error(`\nFAIL contract\n  - ${run.result.errors.join("\n  - ")}`);
    console.error(`\nraw model text:\n${run.rawText}`);
    return 1;
  }

  const rec = run.result.value;
  // The oncall-kit diagnosis format, in-thread.
  console.log(`\n── diagnosis (#${rec.tag}) ──`);
  console.log(`What's happening:        ${rec.hypothesis}`);
  console.log(`Root cause (${rec.confidence}):`);
  rec.evidence.forEach((e) => console.log(`  - ${e.source}:${e.ref} — ${e.note}`));
  console.log(`Blast radius:            ${rec.blast_radius}`);
  console.log(`Proposed fix:            ${rec.proposal} → ${rec.owner}; watch ${rec.watch_metric} afterwards`);
  console.log(`Ruled out:               ${rec.ruled_out.length > 0 ? rec.ruled_out.join(" | ") : "(nothing)"}`);
  console.log(`Would change my mind:    ${rec.would_change_my_mind}`);
  console.log(`Severity:                ${rec.severity}${rec.severity === "page" ? "  ← would page the on-call" : "  ← waits for the morning log"}`);

  if (!values["dry-run"]) {
    const path = await writeApproval(approvalsDir, draftApproval(rec, new Date().toISOString()));
    console.log(`\napproval drafted → ${path} (pending; sign with: npm run approve -- ${inputPath} --by <name>)`);
  }

  if (values.out) {
    await mkdir(dirname(values.out), { recursive: true });
    await writeFile(values.out, `${JSON.stringify(rec, null, 2)}\n`, "utf8");
    console.log(`\nsaved ${values.out}`);
  }
  if (run.lessonFile) console.log(`lesson proposed → ${run.lessonFile} (review, then move into lessons/lessons.md)`);
  if (run.costUsd) console.log(`estimated cost: $${run.costUsd.toFixed(4)}`);
  console.log("\nPASS contract · OPEN: a human decides. Nothing was rolled back, scaled or paged.");
  return 0;
};

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
