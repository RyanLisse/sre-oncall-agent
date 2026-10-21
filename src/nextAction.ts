/**
 * nextAction.ts — what may a human do next on this incident?
 * ---------------------------------------------------------------------------
 * One pure function over the incident state and its messages. The console
 * shows the result as a banner AND the server refuses every button that is
 * not in `allowed`, so the banner is a rule, not a hint.
 *
 * Humans still approve, execute, mitigate and resolve. This function only
 * decides which of those buttons is legal right now. Chat is always open.
 */
import type { State } from "./store.js";

export type Action = "approve" | "reject" | "execute" | "mitigated" | "resolve";

export interface Msg {
  readonly kind: string;
  readonly text: string;
}

export interface Next {
  readonly title: string;
  readonly detail: string;
  readonly allowed: readonly Action[];
}

/** The `recovery` message the console writes when execute starts and when the three checks finish. */
export type Recovery =
  | { readonly phase: "running" }
  | { readonly phase: "done"; readonly landed: boolean; readonly failed: readonly string[] };

const last = (msgs: readonly Msg[], kind: string): Record<string, unknown> | undefined => {
  const m = [...msgs].reverse().find((x) => x.kind === kind);
  if (!m) return undefined;
  try { return JSON.parse(m.text) as Record<string, unknown>; } catch { return undefined; }
};

export const nextAction = (state: State, msgs: readonly Msg[]): Next => {
  if (state === "resolved") return { title: "Closed", detail: "A human resolved this incident. Nothing can be executed again.", allowed: [] };

  const diag = last(msgs, "diagnosis");
  if (!diag) return { title: "Wait for the investigation", detail: "No diagnosis yet. If it failed, ask in chat: “Investigate: …”.", allowed: [] };

  const proposal = String(diag.proposal ?? "");
  const decision = String(last(msgs, "approval")?.decision ?? "pending");
  const rec = last(msgs, "recovery") as Recovery | undefined;

  if (state === "mitigated") return { title: "Resolve with notes", detail: "Write what you actually did. Your notes become a lesson with your name and this incident id.", allowed: ["resolve"] };
  if (decision === "pending") return { title: `Approve or reject “${proposal}”`, detail: "Read the evidence first. Type your name, then decide. The agent cannot sign.", allowed: ["approve", "reject"] };
  if (decision === "rejected") return { title: "Investigate further, or resolve with notes", detail: "The proposal was rejected. Ask the agent a new question in chat, or close with notes.", allowed: ["resolve"] };

  if (proposal !== "rollback") return { title: `Carry out “${proposal}” yourself`, detail: "The executor only rolls back. Do this step outside the agent, then mark mitigated.", allowed: ["mitigated", "resolve"] };
  if (!rec) return { title: "Execute the rollback", detail: "The separate executor recomputes the target from telemetry and verifies three checkouts.", allowed: ["execute"] };
  if (rec.phase === "running") return { title: "Wait: recovery checks are running", detail: "Three checks at half, full and double the window (about two minutes). Keep traffic running.", allowed: [] };
  if (rec.landed) return { title: "LANDED: mark mitigated", detail: "The full and double checks passed. Landed is not closed: you mark mitigated, then resolve with notes.", allowed: ["mitigated"] };
  return {
    title: "NOT LANDED: do not close, investigate or escalate",
    detail: `Failed: ${rec.failed.join("; ")}. Read the metric window and logs. Do not execute again to get a green result.`,
    allowed: ["resolve"],
  };
};
