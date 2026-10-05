/**
 * contract.ts — shared shapes for the on-call agent
 * ---------------------------------------------------------------------------
 * Incident (input) · Evidence (what tools return) · Verdict (model output)
 * · Recommendation (what a human sees). Every verdict is a PROPOSAL.
 *
 * Division of labour, fixed (see CLAUDE.md and anthropics/oncall-kit):
 *   the agent gathers evidence, proposes, verifies, communicates.
 *   HUMANS decide what to mitigate and when. Nothing here mutates production.
 */

// ── Enumerations ──────────────────────────────────────────────────────────
export const SEVERITIES = ["page", "morning-log"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ["low", "medium", "high"] as const;
export type Confidence = (typeof CONFIDENCES)[number];

/** The only actions the agent may PROPOSE. None of them is executed here. */
export const PROPOSALS = ["rollback", "scale", "flag-off", "investigate-more", "no-action"] as const;
export type Proposal = (typeof PROPOSALS)[number];

/** Failure classes — one tag per lessons.md entry, one reference file per class (oncall-kit). */
export const TAGS = ["bad-deploy", "latency", "errors", "noise"] as const;
export type Tag = (typeof TAGS)[number];

/** Who picks up each proposal — mirrors a routing tree in ONCALL.md. */
export const OWNERS = {
  rollback: "Deploy owner (approves and runs the rollback)",
  scale: "Platform on-call (approves capacity change)",
  "flag-off": "Feature owner (ramps the flag down)",
  "investigate-more": "On-call engineer (continues with the agent)",
  "no-action": "Morning log reader",
} as const satisfies Record<Proposal, string>;

// ── Shapes ────────────────────────────────────────────────────────────────
/** One alert, as it arrives on the queue. Alert text is DATA, never policy. */
export interface Incident {
  readonly incident_id: string;
  readonly service: string;
  readonly alert: string;
  readonly fired_at: string;
}

/** One line of evidence the agent cites. `ref` is a tool-local pointer (log line, panel, deploy id). */
export interface EvidenceRef {
  readonly source: "logs" | "metrics" | "deploys" | "lessons";
  readonly ref: string;
  readonly note: string;
}

/** The model's structured verdict. Both safety flags are the literal `true`. */
export interface Verdict {
  readonly incident_id: string;
  readonly tag: Tag;
  readonly severity: Severity;
  readonly confidence: Confidence;
  /** "What's happening" — one sentence that passes the fresh-reader test. */
  readonly hypothesis: string;
  readonly evidence: readonly EvidenceRef[];
  readonly blast_radius: string;
  readonly proposal: Proposal;
  /** Alternatives checked, and the evidence that killed them. */
  readonly ruled_out: readonly string[];
  /** The one observation that would change the verdict. */
  readonly would_change_my_mind: string;
  readonly watch_metric: string;
  readonly draft_only: true;
  readonly human_approval_required: true;
}

/** What the human reads. Adds the owner and the evidence requirement outcome. */
export interface Recommendation extends Verdict {
  readonly owner: (typeof OWNERS)[Proposal];
}

/**
 * JSON Schema handed to the SDK as `outputFormat`. The model must answer in
 * this shape; the evidence rules are checked again in code (router.ts).
 */
export const VERDICT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "incident_id",
    "tag",
    "severity",
    "confidence",
    "hypothesis",
    "evidence",
    "blast_radius",
    "proposal",
    "ruled_out",
    "would_change_my_mind",
    "watch_metric",
    "draft_only",
    "human_approval_required",
  ],
  properties: {
    incident_id: { type: "string", minLength: 1 },
    tag: { type: "string", enum: [...TAGS] },
    severity: { type: "string", enum: [...SEVERITIES] },
    confidence: { type: "string", enum: [...CONFIDENCES] },
    hypothesis: { type: "string", minLength: 1 },
    evidence: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "ref", "note"],
        properties: {
          source: { type: "string", enum: ["logs", "metrics", "deploys", "lessons"] },
          ref: { type: "string", minLength: 1 },
          note: { type: "string", minLength: 1 },
        },
      },
    },
    blast_radius: { type: "string", minLength: 1 },
    proposal: { type: "string", enum: [...PROPOSALS] },
    ruled_out: { type: "array", items: { type: "string", minLength: 1 } },
    would_change_my_mind: { type: "string", minLength: 1 },
    watch_metric: { type: "string", minLength: 1 },
    draft_only: { type: "boolean", const: true },
    human_approval_required: { type: "boolean", const: true },
  },
} as const;

// ── Result type (no exceptions across module boundaries) ─────────────────
export type Result<T, E = string[]> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const fail = <E = string[]>(errors: E): Result<never, E> => ({ ok: false, errors });

