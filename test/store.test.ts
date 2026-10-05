import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Store } from "../src/store.js";

const fresh = () => new Store(join(mkdtempSync(join(tmpdir(), "oncall-")), "t.sqlite"));

test("incidents and messages persist and list newest first", () => {
  const s = fresh();
  const a = s.newIncident("a", "alert", "INC-1");
  s.add(a.id, "agent", "text", "hello");
  const b = s.newIncident("b", "human", "INC-2");
  assert.deepEqual(s.list().map((x) => x.id), [b.id, a.id]);
  assert.equal(s.messages(a.id).length, 1);
});

test("closing arrows need a named human", () => {
  const s = fresh();
  const a = s.newIncident("a", "alert", "INC-3");
  assert.throws(() => s.setState(a.id, "resolved", ""));
  assert.equal(s.setState(a.id, "resolved", "ryan").state, "resolved");
});

test("stale is a flag the agent may set; it never resolves", () => {
  const s = fresh();
  const a = s.newIncident("a", "alert", "INC-4");
  assert.equal(s.flagStale(0).length, 1);
  assert.equal(s.get(a.id)?.state, "stale");
  assert.equal(s.flagStale(0).length, 0, "already flagged");
});
