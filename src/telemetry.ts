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
  /** EXT: trace id of the request that wrote the line, when the source records one. */
  readonly trace_id?: string;
}

export interface MetricPoint {
  readonly ts: string;
  readonly error_rate: number; // 0..1
  readonly p95_ms: number;
  readonly version: string;
  /** Requests in the bucket. Optional for hand-written fixtures; live telemetry sets it. */
  readonly n?: number;
  /** EXT: requests in the bucket with retry_attempt = 0. */
  readonly first_attempts?: number;
  /** EXT: requests in the bucket with retry_attempt >= 1. */
  readonly retries?: number;
  /** EXT: price-cache hit ratio in the bucket, 0..1. */
  readonly cache_hit_ratio?: number;
}

/**
 * Breakpoint thresholds. A "≥2× jump" on three requests is noise, so a point
 * only counts when (a) the bucket has enough samples, (b) the jump is ≥2× AND
 * (c) clears an absolute floor. The floor is what stops a 0.3% → 0.7% wobble
 * from being called an incident.
 */
export const BREAK = { minSamples: 20, errorRateFloor: 0.02, p95Floor: 1000 } as const;

export interface Deploy {
  readonly id: string;
  readonly version: string;
  readonly at: string;
  readonly author: string;
  readonly summary: string;
  /** Unified diff of the change, when the code host exposes it. */
  readonly diff?: string;
}

/** EXT: any change to the system, not only deploys (config pushes, flags, cron, load tests). */
export interface Change {
  readonly id: string;
  readonly kind: "deploy" | "config" | "flag" | "cron" | "loadtest";
  readonly at: string;
  /** End of a change that spans time (a load test). */
  readonly until?: string;
  readonly actor: string;
  readonly summary: string;
  readonly target: string;
  readonly ref?: string;
}

/** EXT: one hop of a traced request. */
export interface Span {
  readonly name: string;
  readonly ms: number;
  readonly status: "ok" | "miss" | "timeout" | "error" | "skipped";
  readonly attrs?: Readonly<Record<string, string | number>>;
}

/** EXT: one traced request, spans in call order. */
export interface Trace {
  readonly trace_id: string;
  readonly at: string;
  readonly status: number;
  readonly order_ref: string;
  readonly retry_attempt: number;
  readonly version: string;
  readonly spans: readonly Span[];
}

export interface Telemetry {
  readonly service: string;
  readonly logs: readonly LogLine[];
  readonly metrics: readonly MetricPoint[];
  readonly deploys: readonly Deploy[];
  /** EXT: every change, a superset view of `deploys`. Optional. */
  readonly changes?: readonly Change[];
  /** EXT: sampled request traces. Optional. */
  readonly traces?: readonly Trace[];
  /** EXT: fixture scenario name (e.g. "correlation-trap"). Optional. */
  readonly scenario?: string;
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
    // EXT: optional, but when present they must be arrays
    ...(t.changes === undefined || isArr(t.changes) ? [] : ["telemetry.changes: expected an array when present"]),
    ...(t.traces === undefined || isArr(t.traces) ? [] : ["telemetry.traces: expected an array when present"]),
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
  readonly breakpoints: readonly Breakpoint[];
  /** EXT: window means, only when the points carry the optional fields. */
  readonly first_attempts_mean?: number;
  readonly retries_mean?: number;
  readonly cache_hit_ratio_mean?: number;
  /** EXT: only with a group_by argument. */
  readonly groups?: MetricGroups;
}

export interface Breakpoint {
  readonly ts: string;
  readonly what: string;
  readonly from: number;
  readonly to: number;
  readonly version: string;
  /** EXT: copied from the point when present. */
  readonly first_attempts?: number;
  readonly retries?: number;
  readonly cache_hit_ratio?: number;
}

export type GroupBy = "retry" | "version";

/** EXT: a metric window split by retry attempt or by version. */
export type MetricGroups =
  | {
      readonly by: "retry";
      readonly first_attempts: number;
      readonly retries: number;
      /** Per point, so the moment the retries start is visible. */
      readonly series: readonly { ts: string; first_attempts: number; retries: number; error_rate: number }[];
    }
  | {
      readonly by: "version";
      readonly versions: readonly { version: string; points: number; first_ts: string; last_ts: string; error_rate_mean: number; p95_ms_max: number }[];
    };

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : Number((xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(4)));
const defined = <T>(xs: readonly (T | undefined)[]): T[] => xs.filter((x): x is T => x !== undefined);

/** EXT: the optional per-point fields, only those present. */
const extFields = (m: MetricPoint) => ({
  ...(m.first_attempts !== undefined ? { first_attempts: m.first_attempts } : {}),
  ...(m.retries !== undefined ? { retries: m.retries } : {}),
  ...(m.cache_hit_ratio !== undefined ? { cache_hit_ratio: m.cache_hit_ratio } : {}),
});

const groupMetrics = (pts: readonly MetricPoint[], by: GroupBy): MetricGroups => {
  if (by === "retry") {
    const series = pts.map((p) => ({ ts: p.ts, first_attempts: p.first_attempts ?? p.n ?? 0, retries: p.retries ?? 0, error_rate: p.error_rate }));
    return {
      by,
      first_attempts: series.reduce((a, p) => a + p.first_attempts, 0),
      retries: series.reduce((a, p) => a + p.retries, 0),
      series,
    };
  }
  const versions = [...new Set(pts.map((p) => p.version))].map((version) => {
    const vp = pts.filter((p) => p.version === version);
    return {
      version,
      points: vp.length,
      first_ts: vp[0]?.ts ?? "",
      last_ts: vp[vp.length - 1]?.ts ?? "",
      error_rate_mean: mean(vp.map((p) => p.error_rate)),
      p95_ms_max: Math.max(0, ...vp.map((p) => p.p95_ms)),
    };
  });
  return { by, versions };
};

