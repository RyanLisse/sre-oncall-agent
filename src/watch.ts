/**
 * watch.ts — "watch it land", bounded
 * ---------------------------------------------------------------------------
 * After a human applies a fix, the agent confirms the metric returned to
 * baseline — or says that it did not. No model: arithmetic over the metric
 * stream, deterministic.
 *
 * oncall-kit triage rule 9: three checks, not a polling loop — at half the
 * expected-resolution window, at full, at double. Verify through the same
 * door the failure came in: the exact metric that detected the incident.
 *
 * Baseline = median of the metric BEFORE THE FIRST BREAKPOINT preceding the
 * incident (not before the alert — alerts fire minutes after the regression
 * starts, and a baseline that includes the regression is not a baseline).
 * Landed = the point at (or just before) the check time is within tolerance.
 */
import { summarizeMetrics, type MetricPoint, type Telemetry } from "./telemetry.js";

export type WatchMetric = "error_rate" | "p95_ms";

export interface Check {
  readonly label: "half" | "full" | "double";
  readonly at: string;
  readonly value: number | undefined;
  readonly ok: boolean;
}

export interface WatchReport {
  readonly metric: WatchMetric;
  readonly baseline: number;
  readonly limit: number;
  readonly checks: readonly Check[];
  /** Landed = the FULL check and the DOUBLE check are both at baseline. */
  readonly landed: boolean;
  readonly message: string;
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length === 0 ? 0 : s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

const pick = (p: MetricPoint, m: WatchMetric): number => (m === "error_rate" ? p.error_rate : p.p95_ms);

const plusMin = (iso: string, minutes: number): string => new Date(Date.parse(iso) + minutes * 60_000).toISOString();

/** Newest point at or before `at`. Pure. */
const pointAt = (t: Telemetry, at: string): MetricPoint | undefined =>
  [...t.metrics].filter((p) => p.ts <= at).sort((a, b) => (a.ts < b.ts ? 1 : -1))[0];

/**
 * @param incidentStart  ISO time the incident began — defines the baseline window.
 * @param fixAt          ISO time the human applied the fix.
 * @param windowMin      expected-resolution window in minutes (default 4).
 */
export const watchMetric = (
  t: Telemetry,
  metric: WatchMetric,
  incidentStart: string,
  fixAt: string,
  windowMin = 4,
): WatchReport => {
  const since = new Date(Date.parse(incidentStart) - 60 * 60_000).toISOString();
  const bp = summarizeMetrics(t, since, incidentStart).breakpoints[0];
  const cutoff = bp?.ts ?? incidentStart;
  const pre = t.metrics.filter((p) => p.ts < cutoff).map((p) => pick(p, metric));
  const baseline = median(pre);
  const floor = metric === "error_rate" ? 0.005 : 50;
  const limit = Math.max(baseline * 1.5, baseline + floor);

  const checks: Check[] = (
    [
      ["half", windowMin / 2],
      ["full", windowMin],
      ["double", windowMin * 2],
    ] as const
  ).map(([label, m]) => {
    const at = plusMin(fixAt, m);
    const p = pointAt(t, at);
    const value = p === undefined || p.ts < fixAt ? undefined : pick(p, metric);
    return { label, at, value, ok: value !== undefined && value <= limit };
  });

  const landed = checks.filter((c) => c.label !== "half").every((c) => c.ok);
  const line = checks.map((c) => `${c.label}@${c.at.slice(11, 16)}=${c.value ?? "no data"}${c.ok ? "✓" : "✗"}`).join("  ");
  return {
    metric,
    baseline,
    limit,
    checks,
    landed,
    message: landed
      ? `LANDED: ${metric} back at baseline ${baseline} (limit ${limit}) — ${line}`
      : `NOT LANDED: ${metric} baseline ${baseline} (limit ${limit}) — ${line}`,
  };
};
