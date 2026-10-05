/**
 * telemetry.ts — the fictional production system, as data
 * ---------------------------------------------------------------------------
 * Logs, metrics and deploy history for one service, loaded from a JSON
 * fixture. This stands in for your log store, metrics source and deploy
 * tracker. Swapping it for real backends changes THIS file only (the
 * oncall-kit calls that a "capability binding").
 *
 * Everything here is pure and read-only. There is no function that changes
 * the system — by design, not by omission.
 */
import { readFile } from "node:fs/promises";
import { fail, ok, type Result } from "./contract.js";

export interface LogLine {
  readonly ts: string;
  readonly level: "info" | "warn" | "error";
  readonly msg: string;
}

export interface MetricPoint {
  readonly ts: string;
  readonly error_rate: number; // 0..1
  readonly p95_ms: number;
  readonly version: string;
}

export interface Deploy {
  readonly id: string;
  readonly version: string;
  readonly at: string;
  readonly author: string;
  readonly summary: string;
}

export interface Telemetry {
  readonly service: string;
  readonly logs: readonly LogLine[];
  readonly metrics: readonly MetricPoint[];
  readonly deploys: readonly Deploy[];
}

const isArr = (v: unknown): v is readonly unknown[] => Array.isArray(v);

/** Minimal shape check — the fixture is ours, but malformed data is still rejected. */
export const parseTelemetry = (raw: unknown): Result<Telemetry> => {
  if (typeof raw !== "object" || raw === null) return fail(["telemetry: expected a JSON object"]);
  const t = raw as Record<string, unknown>;
  const errors = [
    ...(typeof t.service === "string" ? [] : ["telemetry.service: expected a string"]),
    ...(isArr(t.logs) ? [] : ["telemetry.logs: expected an array"]),
    ...(isArr(t.metrics) ? [] : ["telemetry.metrics: expected an array"]),
    ...(isArr(t.deploys) ? [] : ["telemetry.deploys: expected an array"]),
  ];
  return errors.length === 0 ? ok(raw as Telemetry) : fail(errors);
};

export const loadTelemetry = async (path: string): Promise<Result<Telemetry>> => {
  try {
    return parseTelemetry(JSON.parse(await readFile(path, "utf8")) as unknown);
  } catch (error) {
    return fail([`telemetry: ${(error as Error).message}`]);
  }
};

// ── Queries (pure) ────────────────────────────────────────────────────────
const inWindow = (ts: string, since: string | undefined, until: string | undefined): boolean =>
  (since === undefined || ts >= since) && (until === undefined || ts <= until);

export interface LogQuery {
  readonly pattern?: string | undefined;
  readonly level?: LogLine["level"] | undefined;
  readonly since?: string | undefined;
  readonly until?: string | undefined;
  readonly limit?: number | undefined;
}

/** `grep` over the log store. Case-insensitive substring; hard cap on results. */
export const searchLogs = (t: Telemetry, q: LogQuery): readonly LogLine[] => {
  const needle = q.pattern?.toLowerCase();
  return t.logs
    .filter((l) => inWindow(l.ts, q.since, q.until))
    .filter((l) => q.level === undefined || l.level === q.level)
    .filter((l) => needle === undefined || l.msg.toLowerCase().includes(needle))
    .slice(0, Math.min(q.limit ?? 20, 50));
};

export interface MetricSummary {
  readonly points: number;
  readonly first_ts: string | undefined;
  readonly last_ts: string | undefined;
  readonly error_rate_max: number;
  readonly error_rate_last: number;
  readonly p95_ms_max: number;
  readonly p95_ms_last: number;
  readonly versions: readonly string[];
  /** Points where error_rate or p95 jumped ≥2× vs the previous point. */
  readonly breakpoints: readonly { ts: string; what: string; from: number; to: number; version: string }[];
}

/** Summarise a metric window and name the breakpoints. Pure. */
export const summarizeMetrics = (t: Telemetry, since?: string, until?: string): MetricSummary => {
  const pts = t.metrics.filter((m) => inWindow(m.ts, since, until));
  const breakpoints = pts.flatMap((m, i) => {
    const prev = pts[i - 1];
    if (!prev) return [];
    const out: { ts: string; what: string; from: number; to: number; version: string }[] = [];
    if (m.error_rate >= Math.max(0.01, prev.error_rate * 2))
      out.push({ ts: m.ts, what: "error_rate", from: prev.error_rate, to: m.error_rate, version: m.version });
    if (m.p95_ms >= prev.p95_ms * 2)
      out.push({ ts: m.ts, what: "p95_ms", from: prev.p95_ms, to: m.p95_ms, version: m.version });
    return out;
  });
  const last = pts[pts.length - 1];
  return {
    points: pts.length,
    first_ts: pts[0]?.ts,
    last_ts: last?.ts,
    error_rate_max: Math.max(0, ...pts.map((p) => p.error_rate)),
    error_rate_last: last?.error_rate ?? 0,
    p95_ms_max: Math.max(0, ...pts.map((p) => p.p95_ms)),
    p95_ms_last: last?.p95_ms ?? 0,
    versions: [...new Set(pts.map((p) => p.version))],
    breakpoints,
  };
};

/** Deploys in a window, newest first. */
export const listDeploys = (t: Telemetry, since?: string, until?: string): readonly Deploy[] =>
  [...t.deploys].filter((d) => inWindow(d.at, since, until)).sort((a, b) => (a.at < b.at ? 1 : -1));

/** The version that was live just before `deploy`, if any. Pure. */
export const previousVersion = (t: Telemetry, deploy: Deploy): string | undefined =>
  [...t.deploys]
    .filter((d) => d.at < deploy.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.version;
