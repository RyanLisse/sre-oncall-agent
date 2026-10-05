/**
 * router.ts — parse, validate, route (deterministic, no model)
 * ---------------------------------------------------------------------------
 * The model proposes; this file checks the proposal against the contract and
 * attaches the owner. If anything fails, the human sees the errors, not a
 * "repaired" verdict.
 */
import { OWNERS, fail, ok, parseVerdict, type Incident, type Recommendation, type Result, type Verdict } from "./contract.js";

export { parseIncident } from "./contract.js";

const stripFence = (text: string): string => {
  const trimmed = text.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return match?.[1] ?? trimmed;
};

export const parseJson = (text: string): Result<unknown> => {
  try {
    return ok(JSON.parse(stripFence(text)) as unknown);
  } catch (error) {
    return fail([`malformed JSON: ${(error as Error).message}`]);
  }
};

/** Contract check + identity check: the verdict must be about THIS incident. */
export const validateVerdict = (incident: Incident, raw: unknown): Result<Verdict> => {
  const parsed = parseVerdict(raw);
  if (!parsed.ok) return parsed;
  if (parsed.value.incident_id !== incident.incident_id) {
    return fail([`incident_id conflict: expected ${incident.incident_id}, got ${parsed.value.incident_id}`]);
  }
  return parsed;
};

/** Attach the owner. Total over `Proposal`, so no default branch. */
export const routeVerdict = (verdict: Verdict): Recommendation => ({
  ...verdict,
  owner: OWNERS[verdict.proposal],
});

/** parse → validate → route, as one pipeline. */
export const checkAndRoute = (incident: Incident, modelText: string): Result<Recommendation> => {
  const json = parseJson(modelText);
  if (!json.ok) return json;
  const verdict = validateVerdict(incident, json.value);
  return verdict.ok ? ok(routeVerdict(verdict.value)) : verdict;
};
