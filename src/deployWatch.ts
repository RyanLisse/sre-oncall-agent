/**
 * deployWatch.ts — "Watch the next deployment for five minutes."
 * ---------------------------------------------------------------------------
 * Owain Lewis's demo and OpenAI's software-factory both have this: an
 * operator asks the agent to watch a rollout. Here it is, with the shape his
 * docs describe and anthropics/oncall-kit's constraints:
 *
 *   - The CHAT COMMAND is parsed by a strict grammar, not by the model. Extra
 *     sentences describe the fixed policy; they cannot change it. Arbitrary
 *     additional instructions are REJECTED rather than silently changing the
 *     approval rules.
 *   - The FAILURE POLICY is fixed and deterministic (no model):
 *       three consecutive verified checkout failures, OR
 *       three consecutive verified requests over 1000 ms, OR
 *       ≥3 observed 5xx in the metric buckets after the watch started.
 *     An unavailable or unverified check breaks a failure streak.
 *   - The watch produces OBSERVATIONS. When it fails, the agent's investigate()
 *     is what gets queued — the model never schedules or evaluates checks.
 *   - There is no automatic rollback.
 */
import { fail, ok, type Result } from "./contract.js";

export const MAX_MINUTES = 15;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15 };

export interface WatchCommand {
  readonly target: "next" | "this";
  readonly minutes: number;
}

/**
 * Accepted:
 *   "Watch the next deployment for five minutes."
 *   "Watch this deployment for 5 minutes."
 *   "Monitor the deploy."                                  (this, 5)
 *   + optionally the fixed-policy sentences: "Check checkout success, errors and
 *     latency. Investigate any regression and ask me before rolling back."
 * Rejected: anything else — extra instructions are not policy.
 */
export const parseWatchCommand = (text: string): Result<WatchCommand> => {
  const t = text.trim().replace(/\s+/g, " ");
  const main = /^(?:watch|monitor) (?:the )?(next|this)? ?(?:deployment|deploy|rollout)(?: for (\d{1,2}|[a-z]+) minutes?)?\.?/i.exec(t);
  if (!main) return fail(["not a watch command. Try: \"Watch the next deployment for five minutes.\""]);
  const rest = t.slice(main[0].length).trim();
  const allowedExtras = [
    /^check checkout success,? errors,? and latency\.?$/i,
    /^investigate any regression and ask me before rolling back\.?$/i,
  ];
  const sentences = rest ? rest.split(/(?<=\.)\s+/).filter(Boolean) : [];
  const rejected = sentences.filter((s) => !allowedExtras.some((re) => re.test(s.trim())));
  if (rejected.length > 0) return fail([`extra instructions are not policy and were rejected: ${rejected.map((s) => `"${s}"`).join(", ")}`]);
  const raw = main[2];
  const minutes = raw === undefined ? 5 : /^\d+$/.test(raw) ? Number(raw) : WORDS[raw.toLowerCase()];
  if (minutes === undefined || minutes < 1 || minutes > MAX_MINUTES) return fail([`duration must be 1–${MAX_MINUTES} minutes`]);
  return ok({ target: (main[1]?.toLowerCase() as "next" | "this" | undefined) ?? "this", minutes });
};

export const parseStopCommand = (text: string): boolean => /^(stop (?:the )?(?:deployment )?watch(?:ing)?|stop watching)\.?$/i.test(text.trim());

// ── Observations and the fixed policy (pure) ─────────────────────────────
export interface Observation {
  readonly at: string;
  /** verified = the response carried the revision we are watching. */
  readonly verified: boolean;
  readonly ok: boolean;
  readonly ms: number;
  readonly revision: string | undefined;
}

export interface WatchPolicyResult {
  readonly failed: boolean;
  readonly reason: string | undefined;
  readonly consecutiveFailures: number;
  readonly consecutiveSlow: number;
}

export const POLICY = { consecutiveFailures: 3, consecutiveSlow: 3, slowMs: 1000, metric5xx: 3 } as const;

