/**
 * agent.ts — the investigation loop on the Claude Agent SDK
 * ---------------------------------------------------------------------------
 * systemPrompt · prompt · MCP tools · lessons.md · maxTurns · a trace of
 * every tool call, so the human can see WHAT the agent looked at before
 * reading what it concluded.
 */
import { VERDICT_SCHEMA, fail, ok, type Incident, type Recommendation, type Result } from "./contract.js";
import { guessTag, loadLessons, promotionCandidates, proposeLesson, renderLessons, type LessonsStore } from "./lessons.js";
import { ONCALL_SYSTEM, buildIncidentPrompt } from "./prompts.js";
import { parseJson, routeVerdict, validateVerdict } from "./router.js";
import type { AgentEvent, ContentBlock, QueryFn } from "./runtime.js";
import { ALLOWED_TOOLS, SDK_INTERNAL_TOOLS, SERVER_NAME, createTelemetryServer } from "./tools.js";
import { deployBehind, summarizeMetrics, type Telemetry } from "./telemetry.js";

export interface AgentDeps {
  readonly query: QueryFn;
  readonly model: string | undefined;
  readonly modelLabel: string;
  readonly telemetry: Telemetry;
  readonly lessons: LessonsStore;
  readonly now?: () => Date;
  /** false → do not write a lessons proposal (dry run). */
  readonly proposeLessons?: boolean;
  readonly onMessage?: (message: AgentEvent) => void;
  readonly onLessons?: (rendered: string, candidates: ReturnType<typeof promotionCandidates>) => void;
  readonly maxTurns?: number;
  readonly maxBudgetUsd?: number;
}

export interface ToolTraceEntry {
  readonly tool: string;
  readonly input: unknown;
  readonly output: string;
}

export interface AgentRun {
  readonly model: string;
  readonly trace: readonly ToolTraceEntry[];
  readonly rawText: string;
  readonly costUsd?: number;
  readonly turns?: number;
  readonly durationMs?: number;
  readonly maxTurns: number;
  readonly result: Result<Recommendation>;
  readonly lessonFile?: string;
}

/**
 * THE LOOP BUDGET. Four tool calls + one structured answer is the normal
 * path; a real model that re-queries logs twice still fits in 10.
 */
export const DEFAULT_MAX_TURNS = 10;

export const describeStop = (subtype: string, turns: number | undefined, maxTurns: number): string =>
  subtype === "error_max_turns"
    ? `stopped after ${turns ?? "?"} turn(s): maxTurns (${maxTurns}) reached before a verdict — raise --max-turns or narrow the window`
    : subtype === "error_max_budget_usd"
      ? "stopped: maxBudgetUsd reached before a verdict"
      : `agent run did not succeed: ${subtype}`;

// ── Trace (pure) ─────────────────────────────────────────────────────────
const blocks = (content: string | readonly ContentBlock[]): readonly ContentBlock[] =>
  typeof content === "string" ? [] : content;

const textOf = (content: unknown): string =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.flatMap((c: ContentBlock) => (c.type === "text" && c.text ? [c.text] : [])).join("\n")
      : "";

/** `mcp__telemetry__search_logs` → `search_logs`. */
const shortName = (name: string): string => name.replace(new RegExp(`^mcp__${SERVER_NAME}__`), "");

export const extractTrace = (events: readonly AgentEvent[]): ToolTraceEntry[] => {
  const top = events.filter(
    (e): e is Extract<AgentEvent, { type: "assistant" | "user" }> =>
      (e.type === "assistant" || e.type === "user") && e.parent_tool_use_id === null,
  );
  const calls = new Map(
    top
      .flatMap((e) => (e.type === "assistant" ? blocks(e.message.content) : []))
      .filter((b) => b.type === "tool_use" && b.id !== undefined && !SDK_INTERNAL_TOOLS.has(b.name ?? ""))
      .map((b) => [b.id as string, { tool: shortName(b.name ?? "(unknown)"), input: b.input }] as const),
  );
  return top
    .flatMap((e) => (e.type === "user" ? blocks(e.message.content) : []))
    .filter((b) => b.type === "tool_result" && b.tool_use_id !== undefined && calls.has(b.tool_use_id))
    .map((b) => {
      const call = calls.get(b.tool_use_id as string) as { tool: string; input: unknown };
      return { tool: call.tool, input: call.input, output: textOf(b.content) };
    });
};

/**
 * Investigation rule: a verdict without evidence from the tools is a guess.
 * The agent must have called metrics AND deploys at least once; every
 * evidence `source` it cites (other than lessons) must appear in the trace.
 */
