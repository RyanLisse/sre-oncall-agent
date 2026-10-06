import assert from "node:assert/strict";
import { test } from "node:test";
import { entriesForTag, guessTag, promotionCandidates, renderLessons, splitEntries } from "../src/lessons.js";

const md = `# lessons

## INC-1 · t · #bad-deploy
- a

## INC-2 · t · #latency
- b

## INC-3 · t · #bad-deploy
- c

## INC-4 · t · #bad-deploy
- d
`;

test("entries split on ## and filter by tag", () => {
  assert.equal(splitEntries(md).length, 4);
  assert.equal(entriesForTag(md, "bad-deploy").length, 3);
  assert.equal(entriesForTag(md, "noise").length, 0);
});

test("render includes only the matching class and never the whole file", () => {
  const out = renderLessons(md, "latency");
  assert.match(out, /INC-2/);
  assert.doesNotMatch(out, /INC-1/);
  assert.match(renderLessons("", "noise"), /none yet for #noise/);
});

test("three entries on one tag is a promotion candidate", () => {
  assert.deepEqual(promotionCandidates(md), [{ tag: "bad-deploy", count: 3 }]);
});

test("guessTag classifies alert text cheaply", () => {
  assert.equal(guessTag("regression after deploy"), "bad-deploy");
  assert.equal(guessTag("p95 latency 3000 ms"), "latency");
  assert.equal(guessTag("Error rate 12%"), "errors");
  assert.equal(guessTag("hello"), "noise");
});

import { renderResolutionLesson } from "../src/lessons.js";
test("a resolution note becomes a lesson with human provenance", () => {
  const e = renderResolutionLesson(undefined, "INC-9", "bad-deploy", "rolled back d-1, re-deployed with the EU secret", "ryan", "2026-10-05T20:00:00Z");
  assert.match(e, /^## INC-9 · 2026-10-05T20:00:00Z · #bad-deploy/);
  assert.match(e, /what we actually did \(ryan\)/);
  assert.match(e, /\*\*provenance:\*\* resolution notes by ryan/);
});
