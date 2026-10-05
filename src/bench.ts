/**
 * bench.ts — held-out replay + ratchet
 * ---------------------------------------------------------------------------
 * Two ideas borrowed from Anthropic:
 *
 *   oncall-kit "Validate": replay held-back incidents against the playbooks
 *   and grade each answer; ≥70% pass and ZERO harmful answers, or go back.
 *
 *   claude.dev "How we made claude.ai 3x faster": every benchmark is also a
 *   CI guardrail with a number that can only ratchet one way. If the score
 *   drops below the committed floor, CI fails. When it rises, a job raises
 *   the floor.
 *
 * Here the score is the pass-rate of the offline investigator over
 * `bench/cases.json`. A case passes when the proposal AND the severity match
 * the expected answer. A case is HARMFUL when the agent proposes a strong
 * action (rollback/scale/flag-off) that the key says is wrong — a false
 * mitigation is worse than a missed one.
 *
 *   npm run bench            → grade and compare to bench/ratchet.json
 *   npm run bench -- --raise → if better, write the new floor
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseIncident, type Proposal, type Severity } from "./contract.js";
import { offlineVerdict } from "./runtime.js";
import { loadTelemetry } from "./telemetry.js";

export interface BenchCase {
  readonly name: string;
  readonly incident: unknown;
  readonly telemetry: string;
  readonly expect: { readonly proposal: Proposal; readonly severity: Severity };
}

export interface Graded {
  readonly name: string;
  readonly got: { proposal: string; severity: string };
  readonly expect: { proposal: string; severity: string };
  readonly grade: "pass" | "partial" | "fail" | "harmful";
}

const STRONG: ReadonlySet<string> = new Set(["rollback", "scale", "flag-off"]);

/** Pure grading rule. */
export const grade = (got: Graded["got"], expect: Graded["expect"]): Graded["grade"] =>
  got.proposal === expect.proposal && got.severity === expect.severity
    ? "pass"
    : got.proposal === expect.proposal
      ? "partial"
      : STRONG.has(got.proposal) && got.proposal !== expect.proposal
        ? "harmful"
        : "fail";

export interface BenchScore {
  readonly graded: readonly Graded[];
  readonly total: number;
  readonly pass: number;
  readonly partial: number;
  readonly harmful: number;
  /** pass + partial, as the kit counts ✅+⚠️ */
  readonly rate: number;
}

export const score = (graded: readonly Graded[]): BenchScore => {
  const pass = graded.filter((g) => g.grade === "pass").length;
  const partial = graded.filter((g) => g.grade === "partial").length;
  const harmful = graded.filter((g) => g.grade === "harmful").length;
  return { graded, total: graded.length, pass, partial, harmful, rate: graded.length === 0 ? 0 : (pass + partial) / graded.length };
};

export const runBench = async (cases: readonly BenchCase[]): Promise<BenchScore> => {
  const graded: Graded[] = [];
  for (const c of cases) {
    const incident = parseIncident(c.incident);
    const telemetry = await loadTelemetry(c.telemetry);
    if (!incident.ok || !telemetry.ok) {
      graded.push({ name: c.name, got: { proposal: "invalid", severity: "invalid" }, expect: c.expect, grade: "fail" });
      continue;
    }
    const v = offlineVerdict(incident.value, telemetry.value);
    const got = { proposal: v.proposal, severity: v.severity };
    graded.push({ name: c.name, got, expect: c.expect, grade: grade(got, c.expect) });
  }
  return score(graded);
};

interface Ratchet {
  readonly min_rate: number;
  readonly max_harmful: number;
}

const main = async (): Promise<number> => {
  const raise = process.argv.includes("--raise");
  const cases = JSON.parse(await readFile("bench/cases.json", "utf8")) as BenchCase[];
  const ratchet = JSON.parse(await readFile("bench/ratchet.json", "utf8")) as Ratchet;
  const s = await runBench(cases);

  const icon = { pass: "✅", partial: "⚠️ ", fail: "❌", harmful: "🚫" } as const;
  for (const g of s.graded) {
    console.log(`${icon[g.grade]} ${g.name}: got ${g.got.proposal}/${g.got.severity}, expected ${g.expect.proposal}/${g.expect.severity}`);
  }
  console.log(`\nrate ${(s.rate * 100).toFixed(0)}% (${s.pass} pass, ${s.partial} partial of ${s.total}) · harmful ${s.harmful}`);
  console.log(`ratchet: min_rate ${(ratchet.min_rate * 100).toFixed(0)}% · max_harmful ${ratchet.max_harmful}`);

  const ok = s.rate >= ratchet.min_rate && s.harmful <= ratchet.max_harmful;
  if (!ok) {
    console.error("\nFAIL bench: below the ratchet. Fix the investigator or the case, do not lower the floor.");
    return 1;
  }
  if (raise && s.rate > ratchet.min_rate) {
    const next: Ratchet = { min_rate: Number(s.rate.toFixed(2)), max_harmful: 0 };
    await writeFile("bench/ratchet.json", `${JSON.stringify(next, null, 2)}\n`, "utf8");
    console.log(`\nratchet raised → min_rate ${(next.min_rate * 100).toFixed(0)}%`);
  }
  console.log("\nPASS bench");
  return 0;
};

if (process.argv[1]?.endsWith("bench.ts") || process.argv[1]?.endsWith("bench.js")) {
  main().then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
