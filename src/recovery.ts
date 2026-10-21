import { z } from "zod";
import { PROPOSALS } from "./contract.js";
import type { IncidentRow, MessageRow } from "./store.js";
import type { Check, WatchReport } from "./watch.js";

const checkSchema = z.object({
  label: z.enum(["half", "full", "double"]), at: z.string(),
  value: z.number().optional(), ok: z.boolean(),
});
const reportSchema = z.object({
  metric: z.enum(["error_rate", "p95_ms"]), baseline: z.number(), limit: z.number(),
  checks: z.array(checkSchema).readonly(), landed: z.boolean(), message: z.string(),
}).superRefine((report, context) => {
  const full = report.checks.filter((check) => check.label === "full");
  const double = report.checks.filter((check) => check.label === "double");
  if (full.length !== 1 || double.length !== 1) {
    context.addIssue({ code: "custom", message: "Recovery requires exactly one observed full and double check." });
    return;
  }
  const fullCheck = full.at(0);
  const doubleCheck = double.at(0);
  if (!fullCheck || !doubleCheck) {
    context.addIssue({ code: "custom", message: "Recovery full and double observations are missing." });
    return;
  }
  const passes = (check: (typeof report.checks)[number]) =>
    check.ok && check.value !== undefined && check.value <= report.limit;
  if (report.checks.some((check) => check.ok && !passes(check))
    || report.landed !== (passes(fullCheck) && passes(doubleCheck))) {
    context.addIssue({ code: "custom", message: "Recovery landing status must match the observed full and double checks." });
  }
});
const recoverySchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready") }),
  z.object({ status: z.literal("running") }),
  z.object({ status: z.literal("blocked"), reason: z.string() }),
  z.object({ status: z.literal("complete"), report: reportSchema }),
]);
export type Recovery = z.infer<typeof recoverySchema>;

const json = (text: string): unknown => { try { return JSON.parse(text); } catch { return null; } };
export const recoveryFrom = (messages: readonly Pick<MessageRow, "kind" | "text">[]): Recovery => {
  const saved = messages.filter((m) => m.kind === "recovery").at(-1);
  if (saved) {
    const parsed = recoverySchema.safeParse(json(saved.text));
    return parsed.success ? parsed.data : { status: "blocked", reason: "Recovery record unreadable. Inspect the evidence; do not repeat execution." };
  }
  if (messages.some((m) => m.kind === "executor")) return {
    status: "blocked", reason: "Historical execution has no structured recovery record. Inspect the original evidence; do not repeat execution.",
  };
  return { status: "ready" };
};

export const captureRecoveryCheck = (report: WatchReport, label: Check["label"], limit: number): Check | undefined => {
  const check = report.checks.find((c) => c.label === label);
  return check && { ...check, ok: check.value !== undefined && check.value <= limit };
};

export const completedRecovery = (
  reference: Pick<WatchReport, "metric" | "baseline" | "limit">, observed: readonly Check[],
): Recovery => {
  const checks = observed.map((c) => ({ ...c }));
  const landed = ["full", "double"].every((label) => checks.some((c) => c.label === label && c.ok));
  return { status: "complete", report: { ...reference, checks, landed,
    message: landed ? "LANDED. A human must still review and close." : "NOT LANDED. Keep the incident open and investigate.",
  } };
};

export const incidentActions = (incident: Pick<IncidentRow, "state">, messages: readonly Pick<MessageRow, "kind" | "text">[]) => {
  const recovery = recoveryFrom(messages);
  const diagnosis = messages.filter((m) => m.kind === "diagnosis").at(-1);
  const proposal = z.object({ proposal: z.enum(PROPOSALS) }).safeParse(json(diagnosis?.text ?? ""));
  const approval = messages.filter((m) => m.kind === "approval").at(-1);
  const decision = z.object({ decision: z.enum(["pending", "approved", "rejected"]) }).safeParse(json(approval?.text ?? ""));
  const rollback = proposal.success && proposal.data.proposal === "rollback";
  const approved = decision.success && decision.data.decision === "approved";
  const active = incident.state === "active" || incident.state === "stale";
  const recovered = recovery.status === "complete" && recovery.report.landed;
  const canDecide = active && proposal.success && recovery.status === "ready" && decision.success && decision.data.decision === "pending";
  const canExecute = active && rollback && recovery.status === "ready" && approved;
  const canMitigate = active && proposal.success && approved && (rollback ? recovered : recovery.status === "ready");
  const canResolve = incident.state === "mitigated" && proposal.success && approved && (rollback ? recovered : recovery.status === "ready");
  let next = "Investigate the evidence. No proposal is ready yet.";
  if (incident.state === "resolved") next = "Resolved. Read the notes and lesson. Start a new incident for a new problem.";
  else if (recovery.status === "running") next = "Wait for execution and all three recovery checks. Do not execute again.";
  else if (recovery.status === "blocked") next = recovery.reason;
  else if (recovery.status === "complete" && !recovery.report.landed) next = "NOT LANDED. Inspect the failed full or double check and logs. Investigate or escalate; do not close or retry rollback for a green result.";
  else if (canResolve) next = "Write what actually happened. A named human can now resolve with notes.";
  else if (canMitigate && recovered) next = "LANDED is not closure. Review the checks, then mark mitigated with your name.";
  else if (canMitigate) next = "Approved. Carry out the manual mitigation outside the agent, then mark it mitigated with your name.";
  else if (canDecide) next = "Read the diagnosis and evidence. Enter your name to approve or reject this proposal.";
  else if (canExecute) next = "Approved. A human can now start the separate rollback executor once.";
  else if (proposal.success) next = "Investigate or escalate to the service owner. This console executes only an approved rollback; other actions are manual.";
  return { canDecide, canExecute, canMitigate, canResolve, next, recovery };
};