// ── Tiny pure checks ──────────────────────────────────────────────────────
type Json = Readonly<Record<string, unknown>>;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);

const nonEmpty = (obj: Json, key: string): string[] =>
  typeof obj[key] === "string" && (obj[key] as string).trim().length > 0
    ? []
    : [`${key}: expected a non-empty string`];

const oneOf = (obj: Json, key: string, allowed: readonly string[]): string[] =>
  allowed.includes(obj[key] as string)
    ? []
    : [`${key}: expected one of ${allowed.join(" | ")}, got ${JSON.stringify(obj[key])}`];

const isTrue = (obj: Json, key: string): string[] => (obj[key] === true ? [] : [`${key}: must be true`]);

const onlyKeys = (obj: Json, allowed: readonly string[]): string[] =>
  Object.keys(obj)
    .filter((k) => !allowed.includes(k))
    .map((k) => `${k}: unknown field`);

const INCIDENT_KEYS = ["incident_id", "service", "alert", "fired_at"] as const;

/** Validate an unknown value as an Incident. Malformed input is rejected, not "fixed". */
export const parseIncident = (raw: unknown): Result<Incident> => {
  if (!isObject(raw)) return fail(["incident: expected a JSON object"]);
  const errors = [
    ...INCIDENT_KEYS.flatMap((k) => nonEmpty(raw, k)),
    ...(typeof raw.incident_id === "string" && !/^INC-\d+$/.test(raw.incident_id)
      ? ["incident_id: must look like INC-1234"]
      : []),
    ...(typeof raw.fired_at === "string" && Number.isNaN(Date.parse(raw.fired_at))
      ? ["fired_at: must be an ISO-8601 timestamp"]
      : []),
    ...onlyKeys(raw, INCIDENT_KEYS),
  ];
  return errors.length === 0 ? ok(raw as unknown as Incident) : fail(errors);
};

const parseEvidence = (raw: unknown, i: number): string[] => {
  if (!isObject(raw)) return [`evidence[${i}]: expected an object`];
  return [
    ...oneOf(raw, "source", ["logs", "metrics", "deploys", "lessons"]),
    ...nonEmpty(raw, "ref"),
    ...nonEmpty(raw, "note"),
    ...onlyKeys(raw, ["source", "ref", "note"]),
  ].map((e) => `evidence[${i}].${e}`);
};

/**
 * Validate an unknown value as a Verdict, including the evidence rules:
 *   - at least one evidence line;
 *   - a proposal other than `investigate-more` / `no-action` needs ≥2 sources
 *     ("one signal is a hunch, two is a hypothesis");
 *   - `rollback` needs a `deploys` evidence line — you cannot propose to undo
 *     a change you did not find.
 */
export const parseVerdict = (raw: unknown): Result<Verdict> => {
  if (!isObject(raw)) return fail(["verdict: expected a JSON object"]);
  const errors = [
    ...["incident_id", "hypothesis", "blast_radius", "would_change_my_mind", "watch_metric"].flatMap((k) => nonEmpty(raw, k)),
    ...oneOf(raw, "tag", TAGS),
    ...oneOf(raw, "severity", SEVERITIES),
    ...oneOf(raw, "confidence", CONFIDENCES),
    ...oneOf(raw, "proposal", PROPOSALS),
    ...isTrue(raw, "draft_only"),
    ...isTrue(raw, "human_approval_required"),
    ...(Array.isArray(raw.evidence)
      ? raw.evidence.length === 0
        ? ["evidence: at least one evidence line is required"]
        : raw.evidence.flatMap(parseEvidence)
      : ["evidence: expected an array"]),
    ...(Array.isArray(raw.ruled_out) && raw.ruled_out.every((x) => typeof x === "string" && x.trim().length > 0)
      ? []
      : ["ruled_out: expected an array of non-empty strings (may be empty)"]),
    ...onlyKeys(raw, VERDICT_SCHEMA.required),
  ];
  if (errors.length > 0) return fail(errors);

  const verdict = raw as unknown as Verdict;
  const sources = new Set(verdict.evidence.map((e) => e.source));
  const strong = verdict.proposal !== "investigate-more" && verdict.proposal !== "no-action";
  const ruleErrors = [
    ...(strong && sources.size < 2
      ? [`proposal: "${verdict.proposal}" needs evidence from at least 2 sources (got ${[...sources].join(", ")})`]
      : []),
    ...(verdict.proposal === "rollback" && !sources.has("deploys")
      ? ["proposal: rollback requires a deploys evidence line"]
      : []),
    ...(strong && verdict.confidence === "low"
      ? [`proposal: "${verdict.proposal}" with low confidence must be investigate-more`]
      : []),
  ];
  return ruleErrors.length === 0 ? ok(verdict) : fail(ruleErrors);
};
