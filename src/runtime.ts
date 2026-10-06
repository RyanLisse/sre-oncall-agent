/**
 * runtime.ts — real Claude Agent SDK or the offline scripted investigator
 * ---------------------------------------------------------------------------
 * AGENT_MODEL=offline (default, no key) or a real model name.
 *
 * The offline fake runs four tools against the same fixture in prompt order.
 * It asks get_diff after deploys; a diff is returned only when one lines up
 * with a breakpoint. It derives a verdict with a fixed rule. Its output
 * demonstrates the pipeline, never model evidence.
 */
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type { Incident, Verdict } from "./contract.js";
import { handlers, qualified, type ToolName } from "./tools.js";
import { bucketMs, deployBehind, getDiff, previousVersion, type Telemetry } from "./telemetry.js";

// ── Port: the slice of SDK messages the agent reads ──────────────────────
export interface ContentBlock {
  readonly type: string;
  readonly id?: string;
  readonly name?: string;
  readonly input?: unknown;
  readonly text?: string;
  readonly tool_use_id?: string;
  readonly content?: unknown;
}

export type AgentEvent =
  | {
      readonly type: "assistant";
      readonly parent_tool_use_id: string | null;
      readonly message: { readonly content: readonly ContentBlock[] };
    }
  | {
      readonly type: "user";
      readonly parent_tool_use_id: string | null;
      readonly message: { readonly content: string | readonly ContentBlock[] };
    }
  | {
      readonly type: "result";
      readonly subtype: string;
      readonly result?: string;
      readonly structured_output?: unknown;
      readonly total_cost_usd?: number;
      readonly num_turns?: number;
      readonly duration_ms?: number;
    }
  | { readonly type: "system" | "other"; readonly subtype?: string };

export interface QueryArgs {
  readonly prompt: string;
  readonly options: Options;
}

/** The port. Real SDK and offline fake both satisfy it. */
export type QueryFn = (args: QueryArgs) => AsyncIterable<AgentEvent>;

// ── Adapter 1: the real Claude Agent SDK ─────────────────────────────────
const KNOWN = new Set(["assistant", "user", "result", "system"]);

export const sdkQuery: QueryFn = async function* ({ prompt, options }) {
  let sawResult = false;
  try {
    for await (const message of query({ prompt, options })) {
      sawResult ||= message.type === "result";
      yield (KNOWN.has(message.type) ? message : { type: "other" }) as AgentEvent;
    }
  } catch (error) {
    if (!sawResult) throw error;
  }
};

// ── Adapter 2: offline scripted investigator ─────────────────────────────
const extractIncident = (text: string): Partial<Incident> => {
  const match = /<incident>\s*([\s\S]*?)\s*<\/incident>/.exec(text);
  try {
    return match?.[1] ? (JSON.parse(match[1]) as Partial<Incident>) : {};
  } catch {
    return {};
  }
};

const minus = (iso: string, minutes: number): string =>
  new Date(Date.parse(iso) - minutes * 60_000).toISOString();

