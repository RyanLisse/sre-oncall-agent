/**
 * approval.ts — the human gate, as data
 * ---------------------------------------------------------------------------
 * The Claude Cookbook's SRE agent exposes `request_approval` as a custom tool
 * the APPLICATION answers, and the agent may call the mutating tool only
 * when the answer is "approved". We keep the gate but move it one step
 * further out, where anthropics/oncall-kit puts it: the agent does not have a
 * mutating tool at all. The approval record is what a human signs; whatever
 * executes the mitigation is a separate system that reads this record.
 *
 * This module writes and validates that record. It never executes anything.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PROPOSALS, fail, ok, type Proposal, type Recommendation, type Result } from "./contract.js";

export const DECISIONS = ["approved", "rejected", "pending"] as const;
export type Decision = (typeof DECISIONS)[number];

export interface ApprovalRecord {
  readonly incident_id: string;
  readonly proposal: Proposal;
  readonly owner: string;
  readonly decision: Decision;
  /** Who decided. "OPEN" while pending. */
  readonly decided_by: string;
  readonly decided_at: string;
  /** Exact text the human saw. Never regenerated after signing. */
  readonly summary: string;
}

/** The record the human is asked to sign. Pure. */
export const draftApproval = (rec: Recommendation, at: string): ApprovalRecord => ({
  incident_id: rec.incident_id,
  proposal: rec.proposal,
  owner: rec.owner,
  decision: "pending",
  decided_by: "OPEN",
  decided_at: at,
  summary: `${rec.proposal} for ${rec.incident_id}: ${rec.hypothesis} Watch ${rec.watch_metric} afterwards.`,
});

/** Sign a pending record. Pure; returns a new record. */
export const decide = (record: ApprovalRecord, decision: Exclude<Decision, "pending">, by: string, at: string): Result<ApprovalRecord> =>
  record.decision !== "pending"
    ? fail([`approval for ${record.incident_id} already ${record.decision} by ${record.decided_by}`])
    : by.trim().length === 0
      ? fail(["decided_by: a named human is required"])
      : ok({ ...record, decision, decided_by: by, decided_at: at });

/**
 * The only question an executor may ask this module: is THIS proposal for
 * THIS incident approved by a named human? Anything else → false.
 */
export const isApproved = (record: ApprovalRecord, incidentId: string, proposal: Proposal): boolean =>
  record.incident_id === incidentId &&
  record.proposal === proposal &&
  record.decision === "approved" &&
  record.decided_by !== "OPEN";

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export const parseApproval = (raw: unknown): Result<ApprovalRecord> => {
  if (!isObject(raw)) return fail(["approval: expected a JSON object"]);
  const errors = [
    ...["incident_id", "owner", "decided_by", "decided_at", "summary"].filter((k) => typeof raw[k] !== "string").map((k) => `${k}: expected a string`),
    ...(PROPOSALS.includes(raw.proposal as Proposal) ? [] : ["proposal: unknown"]),
    ...(DECISIONS.includes(raw.decision as Decision) ? [] : ["decision: unknown"]),
  ];
  return errors.length === 0 ? ok(raw as unknown as ApprovalRecord) : fail(errors);
};

// ── File I/O (the only impure part) ──────────────────────────────────────
export const approvalPath = (dir: string, incidentId: string): string =>
  join(dir, `${incidentId.replace(/[^A-Za-z0-9_-]/g, "_")}.approval.json`);

export const writeApproval = async (dir: string, record: ApprovalRecord): Promise<string> => {
  await mkdir(dir, { recursive: true });
  const path = approvalPath(dir, record.incident_id);
  await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return path;
};

export const readApproval = async (dir: string, incidentId: string): Promise<Result<ApprovalRecord>> => {
  try {
    return parseApproval(JSON.parse(await readFile(approvalPath(dir, incidentId), "utf8")) as unknown);
  } catch (error) {
    return fail([`approval: ${(error as Error).message}`]);
  }
};
