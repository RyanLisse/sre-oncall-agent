import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, rmSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const seedFixture = (fixture, corruptFile) => {
  mkdirSync(join(fixture, "src"), { recursive: true });
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  for (const file of ["src/tools.ts", "src/telemetry.ts", "src/contract.ts", "src/executor.ts", "workshop.json", "scripts/checkpoint.mjs"]) {
    cpSync(join(root, file), join(fixture, file));
  }
  if (corruptFile) {
    const path = join(fixture, corruptFile);
    const source = readFileSync(path, "utf8");
    writeFileSync(path, corruptFile === "src/tools.ts"
      ? source.replace("listDeploys(t, args.since, args.until)", "[]")
      : source.replace('record.proposal !== "rollback"', 'record.proposal === "rollback"'));
  }
  git(fixture, "init", "-q");
  appendFileSync(join(fixture, ".git", "info", "exclude"), "\n/node_modules\n");
  git(fixture, "config", "user.email", "checkpoint@example.invalid");
  git(fixture, "config", "user.name", "Checkpoint test");
  git(fixture, "add", ".");
  git(fixture, "commit", "-qm", "fixture");
  symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "junction");
};
const assertFailClosedA8 = (executor) => {
  const stub = executor.match(/export const checkApproval = \(_record: ApprovalRecord, _incident: Incident\): Result<ApprovalRecord> =>\n  fail\(\["TODO\(A8\): rebuild the named human approval gate before execution"\]\);/);
  assert.ok(stub, "checkpoint must contain the expected A8 stub");
  const runnable = stub[0]
    .replace("export const ", "const ")
    .replace("(_record: ApprovalRecord, _incident: Incident): Result<ApprovalRecord>", "(_record, _incident)");
  const result = runInNewContext(`${runnable}\ncheckApproval({ proposal: "rollback", decision: "approved", decided_by: "named-human" }, { incident_id: "INC-1001" })`, {
    fail: (errors) => ({ ok: false, errors }),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(Array.from(result.errors), ["TODO(A8): rebuild the named human approval gate before execution"]);
};

test("checkpoint cuts come from committed HEAD and refuse overwrite", () => {
  const fixture = mkdtempSync(join(tmpdir(), "w5-checkpoint-"));
  try {
    seedFixture(fixture);
    const sourceSha = git(fixture, "rev-parse", "HEAD");
    const committedTools = execFileSync("git", ["show", "HEAD:src/tools.ts"], { cwd: fixture, encoding: "utf8" });
    const committedExecutor = execFileSync("git", ["show", "HEAD:src/executor.ts"], { cwd: fixture, encoding: "utf8" });
    appendFileSync(join(fixture, "src/tools.ts"), "\n// uncommitted parent-only marker\n");
    const dirtyParentTools = readFileSync(join(fixture, "src/tools.ts"), "utf8");
    for (const id of ["start", "core-2", "core-3"]) {
      const result = spawnSync(process.execPath, [join(fixture, "scripts/checkpoint.mjs"), id], { cwd: fixture, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const dir = join(fixture, ".lab", "checkpoints", id);
      const marker = readFileSync(join(dir, "CHECKPOINT.md"), "utf8");
      assert.match(marker, new RegExp(`Source commit: ${sourceSha}`));
      const tools = readFileSync(join(dir, "src/tools.ts"), "utf8");
      const executor = readFileSync(join(dir, "src/executor.ts"), "utf8");
      if (id === "core-3") {
        assert.doesNotMatch(tools, /TODO\(A5\)/);
        assert.doesNotMatch(executor, /TODO\(A8\)/);
        assert.equal(tools, committedTools);
        assert.equal(executor, committedExecutor);
      } else if (id === "core-2") {
        assert.equal(tools, committedTools);
        assert.equal((executor.match(/TODO\(A8\)/g) ?? []).length, 1);
        assert.match(executor, /fail\(\["TODO\(A8\): rebuild the named human approval gate before execution"\]\)/);
        assertFailClosedA8(executor);
      } else {
        assert.equal((tools.match(/TODO\(A5\)/g) ?? []).length, 1);
        assert.doesNotMatch(tools, /uncommitted parent-only marker/);
        assert.match(tools, /TODO\(A5\): restore the read-only handler binding/);
        assert.match(tools, /tool\(\s*"list_deploys"/);
        const probe = join(dir, "probe-mcp.mjs");
        writeFileSync(probe, `
          import assert from "node:assert/strict";
          import { Client } from "@modelcontextprotocol/sdk/client/index.js";
          import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
          import { createTelemetryServer } from ${JSON.stringify(pathToFileURL(join(dir, "src", "tools.ts")).href)};
          const config = createTelemetryServer({ service: "checkout", logs: [], metrics: [], deploys: [] });
          const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
          await config.instance.connect(serverTransport);
          const client = new Client({ name: "checkpoint-test", version: "1.0.0" });
          await client.connect(clientTransport);
          const listed = await client.listTools();
          assert.ok(listed.tools.some((tool) => tool.name === "list_deploys"));
          const result = await client.callTool({ name: "list_deploys", arguments: {} });
          assert.equal(JSON.parse(result.content[0].text).result.length, 0);
          await client.close();
          await config.instance.close();
        `);
        const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
        const probeResult = spawnSync(process.execPath, [tsx, probe], { cwd: dir, encoding: "utf8" });
        assert.equal(probeResult.status, 0, probeResult.stderr || probeResult.stdout);
        const trace = join(dir, "probe-trace.mjs");
        writeFileSync(trace, `
          import assert from "node:assert/strict";
          import { checkTrace } from ${JSON.stringify(pathToFileURL(join(root, "src", "agent.ts")).href)};
          assert.deepEqual(checkTrace([
            { tool: "summarize_metrics", input: {}, output: "{}" },
            { tool: "list_deploys", input: {}, output: "[]" },
          ], ["metrics"]), []);
          assert.match(checkTrace([{ tool: "summarize_metrics", input: {}, output: "{}" }], ["metrics"])[0], /list_deploys/);
        `);
        const traceResult = spawnSync(process.execPath, [tsx, trace], { cwd: dir, encoding: "utf8" });
        assert.equal(traceResult.status, 0, traceResult.stderr || traceResult.stdout);
        assert.equal((executor.match(/TODO\(A8\)/g) ?? []).length, 1);
        assert.match(executor, /fail\(\["TODO\(A8\): rebuild the named human approval gate before execution"\]\)/);
        assertFailClosedA8(executor);
      }
    }
    const nestedStart = join(fixture, ".lab", "checkpoints", "start");
    const nestedResult = spawnSync(process.execPath, [join(nestedStart, "scripts/checkpoint.mjs"), "core-2"], {
      cwd: nestedStart, encoding: "utf8",
    });
    assert.equal(nestedResult.status, 0, nestedResult.stderr);
    const nestedCore2 = join(nestedStart, ".lab", "checkpoints", "core-2");
    assert.match(readFileSync(join(nestedCore2, "CHECKPOINT.md"), "utf8"), new RegExp(`Source commit: ${sourceSha}`));
    assert.equal(readFileSync(join(nestedCore2, "src/tools.ts"), "utf8"), committedTools);
    assert.equal((readFileSync(join(nestedCore2, "src/executor.ts"), "utf8").match(/TODO\(A8\)/g) ?? []).length, 1);
    const checkpointTools = join(fixture, ".lab", "checkpoints", "start", "src", "tools.ts");
    appendFileSync(checkpointTools, "\n// participant checkpoint edit\n");
    const retainedEdit = readFileSync(checkpointTools, "utf8");
    const repeat = spawnSync(process.execPath, [join(fixture, "scripts/checkpoint.mjs"), "start"], { cwd: fixture, encoding: "utf8" });
    assert.equal(repeat.status, 1);
    assert.match(repeat.stderr, /Refusing to overwrite/);
    assert.equal(readFileSync(checkpointTools, "utf8"), retainedEdit);
    assert.equal(readFileSync(join(fixture, "src/tools.ts"), "utf8"), dirtyParentTools);
    assert.equal(readFileSync(join(fixture, "src/executor.ts"), "utf8"), committedExecutor);
    assert.equal(git(fixture, "status", "--porcelain"), "M src/tools.ts\n?? .lab/");
    assert.equal(git(fixture, "rev-parse", "HEAD"), sourceSha);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("the human starter baseline yields a nonempty repair diff", () => {
  const fixture = mkdtempSync(join(tmpdir(), "w5-checkpoint-baseline-"));
  try {
    seedFixture(fixture);
    const solvedSha = git(fixture, "rev-parse", "HEAD");
    const checkpoint = join(fixture, ".lab", "checkpoints", "start");
    const created = spawnSync(process.execPath, [join(fixture, "scripts/checkpoint.mjs"), "start"], {
      cwd: fixture, encoding: "utf8",
    });
    assert.equal(created.status, 0, created.stderr);

    git(checkpoint, "switch", "-c", "workshop-base");
    git(checkpoint, "add", "src/tools.ts", "src/executor.ts");
    assert.deepEqual(
      git(checkpoint, "diff", "--cached", "--name-only").split("\n").sort(),
      ["src/executor.ts", "src/tools.ts"],
    );
    git(checkpoint, "commit", "-m", "Set workshop exercise baseline");
    git(checkpoint, "switch", "-c", "fix/w5-core");
    git(checkpoint, "restore", "--source", solvedSha, "--", "src/tools.ts", "src/executor.ts");

    const repairDiff = git(checkpoint, "diff", "workshop-base", "--", "src/tools.ts", "src/executor.ts");
    assert.ok(repairDiff.length > 0);
    assert.deepEqual(
      git(checkpoint, "diff", "--name-only", "workshop-base", "--", "src/tools.ts", "src/executor.ts").split("\n").sort(),
      ["src/executor.ts", "src/tools.ts"],
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test("checkpoint rejects malformed committed sources before creating any worktree", () => {
  for (const [corruptFile, expectedError] of [
    ["src/tools.ts", /does not match the expected single A5 handler and registration shape/],
    ["src/executor.ts", /does not contain the solved A8 gate/],
  ]) {
    const fixture = mkdtempSync(join(tmpdir(), "w5-checkpoint-invalid-"));
    try {
      seedFixture(fixture, corruptFile);
      const result = spawnSync(process.execPath, [join(fixture, "scripts/checkpoint.mjs"), "start"], { cwd: fixture, encoding: "utf8" });
      assert.equal(result.status, 1);
      assert.match(result.stderr, expectedError);
      assert.equal(existsSync(join(fixture, ".lab")), false);
      assert.equal(git(fixture, "worktree", "list", "--porcelain").split("\n").filter((line) => line.startsWith("worktree ")).length, 1);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  }
});