export const checkTrace = (trace: readonly ToolTraceEntry[], cited: readonly string[]): string[] => {
  const called = new Set(trace.map((t) => t.tool));
  const bySource: Record<string, string> = { metrics: "summarize_metrics", deploys: "list_deploys", logs: "search_logs", diff: "get_diff" };
  return [
    ...(["summarize_metrics", "list_deploys"] as const)
      .filter((t) => !called.has(t))
      .map((t) => `tool "${t}" was never called — the method requires it`),
    ...cited
      .filter((s) => s in bySource && !called.has(bySource[s] as string))
      .map((s) => `evidence cites "${s}" but ${bySource[s]} was never called`),
  ];
};

const collect = async (
  stream: AsyncIterable<AgentEvent>,
  onMessage: (message: AgentEvent) => void = () => undefined,
): Promise<AgentEvent[]> => {
  const events: AgentEvent[] = [];
  for await (const message of stream) {
    events.push(message);
    onMessage(message);
  }
  return events;
};

export const investigate = async (incident: Incident, deps: AgentDeps): Promise<AgentRun> => {
  const now = deps.now ?? (() => new Date());
  const maxTurns = deps.maxTurns ?? DEFAULT_MAX_TURNS;

  // Memory (read): lessons a human reviewed — only the matching class, never the whole file.
  const lessons = await loadLessons(deps.lessons);
  const since = new Date(Date.parse(incident.fired_at) - 60 * 60_000).toISOString();
  const breakpoint = summarizeMetrics(deps.telemetry, since, incident.fired_at).breakpoints[0];
  const tag = breakpoint && deployBehind(deps.telemetry, breakpoint.ts) ? "bad-deploy" : guessTag(incident.alert);
  const renderedLessons = renderLessons(lessons, tag);
  deps.onLessons?.(renderedLessons, promotionCandidates(lessons));

  const events = await collect(
    deps.query({
      prompt: `${buildIncidentPrompt(incident)}\n\n${renderedLessons}`,
      options: {
        systemPrompt: ONCALL_SYSTEM,
        mcpServers: { [SERVER_NAME]: createTelemetryServer(deps.telemetry) },
        tools: [...ALLOWED_TOOLS],
        allowedTools: [...ALLOWED_TOOLS],
        outputFormat: { type: "json_schema", schema: VERDICT_SCHEMA },
        permissionMode: "dontAsk", // anything not allowed above is denied
        settingSources: [], // reproducible: ignore local Claude Code settings
        maxTurns,
        ...(deps.maxBudgetUsd ? { maxBudgetUsd: deps.maxBudgetUsd } : {}),
        ...(deps.model ? { model: deps.model } : {}),
      },
    }),
    deps.onMessage,
  );

  const final = events.find((e) => e.type === "result");
  const trace = extractTrace(events);
  const rawText =
    final?.type === "result"
      ? final.structured_output !== undefined
        ? JSON.stringify(final.structured_output)
        : (final.result ?? "")
      : "";
  const base = {
    model: deps.modelLabel,
    trace,
    rawText,
    maxTurns,
    ...(final?.type === "result" && final.num_turns !== undefined ? { turns: final.num_turns } : {}),
    ...(final?.type === "result" && final.total_cost_usd !== undefined ? { costUsd: final.total_cost_usd } : {}),
    ...(final?.type === "result" && final.duration_ms !== undefined ? { durationMs: final.duration_ms } : {}),
  } as const;

  if (final?.type !== "result" || final.subtype !== "success") {
    return { ...base, result: fail([describeStop(final?.type === "result" ? final.subtype : "no result", base.turns, maxTurns)]) };
  }

  const json = parseJson(rawText);
  if (!json.ok) return { ...base, result: json };

  const verdict = validateVerdict(incident, json.value);
  if (!verdict.ok) return { ...base, result: verdict };

  const traceErrors = checkTrace(trace, verdict.value.evidence.map((e) => e.source));
  if (traceErrors.length > 0) return { ...base, result: fail(traceErrors) };

  const rec = routeVerdict(verdict.value);

  // Memory (write): a PROPOSAL for lessons.md, never a direct append.
  const lessonFile =
    deps.proposeLessons === false
      ? undefined
      : await proposeLesson(deps.lessons, rec, { at: now().toISOString(), model: deps.modelLabel });

  return { ...base, result: ok(rec), ...(lessonFile ? { lessonFile } : {}) };
};
