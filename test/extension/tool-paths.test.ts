// Extension: npm run tool's path check follows symlinks and stays inside its folder.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { insideDir } from "../../scripts/tool.js";

const root = mkdtempSync(join(tmpdir(), "tool-paths-"));
mkdirSync(join(root, "fixtures/incidents"), { recursive: true });
writeFileSync(join(root, "fixtures/incidents/ok.json"), "{}");
writeFileSync(join(root, "secret.json"), "{}");
symlinkSync(join(root, "secret.json"), join(root, "fixtures/incidents/link.json"));
// a second repo whose fixtures/incidents folder is itself a symlink to somewhere outside it
const outside = mkdtempSync(join(tmpdir(), "tool-paths-outside-"));
writeFileSync(join(outside, "x.json"), "{}");
const root2 = mkdtempSync(join(tmpdir(), "tool-paths-"));
mkdirSync(join(root2, "fixtures"));
symlinkSync(outside, join(root2, "fixtures/incidents"));

test("inside: a real .json file in the folder", () => {
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents/ok.json", ".json"), true);
  assert.equal(insideDir(root, "fixtures/incidents", join(root, "fixtures/incidents/ok.json"), ".json"), true);
});

test("outside: traversal, absolute paths, the folder itself, a missing file, the wrong extension", () => {
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents/../../secret.json", ".json"), false);
  assert.equal(insideDir(root, "fixtures/incidents", join(root, "secret.json"), ".json"), false);
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents", ".json"), false);
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents/missing.json", ".json"), false);
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents/ok.json", ".yaml"), false);
});

test("outside: a symlink in the folder that points elsewhere", () => {
  assert.equal(insideDir(root, "fixtures/incidents", "fixtures/incidents/link.json", ".json"), false);
});

test("outside: the folder itself is a symlink that leaves the repo", () => {
  assert.equal(insideDir(root2, "fixtures/incidents", "fixtures/incidents/x.json", ".json"), false);
});