/** Summarise a metric window and name the breakpoints. Pure. */
export const summarizeMetrics = (t: Telemetry, since?: string, until?: string, groupBy?: GroupBy): MetricSummary => {
  const pts = t.metrics.filter((m) => inWindow(m.ts, since, until));
  const breakpoints = pts.flatMap((m, i) => {
    const prev = pts[i - 1];
    if (!prev) return [];
    const out: Breakpoint[] = [];
    if ((m.n ?? Infinity) < BREAK.minSamples) return [];
    if (m.error_rate >= Math.max(BREAK.errorRateFloor, prev.error_rate * 2))
      out.push({ ts: m.ts, what: "error_rate", from: prev.error_rate, to: m.error_rate, version: m.version, ...extFields(m) });
    if (m.p95_ms >= Math.max(BREAK.p95Floor, prev.p95_ms * 2))
      out.push({ ts: m.ts, what: "p95_ms", from: prev.p95_ms, to: m.p95_ms, version: m.version, ...extFields(m) });
    return out;
  });
  const last = pts[pts.length - 1];
  const fa = defined(pts.map((p) => p.first_attempts));
  const re = defined(pts.map((p) => p.retries));
  const ch = defined(pts.map((p) => p.cache_hit_ratio));
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
    ...(fa.length > 0 ? { first_attempts_mean: mean(fa) } : {}),
    ...(re.length > 0 ? { retries_mean: mean(re) } : {}),
    ...(ch.length > 0 ? { cache_hit_ratio_mean: mean(ch) } : {}),
    ...(groupBy !== undefined ? { groups: groupMetrics(pts, groupBy) } : {}),
  };
};

/** Bucket length in ms, inferred from the two closest metric points (fixtures: 60 s; live shop: 10 s). */
export const bucketMs = (t: Telemetry): number => {
  const ts = [...new Set(t.metrics.map((m) => Date.parse(m.ts)))].sort((a, b) => a - b);
  let min = Infinity;
  for (let i = 1; i < ts.length; i++) min = Math.min(min, (ts[i] as number) - (ts[i - 1] as number));
  return Number.isFinite(min) && min > 0 ? min : 60_000;
};

/**
 * The deploy that explains a breakpoint: landed within `lookbackMin` before the
 * breakpoint's bucket, up to the END of that bucket (a metric point stamped
 * 03:45:00 covers 03:45:00–03:45:59, so a deploy at 03:45:01 is inside it).
 */
export const deployBehind = (t: Telemetry, bpTs: string, lookbackMin = 15): Deploy | undefined => {
  const end = new Date(Date.parse(bpTs) + bucketMs(t)).toISOString();
  const start = new Date(Date.parse(bpTs) - lookbackMin * 60_000).toISOString();
  return listDeploys(t, start, end)[0]; // newest first → the closest deploy
};

/** The diff for a deploy id (or version). The agent reads the change, not just the record. */
export const getDiff = (t: Telemetry, idOrVersion: string): { id: string; version: string; diff: string } | { error: string } => {
  const d = t.deploys.find((x) => x.id === idOrVersion || x.version === idOrVersion);
  if (!d) return { error: `no deploy ${idOrVersion}` };
  if (!d.diff) return { error: `no diff recorded for ${d.id}` };
  return { id: d.id, version: d.version, diff: d.diff };
};

/** Deploys in a window, newest first — without the diff body (call get_diff for that). */
export const listDeploys = (t: Telemetry, since?: string, until?: string): readonly Deploy[] =>
  [...t.deploys]
    .filter((d) => inWindow(d.at, since, until))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map(({ diff: _diff, ...rest }) => ({ ...rest, ...(_diff ? { has_diff: true } : {}) }) as Deploy);

/** The version that was live just before `deploy`, if any. Pure. */
export const previousVersion = (t: Telemetry, deploy: Deploy): string | undefined =>
  [...t.deploys]
    .filter((d) => d.at < deploy.at)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0]?.version;

// ── EXT: changes and traces (pure, read-only) ─────────────────────────────
/**
 * Every change in a window: `t.changes`, plus each deploy in `t.deploys` as
 * kind "deploy" unless a change with the same id exists. Oldest first. A
 * change that spans time (a load test) counts when it overlaps the window.
 */
export const listChanges = (t: Telemetry, since?: string, until?: string): readonly Change[] => {
  const own = t.changes ?? [];
  const ids = new Set(own.map((c) => c.id));
  const fromDeploys: Change[] = t.deploys
    .filter((d) => !ids.has(d.id))
    .map((d) => ({ id: d.id, kind: "deploy", at: d.at, actor: d.author, summary: `${d.version}: ${d.summary}`, target: t.service, ref: d.version }));
  return [...own, ...fromDeploys]
    .filter((c) => (until === undefined || c.at <= until) && (since === undefined || (c.until ?? c.at) >= since))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
};

/** One trace by id, spans in call order. */
export const getTrace = (t: Telemetry, traceId: string): Trace | { error: string } => {
  if (!t.traces || t.traces.length === 0) return { error: "no traces recorded in this telemetry" };
  return t.traces.find((x) => x.trace_id === traceId) ?? { error: `no trace ${traceId}` };
};
