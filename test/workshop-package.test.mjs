import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const builder = join(root, "scripts", "package-workshop.mjs");
const toolsSource = readFileSync(join(root, "src", "tools.ts"), "utf8");

const git = (cwd, args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const fixtureRepo = () => {
  const dir = mkdtempSync(join(tmpdir(), "workshop-pack-test-"));
  mkdirSync(join(dir, "src"), { recursive: true });
  mkdirSync(join(dir, "console", "data"), { recursive: true });
  mkdirSync(join(dir, "demo", "data"), { recursive: true });
  mkdirSync(join(dir, "approvals"), { recursive: true });
  mkdirSync(join(dir, "lessons"), { recursive: true });
  writeFileSync(join(dir, "src", "tools.ts"), toolsSource);
  for (const name of ["WORKSHOP.md", "FACILITATOR.md", "README.md"]) writeFileSync(join(dir, name), `# ${name}\n`);
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", private: true }));
  writeFileSync(join(dir, "PROGRESS.md"), "historical progress\n");
  writeFileSync(join(dir, "console", "data", "old.json"), "{}\n");
  writeFileSync(join(dir, "demo", "data", "telemetry.json"), "{}\n");
  writeFileSync(join(dir, "approvals", "old.approval.json"), "{}\n");
  writeFileSync(join(dir, "lessons", "lessons.md"), "human history\n");
  git(dir, ["init", "-q"]);
  git(dir, ["config", "user.email", "workshop-test@example.invalid"]);
  git(dir, ["config", "user.name", "Workshop test"]);
  git(dir, ["add", "-A"]);
  git(dir, ["commit", "-qm", "fixture"]);
  return dir;
};

const runBuilder = (cwd, output) =>
  spawnSync(process.execPath, [builder, "--output", output], {
    cwd,
    env: { ...process.env },
    encoding: "utf8",
  });

const zipNames = (zip) => execFileSync("unzip", ["-Z1", zip], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
const zipText = (zip, path) => execFileSync("unzip", ["-p", zip, path], { encoding: "utf8" });

test("package builder emits clearly rooted starter and checkpoint archives from HEAD", () => {
  const dir = fixtureRepo();
  try {
    const output = join(dir, "packages");
    const result = runBuilder(dir, output);
    assert.equal(result.status, 0, result.stderr);
    const starter = join(output, "starter.zip");
    const checkpoint = join(output, "checkpoint.zip");
    for (const [zip, prefix] of [[starter, "starter/"], [checkpoint, "checkpoint/"]]) {
      const names = zipNames(zip);
      assert.ok(names.length > 0);
      assert.ok(names.every((name) => name.startsWith(prefix)), names.join("\n"));
      assert.ok(!names.some((name) => /(^|\/)(\.git|node_modules|console\/data|demo\/data|approvals|lessons|PROGRESS\.md)/.test(name)));
      assert.match(zipText(zip, `${prefix}WORKSHOP-PACKAGE.md`), prefix === "starter/" ? /\*\*STARTER\*\*/ : /\*\*CHECKPOINT \(SOLVED\)\*\*/);
      assert.match(zipText(zip, `${prefix}WORKSHOP-PACKAGE.md`), /No Git installation is required/);
    }
    const starterSource = zipText(starter, "starter/src/tools.ts");
    assert.match(starterSource, /TODO\(A5\)/);
    assert.match(starterSource, /list_deploys: \(\) => \[\]/);
    assert.doesNotMatch(starterSource, /^\s*tool\(\s*"list_deploys"/m);
    assert.match(zipText(checkpoint, "checkpoint/src/tools.ts"), /list_deploys: \(args/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("package builder rejects relevant dirty source but ignores inherited progress state", () => {
  const dir = fixtureRepo();
  try {
    writeFileSync(join(dir, "src", "tools.ts"), `${toolsSource}\n// dirty\n`);
    const dirty = runBuilder(dir, join(dir, "dirty-output"));
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /Relevant tracked files are dirty/);

    writeFileSync(join(dir, "src", "tools.ts"), toolsSource);
    writeFileSync(join(dir, "PROGRESS.md"), "new local note\n");
    const progressOnly = runBuilder(dir, join(dir, "progress-output"));
    assert.equal(progressOnly.status, 0, progressOnly.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("package builder refuses to overwrite an existing destination", () => {
  const dir = fixtureRepo();
  try {
    const output = join(dir, "packages");
    mkdirSync(output);
    const result = runBuilder(dir, output);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Destination already exists/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
