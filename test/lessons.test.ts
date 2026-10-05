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
