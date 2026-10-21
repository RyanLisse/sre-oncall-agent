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
import type { IncidentRow, MessageRow, State } from "./store.js";
import { incidentActions } from "./recovery.js";

export type Action = "approve" | "reject" | "execute" | "mitigated" | "resolve";

export type Msg = Pick<MessageRow, "kind" | "text">;

export interface Next {
  readonly title: string;
  readonly detail: string;
  readonly allowed: readonly Action[];
}

/** The `recovery` message the console writes when execute starts and when the three checks finish. */
export const nextAction = (state: State, msgs: readonly Msg[]): Next => {
  const actions = incidentActions({ state } satisfies Pick<IncidentRow, "state">, msgs);
  if (state === "resolved") return { title: "Closed", detail: "A human resolved this incident. Nothing can be executed again.", allowed: [] };
  if (actions.recovery.status === "running") return { title: "Wait: recovery checks are running", detail: actions.next, allowed: [] };
  if (actions.recovery.status === "blocked") return { title: "Recovery blocked", detail: actions.next, allowed: [] };
  if (actions.recovery.status === "complete" && !actions.recovery.report.landed) {
    const failed = actions.recovery.report.checks.filter((c) => (c.label === "full" || c.label === "double") && !c.ok)
      .map((c) => `${c.label}=${c.value ?? "no data"}`).join(", ");
    return { title: "NOT LANDED: keep the incident open", detail: `Failed ${failed || "full or double"}; recovery limit ${actions.recovery.report.limit}. Keep the incident open and investigate.`, allowed: [] };
  }
  if (actions.canResolve) return { title: "Resolve with notes", detail: actions.next, allowed: ["resolve"] };
  if (actions.canMitigate) return { title: "LANDED: mark mitigated", detail: actions.next, allowed: ["mitigated"] };
  if (actions.canDecide) return { title: "Approve or reject the proposal", detail: actions.next, allowed: ["approve", "reject"] };
  if (actions.canExecute) return { title: "Execute the approved rollback", detail: actions.next, allowed: ["execute"] };
  if (!msgs.some((m) => m.kind === "diagnosis")) return { title: "Wait for the investigation", detail: "No diagnosis yet. Ask in chat: Investigate: …", allowed: [] };
  return { title: "Investigate or escalate", detail: actions.next, allowed: [] };
};
