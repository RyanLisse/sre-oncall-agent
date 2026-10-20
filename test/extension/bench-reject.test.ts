// Extension: the correlation-trap bench case (known-bad) and reject-with-reason.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { decide, draftApproval, isApproved, parseApproval, withReason } from "../../src/approval.js";
import { failedChecks, runBench, score, type BenchCase } from "../../src/bench.js";
import { OWNERS, type Recommendation } from "../../src/contract.js";

test("bench: correlation-trap is graded, fails on purpose, and is not counted", async () => {
  const cases = JSON.parse(await readFile("bench/cases.json", "utf8")) as BenchCase[];
  const trap = cases.find((c) => c.name === "correlation-trap");
  assert.ok(trap);
  assert.equal(trap?.status, "known-bad");
  assert.deepEqual(trap?.checks?.proposal_not, ["rollback", "scale"]);
  const s = await runBench(cases);
  const g = s.graded.find((x) => x.name === "correlation-trap");
  assert.equal(g?.known_bad, true);
  assert.notEqual(g?.grade, "pass");
  assert.ok((g?.failed_checks ?? []).length >= 3);
  assert.equal(s.known_bad, 1);
  assert.equal(s.harmful, 0, "a known-bad case does not count as harmful");
  assert.equal(s.total, cases.length - 1);
});

test("bench: a known-bad harmful answer is excluded, a normal one still counts", () => {
  const base = { got: { proposal: "scale", severity: "page" }, expect: { proposal: "investigate-more", severity: "page" }, grade: "harmful" as const };
  assert.equal(score([{ name: "a", ...base, known_bad: true }]).harmful, 0);
  assert.equal(score([{ name: "a", ...base }]).harmful, 1);
});

test("bench checks: a good answer for the trap passes every check", () => {
  const good = {
    proposal: "investigate-more" as const,
    ruled_out: ["capacity: first attempts flat at 480/min, extra volume is retries (metrics:03:39)", "d-4830: healthy for 6 min on v2.15.1; payments.charge never fails (traces:7f3a9c)"],
    evidence: [{ source: "deploys" as const, ref: "changes:cfg-912", note: "price-cache flush 03:37:30" }],
  };
  assert.deepEqual(failedChecks(good, { proposal_not: ["rollback", "scale"], ruled_out_mentions: ["capacity", "d-4830"], evidence_sources_any: ["changes", "traces"] }), []);
});

const rec: Recommendation = {
  incident_id: "INC-1002", tag: "latency", severity: "page", confidence: "medium", hypothesis: "h",
  evidence: [{ source: "metrics", ref: "t", note: "n" }, { source: "deploys", ref: "d-4830", note: "n" }],
  blast_radius: "b", proposal: "scale", ruled_out: [], would_change_my_mind: "w", data_gaps: [], watch_metric: "error_rate",
  draft_only: true, human_approval_required: true, owner: OWNERS.scale,
};

test("reject with a reason: stored on the record, isApproved unchanged", () => {
  const rejected = decide(draftApproval(rec, "t0"), "rejected", "ryan", "t1");
  assert.equal(rejected.ok, true);
  if (!rejected.ok) return;
  const r = withReason(rejected.value, "  traces:7f3a9c: price-cache miss, postgres timeout  ");
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.reason, "traces:7f3a9c: price-cache miss, postgres timeout");
  assert.equal(isApproved(r.value, "INC-1002", "scale"), false);
  assert.equal(parseApproval(JSON.parse(JSON.stringify(r.value))).ok, true);
  assert.equal(parseApproval({ ...r.value, reason: 7 }).ok, false);
});

test("a reason needs text and only goes on a rejection", () => {
  const rejected = decide(draftApproval(rec, "t0"), "rejected", "ryan", "t1");
  const approved = decide(draftApproval(rec, "t0"), "approved", "ryan", "t1");
  if (!rejected.ok || !approved.ok) throw new Error();
  assert.equal(withReason(rejected.value, "   ").ok, false);
  assert.equal(withReason(approved.value, "because").ok, false);
  assert.equal(withReason(draftApproval(rec, "t0"), "because").ok, false);
});