/** Evaluate the fixed demo failure policy over observations + 5xx seen in metrics since the watch began. */
export const evaluatePolicy = (obs: readonly Observation[], metric5xx: number): WatchPolicyResult => {
  let f = 0, s = 0, maxF = 0, maxS = 0;
  for (const o of obs) {
    if (!o.verified) { f = 0; s = 0; continue; } // unavailable/unverified breaks the streak
    f = o.ok ? 0 : f + 1;
    s = o.ms > POLICY.slowMs ? s + 1 : 0;
    maxF = Math.max(maxF, f); maxS = Math.max(maxS, s);
  }
  const reason =
    maxF >= POLICY.consecutiveFailures ? `${POLICY.consecutiveFailures} consecutive verified checkout failures`
    : maxS >= POLICY.consecutiveSlow ? `${POLICY.consecutiveSlow} consecutive verified requests over ${POLICY.slowMs} ms`
    : metric5xx >= POLICY.metric5xx ? `${metric5xx} 5xx responses in metrics since the watch began`
    : undefined;
  return { failed: reason !== undefined, reason, consecutiveFailures: f, consecutiveSlow: s };
};

// ── The watcher (I/O: polls the shop) ────────────────────────────────────
export interface WatchDeps {
  readonly shopUrl: string;
  readonly intervalMs?: number;
  readonly now?: () => number;
  readonly onTick?: (o: Observation, policy: WatchPolicyResult) => void;
  readonly signal?: AbortSignal;
}

export interface WatchResult {
  readonly revision: string;
  readonly started: string;
  readonly ended: string;
  readonly observations: readonly Observation[];
  readonly outcome: "passed" | "failed" | "stopped" | "no-deployment";
  readonly reason: string | undefined;
}

const health = async (url: string): Promise<{ revision: string } | undefined> => {
  try { return (await (await fetch(`${url}/health`)).json()) as { revision: string }; } catch { return undefined; }
};

const probe = async (url: string, revision: string): Promise<Observation> => {
  const t0 = Date.now();
  try {
    const r = await fetch(`${url}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    const j = (await r.json().catch(() => ({}))) as { revision?: string; paid?: boolean };
    return { at: new Date().toISOString(), verified: j.revision === revision, ok: r.status < 500 && j.paid === true, ms: Date.now() - t0, revision: j.revision };
  } catch {
    return { at: new Date().toISOString(), verified: false, ok: false, ms: Date.now() - t0, revision: undefined };
  }
};

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); res(); }, { once: true });
});

export const runWatch = async (cmd: WatchCommand, deps: WatchDeps): Promise<WatchResult> => {
  const interval = deps.intervalMs ?? 10_000;
  const started = new Date().toISOString();
  const first = await health(deps.shopUrl);
  if (!first) return { revision: "?", started, ended: new Date().toISOString(), observations: [], outcome: "no-deployment", reason: "shop unreachable" };

  let revision = first.revision;
  if (cmd.target === "next") {
    // wait up to MAX_MINUTES for the serving revision to change
    const deadline = Date.now() + MAX_MINUTES * 60_000;
    let changed = false;
    while (Date.now() < deadline && !deps.signal?.aborted) {
      await sleep(Math.min(interval, 5000), deps.signal);
      const h = await health(deps.shopUrl);
      if (h && h.revision !== revision) { revision = h.revision; changed = true; break; }
    }
    if (!changed) return { revision, started, ended: new Date().toISOString(), observations: [], outcome: deps.signal?.aborted ? "stopped" : "no-deployment", reason: deps.signal?.aborted ? "stopped by operator" : "no new revision within the wait window" };
  }

  const obs: Observation[] = [];
  const end = Date.now() + cmd.minutes * 60_000;
  let policy = evaluatePolicy(obs, 0);
  while (Date.now() < end && !deps.signal?.aborted) {
    const o = await probe(deps.shopUrl, revision);
    obs.push(o);
    const metric5xx = obs.filter((x) => x.verified && !x.ok).length;
    policy = evaluatePolicy(obs, metric5xx);
    deps.onTick?.(o, policy);
    if (policy.failed) break;
    await sleep(interval, deps.signal);
  }
  const outcome = deps.signal?.aborted ? "stopped" : policy.failed ? "failed" : "passed";
  return { revision, started, ended: new Date().toISOString(), observations: obs, outcome, reason: outcome === "stopped" ? "stopped by operator" : policy.reason };
};