const bucketLabel = (ms: number): string => {
  if (ms % 60_000 === 0) return `${ms / 60_000}-minute`;
  const seconds = ms / 1000;
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}-second`;
};

const gapLabel = (ms: number): string => {
  const minutes = ms / 60_000;
  if (minutes >= 1) {
    const rounded = Math.round(minutes * 10) / 10;
    return `${rounded} ${rounded === 1 ? "minute" : "minutes"}`;
  }
  const seconds = ms / 1000;
  const rounded = Math.round(seconds * 10) / 10;
  return `${rounded} ${rounded === 1 ? "second" : "seconds"}`;
};

const deployTiming = (t: Telemetry, bpTs: string, deployAt: string): string => {
  const start = Date.parse(bpTs);
  const at = Date.parse(deployAt);
  const width = bucketMs(t);
  return at >= start && at < start + width
    ? `in the same ${bucketLabel(width)} window as`
    : `${gapLabel(start - at)} after`;
};

/**
 * The fixed offline rule — simple on purpose:
 *   breakpoint AND a deploy ≤15 min before it          → rollback (high)
 *   breakpoint, no deploy, p95 doubled                 → scale (medium)
 *   breakpoint, no deploy, errors only                 → investigate-more (low)
 *   no breakpoint                                      → no-action (morning-log)
 */
export const offlineVerdict = (incident: Incident, t: Telemetry): Verdict => {
  const h = handlers(t);
  const since = minus(incident.fired_at, 60);
  const metrics = h.summarize_metrics({ since, until: incident.fired_at });
  const deploys = h.list_deploys({ since, until: incident.fired_at });
  const bp = metrics.breakpoints[0];
  const gaps = [
    ...(metrics.points === 0 ? ["summarize_metrics: no metric points in the window"] : []),
    ...(deploys.length === 0 ? ["list_deploys: no deploys in the window"] : []),
  ];
  const base = { incident_id: incident.incident_id, draft_only: true as const, human_approval_required: true as const };

  const stillPresent = metrics.breakpoints.length > 0 && (metrics.error_rate_last >= 0.01 || metrics.p95_ms_last >= 1000);

  if (!bp) {
    return {
      ...base,
      tag: "noise",
      severity: "morning-log",
      confidence: "medium",
      hypothesis: "No breakpoint in error_rate or p95 in the hour before the alert. The alert may be a threshold too tight for this traffic pattern.",
      evidence: [{ source: "metrics", ref: metrics.last_ts ?? "window", note: `error_rate_max ${metrics.error_rate_max}, p95_max ${metrics.p95_ms_max} ms, no ≥2× jump` }],
      blast_radius: "none observed — no customer-facing metric moved",
      proposal: "no-action",
      ruled_out: [`bad deploy: ${deploys.length} deploy(s) in window, none followed by a breakpoint`],
      would_change_my_mind: "a ≥2× jump in error_rate or p95 inside the window",
      data_gaps: gaps,
      watch_metric: "error_rate",
    };
  }

  const deploy = deployBehind(t, bp.ts);
  const logs = h.search_logs({ level: "error", since: minus(bp.ts, 2), until: incident.fired_at, limit: 3 });
  if (logs.length === 0) gaps.push("search_logs: no error lines within 2 min of the breakpoint");
  const logEvidence = logs.slice(0, 1).map((l) => ({ source: "logs" as const, ref: l.ts, note: l.msg }));
  const paging = metrics.error_rate_last > 0.02 || metrics.p95_ms_last > 2000;

  if (deploy) {
    const prev = previousVersion(t, deploy);
    const diff = getDiff(t, deploy.id);
    const diffEvidence = "diff" in diff
      ? [{ source: "diff" as const, ref: deploy.id, note: `changed: ${diff.diff.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++")).slice(0, 2).map((l) => l.slice(1).trim()).join(" | ").slice(0, 140)}` }]
      : [];
    return {
      ...base,
      tag: "bad-deploy",
      severity: paging ? "page" : "morning-log",
      confidence: stillPresent ? "high" : "medium",
      hypothesis: `${bp.what} jumped from ${bp.from} to ${bp.to} at ${bp.ts}, ${deployTiming(t, bp.ts, deploy.at)} deploy ${deploy.id} (${deploy.version}). Nothing else changed in the window. Rolling back to ${prev ?? "the previous version"} should restore the baseline.`,
      evidence: [
        { source: "metrics", ref: bp.ts, note: `${bp.what} ${bp.from} → ${bp.to} on ${bp.version}` },
        { source: "deploys", ref: deploy.id, note: `${deploy.version} at ${deploy.at}: ${deploy.summary}` },
        ...diffEvidence,
        ...logEvidence,
      ],
      blast_radius: `all ${t.service} traffic on ${deploy.version}; error_rate now ${metrics.error_rate_last}`,
      proposal: "rollback",
      ruled_out: [
        "load/dependency: p95 did not move independently of the deploy",
        ...(stillPresent ? [] : ["NOTE: symptom not present in latest point — the deploy explains the start, maybe not the current state"]),
      ],
      would_change_my_mind: `a breakpoint BEFORE ${deploy.at}, or the same errors on ${prev ?? "the previous version"}`,
      data_gaps: gaps,
      watch_metric: bp.what,
    };
  }

  if (bp.what === "p95_ms") {
    return {
      ...base,
      tag: "latency",
      severity: paging ? "page" : "morning-log",
      confidence: "medium",
      hypothesis: `p95 doubled at ${bp.ts} with no deploy in the window. Latency without errors or a change points at load or a dependency.`,
      evidence: [{ source: "metrics", ref: bp.ts, note: `p95 ${bp.from} → ${bp.to} ms` }, ...logEvidence],
      blast_radius: `every ${t.service} request slower; nothing failing (error_rate ${metrics.error_rate_last})`,
      proposal: logEvidence.length > 0 ? "scale" : "investigate-more",
      ruled_out: [`bad deploy: no deploy within 15 min before ${bp.ts}`],
      would_change_my_mind: "a deploy or config change in the window, or latency confined to one endpoint",
      data_gaps: gaps,
      watch_metric: "p95_ms",
    };
  }

  return {
    ...base,
    tag: "errors",
    severity: paging ? "page" : "morning-log",
    confidence: "low",
    hypothesis: `error_rate jumped at ${bp.ts} with no deploy in the window. Cause not yet found.`,
    evidence: [{ source: "metrics", ref: bp.ts, note: `error_rate ${bp.from} → ${bp.to}` }, ...logEvidence],
    blast_radius: `error_rate ${metrics.error_rate_last} on ${t.service}; cause unknown`,
    proposal: "investigate-more",
    ruled_out: [`bad deploy: no deploy within 15 min before ${bp.ts}`, "latency: p95 flat"],
    would_change_my_mind: "an error log line naming the failing dependency or endpoint",
    data_gaps: gaps,
    watch_metric: "error_rate",
  };
};

