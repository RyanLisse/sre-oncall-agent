import { mkdir } from "node:fs/promises";
import { userInfo } from "node:os";
import { dirname } from "node:path";
import { assertRun, pause, prepareDemoData, runTsx, startTsx, step, stopChildren, waitForHealth } from "./runner.js";

const mode = process.argv[2] ?? "bad-deploy";
const how = process.argv[3] ?? "deploy";
const port = Number(process.env.AGENT_SHOP_PORT ?? 4310);
const dataDir = process.env.AGENT_DEMO_DATA ?? "demo/data";
const baselineSeconds = Number(process.env.BASELINE_S ?? 40);
const faultSeconds = Number(process.env.FAULT_S ?? 30);
const recoverSeconds = Number(process.env.RECOVER_S ?? 25);
const shopUrl = `http://localhost:${port}`;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  AGENT_SHOP_PORT: String(port),
  AGENT_SHOP_URL: shopUrl,
  AGENT_DEMO_DATA: dataDir,
};
const runDir = `demo/incidents/run-${Date.now()}-${process.pid}`;
const liveFile = `${runDir}/live.json`;
const afterFile = `${runDir}/after.json`;

const operatorName = (): string => {
  try {
    return userInfo().username;
  } catch {
    return "local operator";
  }
};

const validate = (): void => {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("AGENT_SHOP_PORT must be a port from 1 to 65535");
  for (const [name, value] of [["BASELINE_S", baselineSeconds], ["FAULT_S", faultSeconds], ["RECOVER_S", recoverSeconds]] as const) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number`);
  }
  if (!["bad-deploy", "slow", "errors"].includes(mode)) throw new Error(`unsupported demo mode: ${mode}`);
  if (how !== "deploy" && how !== "degrade") throw new Error(`unsupported demo path: ${how}`);
};

const main = async (): Promise<number> => {
  try {
    validate();
    await prepareDemoData(dataDir);
    await mkdir(dirname(liveFile), { recursive: true });
    step("1/7 shop + traffic");
    const shop = await startTsx(["demo/shop.ts"], `${dataDir}/shop.log`, env);
    if (!(await pause(1))) throw new Error("interrupted");
    const traffic = await startTsx(["demo/chaos.ts", "traffic", "--rps", "15"], `${dataDir}/traffic.log`, env);
    if (!(await pause(1))) throw new Error("interrupted");
    const health = await waitForHealth(shopUrl);
    if (!health || shop.exitCode !== null || traffic.exitCode !== null) {
      throw new Error(`shop did not start at ${shopUrl}; see ${dataDir}/shop.log`);
    }
    console.log(JSON.stringify(health));

    step(`2/7 healthy baseline (${baselineSeconds}s)`);
    if (!(await pause(baselineSeconds))) throw new Error("interrupted");

    if (how === "degrade") {
      step(`3/7 inject fault: degrade to ${mode} (no deploy record)`);
      const result = await runTsx(["demo/chaos.ts", "degrade", "--mode", mode], { env });
      assertRun(result, "chaos degrade");
    } else {
      step(`3/7 inject fault: deploy v2.15.0 in mode ${mode}`);
      const result = await runTsx(["demo/chaos.ts", "deploy", "v2.15.0", "--mode", mode], { env });
      assertRun(result, "chaos deploy");
    }
    if (!(await pause(faultSeconds))) throw new Error("interrupted");

    step("4/7 alert fires → investigate");
    const alert =
      mode === "bad-deploy"
        ? "Error rate 12% for 5 min on checkout (threshold 2%)"
        : mode === "slow"
          ? "p95 latency 3000 ms for 5 min on checkout (threshold 2000 ms)"
          : "Error rate 5% for 5 min on checkout (threshold 2%)";
    let result = await runTsx(["src/ops.ts", "live", "--alert", alert, "--out", liveFile], { env });
    assertRun(result, "ops live");
    result = await runTsx(["src/cli.ts", liveFile], { env, output: "diagnosis" });
    assertRun(result, "investigate");

    step("5/7 executor without approval");
    await runTsx(["src/ops.ts", "execute", liveFile], { env, output: "quiet" });

    step(`6/7 approve as ${operatorName()}, then execute`);
    result = await runTsx(["src/cli.ts", "--approve", liveFile, "--by", operatorName()], {
      env,
      output: "first-two",
    });
    assertRun(result, "approve");
    const fixAt = new Date().toISOString();
    result = await runTsx(["src/ops.ts", "execute", liveFile], { env });
    if (result.code === 0) {
      step(`7/7 watch it land (${recoverSeconds}s of recovery first)`);
      if (!(await pause(recoverSeconds))) throw new Error("interrupted");
      result = await runTsx(["src/ops.ts", "live", "--alert", "post-fix snapshot", "--out", afterFile], {
        env,
        output: "quiet",
      });
      assertRun(result, "post-fix snapshot");
      result = await runTsx(
        ["src/cli.ts", "--watch", liveFile, "--metric", "error_rate", "--fix-at", fixAt, "--after", afterFile.replace(/\.json$/, ".telemetry.json")],
        { env },
      );
      assertRun(result, "watch");
    } else {
      step("7/7 executor refused. A human takes the proposed action by hand.");
    }

    console.log(`\nartefacts: ${runDir}/ · approvals/ · lessons/proposed/ · ${dataDir}/shop.log · ${dataDir}/traffic.log`);
    return 0;
  } catch (error) {
    console.error(`FAIL demo: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await stopChildren();
  }
};

main().then((code) => {
  process.exitCode = code;
});
