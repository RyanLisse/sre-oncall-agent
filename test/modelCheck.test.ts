import assert from "node:assert/strict";
import { test } from "node:test";
import { checkModel } from "../src/modelCheck.js";

test("model preflight loads user settings without enabling tools", async () => {
  let called = false;
  const model = await checkModel(async function* ({ options }) {
    called = true;
    assert.deepEqual(options.settingSources, ["user"]);
    assert.deepEqual(options.tools, []);
    assert.deepEqual(options.allowedTools, []);
    assert.equal(options.permissionMode, "dontAsk");
    yield { type: "result", subtype: "success", result: "READY" };
  }, "sonnet");
  assert.ok(called);
  assert.equal(model, "sonnet");
});

test("model preflight fails instead of falling back to offline", async () => {
  const empty = async function* () {};
  await assert.rejects(checkModel(empty, "sonnet"), /did not return READY/);
  await assert.rejects(checkModel(empty, "offline"), /requires a real model/);
});