type HandlerInputs = {
  [Name in ToolName]: Parameters<ReturnType<typeof handlers>[Name]>[0];
};

type OfflineInputs = Record<ToolName, unknown> &
  Omit<HandlerInputs, "get_diff"> & {
    get_diff: HandlerInputs["get_diff"] | { deploy?: never };
  };

/** Replays the system prompt's method as tool events, then emits the verdict. */
export const offlineQuery =
  (t: Telemetry): QueryFn =>
  async function* ({ prompt, options }) {
    yield { type: "system", subtype: "init" };
    const incident = extractIncident(prompt);
    const maxTurns = options.maxTurns ?? Number.POSITIVE_INFINITY;
    // The offline method takes 4 tool turns + 1 answer turn.
    const steps: readonly ToolName[] = ["summarize_metrics", "list_deploys", "get_diff", "search_logs"];
    if (maxTurns < steps.length + 1) {
      yield { type: "result", subtype: "error_max_turns", num_turns: Math.min(maxTurns, steps.length), total_cost_usd: 0 };
      return;
    }
    const h = handlers(t);
    const since = incident.fired_at ? minus(incident.fired_at, 60) : undefined;
    const inputs: OfflineInputs = {
      summarize_metrics: { since, until: incident.fired_at },
      list_deploys: { since, until: incident.fired_at },
      get_diff: {},
      search_logs: { level: "error", since, until: incident.fired_at, limit: 5 },
    };
    const metrics = h.summarize_metrics(inputs.summarize_metrics);
    const bp0 = metrics.breakpoints[0];
    const behind = bp0 ? deployBehind(t, bp0.ts) : undefined;
    if (behind) inputs.get_diff = { deploy: behind.id };
    const outputs: Record<ToolName, unknown> = {
      summarize_metrics: metrics,
      list_deploys: h.list_deploys(inputs.list_deploys),
      get_diff:
        inputs.get_diff.deploy === undefined
          ? { error: "no deploy lines up with the breakpoint — not called in anger" }
          : h.get_diff(inputs.get_diff),
      search_logs: h.search_logs(inputs.search_logs),
    };
    for (const name of steps) {
      yield {
        type: "assistant",
        parent_tool_use_id: null,
        message: { content: [{ type: "tool_use", id: `offline-${name}`, name: qualified(name), input: inputs[name] }] },
      };
      yield {
        type: "user",
        parent_tool_use_id: null,
        message: {
          content: [{ type: "tool_result", tool_use_id: `offline-${name}`, content: [{ type: "text", text: JSON.stringify(outputs[name]) }] }],
        },
      };
    }
    const full: Incident = {
      incident_id: incident.incident_id ?? "OPEN",
      service: incident.service ?? t.service,
      alert: incident.alert ?? "",
      fired_at: incident.fired_at ?? new Date(0).toISOString(),
    };
    yield {
      type: "result",
      subtype: "success",
      total_cost_usd: 0,
      num_turns: steps.length + 1,
      duration_ms: 0,
      structured_output: offlineVerdict(full, t),
    };
  };

export const OFFLINE = "offline";

export interface Runtime {
  readonly query: QueryFn;
  readonly model: string | undefined;
  readonly label: string;
}

export const resolveRuntime = (t: Telemetry, name: string = process.env.AGENT_MODEL ?? OFFLINE): Runtime =>
  name === OFFLINE
    ? { query: offlineQuery(t), model: undefined, label: "offline (scripted, not model evidence)" }
    : { query: sdkQuery, model: name, label: `claude-agent-sdk/${name}` };
