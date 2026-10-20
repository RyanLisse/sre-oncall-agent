/**
 * scripts/tool.ts — `npm run tool`: the agent's read-only tools, for humans
 * ---------------------------------------------------------------------------
 * Calls the SAME pure handlers the agent uses (src/tools.ts) and prints JSON
 * with a `reproduce` line. Reads fixtures only; changes nothing.
 *
 *   npm run tool -- alert   <incident>
 *   npm run tool -- changes <incident> [--window 15m] [--until <iso>]
 *   npm run tool -- metrics <incident> [--by retry|version] [--window 60m] [--until <iso>]
 *   npm run tool -- logs    <incident> [--pattern X] [--level error] [--window 60m] [--until <iso>]
 *   npm run tool -- trace   <incident> <trace_id>
 *
 * <incident>: trap · trap-after · inc-1001, or a path to an incident file.
 * The window ends at the alert's fired_at (trap-after: at the end of its
 * telemetry, so you see what happened after the alert), unless --until is set.
 */
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { handlers, withRepro, type ExtToolName, type ToolName } from "../src/tools.js";
import { loadTelemetry, type GroupBy, type Telemetry } from "../src/telemetry.js";

interface Alias { readonly incident: string; readonly telemetry?: string; readonly untilEnd?: boolean }
export const ALIASES: Readonly<Record<string, Alias>> = {
  trap: { incident: "fixtures/incidents/correlation-trap.json" },
  "trap-after": { incident: "fixtures/incidents/correlation-trap.json", telemetry: "fixtures/telemetry/correlation-trap-after.json", untilEnd: true },
  "inc-1001": { incident: "fixtures/incidents/bad-deploy.json" },
};

const USAGE = `usage: npm run tool -- <alert|changes|metrics|logs|trace> <incident> [options]
  incident: ${Object.keys(ALIASES).join(" | ")} | <path to incident file>
  changes  [--window 15m] [--until <iso>]
  metrics  [--by retry|version] [--window 60m] [--until <iso>]
  logs     [--pattern X] [--level info|warn|error] [--window 60m] [--until <iso>]
  trace    <trace_id>`;

/** "15m" / "2h" → minutes. */
export const parseWindow = (w: string | undefined, fallback: number): number | undefined => {
  if (w === undefined) return fallback;
  const m = /^(\d+)\s*(m|h)$/.exec(w.trim());
  return m ? Number(m[1]) * (m[2] === "h" ? 60 : 1) : undefined;
};

const minus = (iso: string, minutes: number): string => new Date(Date.parse(iso) - minutes * 60_000).toISOString();
const iso = (s: string): string => new Date(Date.parse(s)).toISOString();

/** Minimal reader for the flat `key: value` alert file (no YAML dependency). */
export const parseAlertFile = (text: string): Record<string, string | string[]> => {
  const out: Record<string, string | string[]> = {};
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\r$/, "");
    if (/^\s*(#|$)/.test(line)) continue;
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1] as string;
    const value = (m[2] as string).trim();
    out[key] = /^\[.*\]$/.test(value) ? value.slice(1, -1).split(",").map((x) => x.trim()).filter(Boolean) : value;
  }
  return out;
};

interface Loaded {
  readonly incident: { incident_id: string; service: string; alert: string; fired_at: string };
  readonly alertFile: string | undefined;
  readonly telemetry: Telemetry;
  readonly telemetryPath: string;
  readonly until: string;
}

const load = async (name: string, untilFlag: string | undefined): Promise<Loaded | string> => {
  const alias = ALIASES[name];
  const incidentPath = alias?.incident ?? name;
  let file: { incident?: Loaded["incident"]; telemetry?: string; alert_file?: string };
  try {
    file = JSON.parse(await readFile(incidentPath, "utf8")) as typeof file;
  } catch (error) {
    return `cannot read incident ${incidentPath}: ${(error as Error).message}`;
  }
  if (!file.incident || typeof file.telemetry !== "string") return `incident file ${incidentPath}: expected { incident, telemetry }`;
  const telemetryPath = alias?.telemetry ?? file.telemetry;
  const t = await loadTelemetry(telemetryPath);
  if (!t.ok) return `telemetry ${telemetryPath}: ${t.errors.join("; ")}`;
  if (untilFlag !== undefined && Number.isNaN(Date.parse(untilFlag))) return `--until must be an ISO-8601 time (got ${untilFlag})`;
  const end = t.value.metrics.map((m) => m.ts).sort().at(-1);
  const until = untilFlag !== undefined ? iso(untilFlag) : alias?.untilEnd && end ? end : iso(file.incident.fired_at);
  return { incident: file.incident, alertFile: file.alert_file, telemetry: t.value, telemetryPath, until };
};

