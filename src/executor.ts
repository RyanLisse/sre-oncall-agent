/**
 * executor.ts — the approved-recovery executor (a SEPARATE system)
 * ---------------------------------------------------------------------------
 * This is the thing the agent is NOT. It mutates the shop — but only when:
 *   1. an approval record exists for THIS incident and THIS proposal,
 *   2. it was signed by a named human (isApproved),
 *   3. the proposal is `rollback` and the target revision is the version
 *      that was live before the blamed deploy (recomputed from telemetry,
 *      never taken from model text),
 *   4. and after acting it produces FRESH checkout evidence on the intended
 *      revision — three verified successful checkouts — before it reports done.
 *
 * Model output and log text cannot approve a mutation. The executor never
 * imports anything from agent.ts or runtime.ts.
 *
 *   npm run execute -- <incident-file> --shop http://localhost:4310
 */
import { readApproval, type ApprovalRecord } from "./approval.js";
import { fail, ok, type Incident, type Result } from "./contract.js";
import { deployBehind, loadTelemetry, previousVersion, summarizeMetrics, type Telemetry } from "./telemetry.js";

export interface ExecutionPlan {
  readonly incident_id: string;
  readonly blamed_deploy: string;
  readonly from_version: string;
  readonly to_version: string;
}

/** Recompute the rollback target from telemetry. Pure. Refuses when the evidence does not point at one deploy. */
export const planRollback = (incident: Incident, t: Telemetry): Result<ExecutionPlan> => {
  const since = new Date(Date.parse(incident.fired_at) - 60 * 60_000).toISOString();
  const bp = summarizeMetrics(t, since, incident.fired_at).breakpoints[0];
  if (!bp) return fail(["no breakpoint in the window — nothing to roll back"]);
  const deploy = deployBehind(t, bp.ts);
  if (!deploy) return fail(["no deploy within 15 min before the breakpoint — rollback is not the right action"]);
  const prev = previousVersion(t, deploy);
  if (!prev) return fail([`no previous version known before ${deploy.id}`]);
  return ok({ incident_id: incident.incident_id, blamed_deploy: deploy.id, from_version: deploy.version, to_version: prev });
};

/** The approval must be for this incident, be a rollback, and be signed. Pure. */
export const checkApproval = (record: ApprovalRecord, incident: Incident): Result<ApprovalRecord> =>
  // TODO(A8): rebuild the gate. test/workshop/executor.test.ts is red: refuse
  // unless the record is for THIS incident, the proposal is "rollback", and
  // isApproved(record, incident.incident_id, "rollback") holds — a named
  // human signed it. Re-import isApproved from ./approval.js.
  record.proposal !== "rollback"
    ? fail([`executor only implements rollback; approval is for ${record.proposal}`])
    : ok(record);

export interface Evidence {
  readonly attempts: number;
  readonly verified_ok: number;
  readonly revision_seen: readonly string[];
}

/** Fresh evidence: N verified successful checkouts on the intended revision. */
export const freshEvidence = async (shopUrl: string, revision: string, n = 3): Promise<Result<Evidence>> => {
  const seen = new Set<string>();
  let okCount = 0, attempts = 0;
  while (okCount < n && attempts < n * 4) {
    attempts++;
    try {
      const r = await fetch(`${shopUrl}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { revision?: string; paid?: boolean };
      if (j.revision) seen.add(j.revision);
      if (j.revision === revision && r.status < 500 && j.paid === true) okCount++;
    } catch { /* counts as a failed attempt */ }
  }
  const ev = { attempts, verified_ok: okCount, revision_seen: [...seen] };
  return okCount >= n ? ok(ev) : fail([`only ${okCount}/${n} verified successful checkouts on ${revision} after ${attempts} attempts (saw: ${ev.revision_seen.join(", ") || "none"})`]);
};

export interface ExecuteDeps {
  readonly shopUrl: string;
  readonly approvalsDir: string;
  readonly telemetryPath: string;
  readonly log?: (line: string) => void;
}

export const execute = async (incident: Incident, deps: ExecuteDeps): Promise<Result<{ plan: ExecutionPlan; evidence: Evidence }>> => {
  const log = deps.log ?? (() => undefined);
  const approval = await readApproval(deps.approvalsDir, incident.incident_id);
  if (!approval.ok) return approval;
  const signed = checkApproval(approval.value, incident);
  if (!signed.ok) return signed;
  log(`approval: rollback for ${incident.incident_id} by ${signed.value.decided_by}`);

  const t = await loadTelemetry(deps.telemetryPath);
  if (!t.ok) return t;
  const plan = planRollback(incident, t.value);
  if (!plan.ok) return plan;
  log(`plan: ${plan.value.blamed_deploy} ${plan.value.from_version} → ${plan.value.to_version} (recomputed from telemetry)`);

  // The one mutation. Through the shop's admin API, as the operator would.
  const r = await fetch(`${deps.shopUrl}/admin/deploy`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ version: plan.value.to_version, mode: "healthy", author: `executor (approved by ${signed.value.decided_by})`, summary: `rollback of ${plan.value.blamed_deploy} for ${incident.incident_id}` }),
  }).catch(() => undefined);
  if (!r || r.status !== 200) return fail([`shop refused the rollback (${r?.status ?? "unreachable"})`]);
  log(`applied: ${plan.value.to_version} is now serving`);

  const ev = await freshEvidence(deps.shopUrl, plan.value.to_version);
  if (!ev.ok) return ev;
  log(`evidence: ${ev.value.verified_ok} verified successful checkouts on ${plan.value.to_version}`);
  return ok({ plan: plan.value, evidence: ev.value });
};
