import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Claude setup distinguishes CLI login, SDK access and explicit offline fallback", () => {
  const docs = readFileSync("docs/claude-code.md", "utf8");
  assert.match(docs, /https:\/\/claude\.ai\/install\.sh/);
  assert.match(docs, /https:\/\/claude\.ai\/install\.ps1/);
  assert.match(docs, /Node\.js 22/);
  assert.match(docs, /npm run model:check/);
  assert.ok(docs.indexOf("## Configure the SDK in terminal 2") < docs.indexOf("npm run model:check"));
  assert.ok(docs.indexOf("\nclaude\n") < docs.indexOf("Read CLAUDE.md, AGENTS.md and CARD.md."));
  assert.match(docs, /does not\s+prove SDK access/);
  assert.match(docs, /--fast --offline/);
  assert.match(docs, /not model(?:-quality)? evidence/);
  assert.match(docs, /requests a `\$0\.05` SDK budget/);
  assert.doesNotMatch(docs, /caps the request/);
  assert.doesNotMatch(docs, /sk-ant-[A-Za-z0-9]/);
});
