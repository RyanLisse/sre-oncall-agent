/**
 * tools.ts — the agent's read-only investigation tools
 * ---------------------------------------------------------------------------
 * Three tools, exposed to the SDK as an in-process MCP server:
 *   search_logs · summarize_metrics · list_deploys
 *
 * "The quality of your agent comes down to the quality of its tools."
 * There is deliberately no `rollback`, `scale` or `set_flag` tool. The agent
 * proposes; the owner acts. If you ever add a mutating tool, build it as its
 * own agent with its own approval path (oncall-kit: "No auto-mitigation").
 */
import { createSdkMcpServer, tool, type McpSdkServerConfigWithInstance } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { getDiff, listDeploys, searchLogs, summarizeMetrics, type Telemetry } from "./telemetry.js";

export const SERVER_NAME = "telemetry";
export const TOOL_NAMES = ["search_logs", "summarize_metrics", "list_deploys", "get_diff"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

/** Fully qualified names the SDK uses for MCP tools: `mcp__<server>__<tool>`. */
export const qualified = (name: ToolName): string => `mcp__${SERVER_NAME}__${name}`;
export const ALLOWED_TOOLS: readonly string[] = TOOL_NAMES.map(qualified);

/** Tools the SDK adds itself (to deliver `outputFormat`) — not investigation steps. */
export const SDK_INTERNAL_TOOLS: ReadonlySet<string> = new Set(["StructuredOutput"]);

const text = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

/**
 * Every tool result carries a `reproduce` line: the exact tool + arguments that
 * produced it, so an evidence ref can be re-run by a human (Owain's Logs
 * Explorer links carry the query and window for the same reason).
 */
const withRepro = <T>(name: ToolName, args: unknown, result: T) => ({ reproduce: `${name} ${JSON.stringify(args)}`, result });

/**
 * Pure handlers, exported so the offline runtime and the tests can call the
 * same logic without an MCP transport.
 */
export const handlers = (t: Telemetry) => ({
  search_logs: (args: {
    pattern?: string | undefined;
    level?: "info" | "warn" | "error" | undefined;
    since?: string | undefined;
    until?: string | undefined;
    limit?: number | undefined;
  }) => searchLogs(t, args),
  summarize_metrics: (args: { since?: string | undefined; until?: string | undefined }) =>
    summarizeMetrics(t, args.since, args.until),
  list_deploys: (args: { since?: string | undefined; until?: string | undefined }) =>
    listDeploys(t, args.since, args.until),
  get_diff: (args: { deploy: string }) => getDiff(t, args.deploy),
});

export const createTelemetryServer = (t: Telemetry): McpSdkServerConfigWithInstance => {
  const h = handlers(t);
  return createSdkMcpServer({
    name: SERVER_NAME,
    version: "1.0.0",
    tools: [
      tool(
        "search_logs",
        "Search the service log store. Case-insensitive substring match on the message. Returns at most 50 lines, oldest first. Cite results as logs:<ts>.",
        {
          pattern: z.string().optional().describe("substring to look for, e.g. 'payment' or 'timeout'"),
          level: z.enum(["info", "warn", "error"]).optional(),
          since: z.string().optional().describe("ISO-8601 lower bound"),
          until: z.string().optional().describe("ISO-8601 upper bound"),
          limit: z.number().int().min(1).max(50).optional(),
        },
        async (args) => text(withRepro("search_logs", args, h.search_logs(args))),
      ),
      tool(
        "summarize_metrics",
        "Summarise error_rate and p95 latency for a window and list breakpoints (≥2× jumps) with the version live at that moment. Cite results as metrics:<ts>.",
        {
          since: z.string().optional(),
          until: z.string().optional(),
        },
        async (args) => text(withRepro("summarize_metrics", args, h.summarize_metrics(args))),
      ),
      tool(
        "list_deploys",
        "List deploys in a window, newest first: id, version, time, author, summary. Cite results as deploys:<id>.",
        {
          since: z.string().optional(),
          until: z.string().optional(),
        },
        async (args) => text(withRepro("list_deploys", args, h.list_deploys(args))),
      ),
      tool(
        "get_diff",
        "Unified diff for a deploy id or version. Read the change before you blame it. Cite as diff:<deploy id>.",
        { deploy: z.string().describe("deploy id like d-4821, or a version like v2.15.0") },
        async (args) => text(withRepro("get_diff", args, h.get_diff(args))),
      ),
    ],
  });
};