const print = (name: ToolName | ExtToolName | "alert", args: unknown, result: unknown): void => {
  const out = name === "alert" ? { reproduce: `alert ${JSON.stringify(args)}`, result } : withRepro(name, args, result);
  console.log(JSON.stringify(out, null, 2));
};

export const main = async (argv: readonly string[]): Promise<number> => {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        window: { type: "string" },
        until: { type: "string" },
        by: { type: "string" },
        pattern: { type: "string" },
        level: { type: "string" },
        region: { type: "string" },
      },
    });
  } catch (error) {
    console.error(`${(error as Error).message}\n${USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  const [cmd, name, arg] = positionals;
  if (cmd === "topo") {
    console.error("topo is part of the ADVANCED tier and is not available in this build.");
    return 2;
  }
  if (!cmd || !name || !["alert", "changes", "metrics", "logs", "trace"].includes(cmd)) {
    console.error(USAGE);
    return 2;
  }
  const l = await load(name, values.until);
  if (typeof l === "string") {
    console.error(`FAIL ${l}`);
    return 1;
  }
  const h = handlers(l.telemetry);

  if (cmd === "alert") {
    if (!l.alertFile) {
      console.error(`FAIL ${name}: this incident has no alert_file`);
      return 1;
    }
    const rule = parseAlertFile(await readFile(l.alertFile, "utf8"));
    const forMin = parseWindow(typeof rule.for === "string" ? rule.for : undefined, 5) ?? 5;
    print("alert", { file: l.alertFile }, {
      ...rule,
      incident_id: l.incident.incident_id,
      alert_text: l.incident.alert,
      fired_at: iso(l.incident.fired_at),
      window: { since: minus(l.incident.fired_at, forMin), until: iso(l.incident.fired_at) },
      note: "PromQL-shaped rule; the lab does not evaluate it. Hand it to your agent and pivot by the labels.",
    });
    return 0;
  }

  if (cmd === "trace") {
    if (!arg) {
      console.error("usage: npm run tool -- trace <incident> <trace_id>");
      return 2;
    }
    const args = { trace_id: arg };
    const r = h.get_trace(args);
    print("get_trace", args, r);
    return "error" in r ? 1 : 0;
  }

  const minutes = parseWindow(values.window, cmd === "changes" ? 15 : 60);
  if (minutes === undefined) {
    console.error(`FAIL --window must look like 15m or 2h (got ${values.window})`);
    return 2;
  }
  const since = minus(l.until, minutes);

  if (cmd === "changes") {
    const args = { since, until: l.until };
    print("list_changes", args, h.list_changes(args));
    return 0;
  }
  if (cmd === "metrics") {
    if (values.by !== undefined && values.by !== "retry" && values.by !== "version") {
      console.error("FAIL --by must be retry or version");
      return 2;
    }
    const args = { since, until: l.until, ...(values.by ? { group_by: values.by as GroupBy } : {}) };
    print("summarize_metrics", args, h.summarize_metrics(args));
    return 0;
  }
  // logs
  if (values.level !== undefined && !["info", "warn", "error"].includes(values.level)) {
    console.error("FAIL --level must be info, warn or error");
    return 2;
  }
  const args = {
    since,
    until: l.until,
    limit: 50,
    ...(values.pattern ? { pattern: values.pattern } : {}),
    ...(values.level ? { level: values.level as "info" | "warn" | "error" } : {}),
  };
  print("search_logs", args, h.search_logs(args));
  return 0;
};

if (process.argv[1]?.endsWith("tool.ts") || process.argv[1]?.endsWith("tool.js")) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
