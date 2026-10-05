import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { assertRun, pause, prepareDemoData, runTsx, startTsx, step, stopChildren, waitForHealth } from "./runner.js";

const port = Number(process.env.AGENT_SHOP_PORT ?? 4310);
const dataDir = process.env.AGENT_DEMO_DATA ?? "demo/data";
const mode = process.env.MODE ?? "bad-deploy";
const injectAfter = Number(process.env.INJECT_AFTER_S ?? 8);
const shopUrl = `http://localhost:${port}`;
const env: NodeJS.ProcessEnv = {
  ...process.env,
  AGENT_SHOP_PORT: String(port),
  AGENT_SHOP_URL: shopUrl,
  AGENT_DEMO_DATA: dataDir,
  AGENT_WATCH_INTERVAL_MS: process.env.AGENT_WATCH_INTERVAL_MS ?? "1500",
};

const main = async (): Promise<number> => {
  try {
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("AGENT_SHOP_PORT must be a port from 1 to 65535");
    if (!Number.isFinite(injectAfter) || injectAfter < 0) throw new Error("INJECT_AFTER_S must be non-negative");
    await prepareDemoData(dataDir);
    await mkdir(dirname("demo/incidents/watch.json"), { recursive: true });
    step("start shop and traffic");
    const shop = await startTsx(["demo/shop.ts"], `${dataDir}/shop.log`, env);
    if (!(await pause(1))) throw new Error("interrupted");
    const traffic = await startTsx(["demo/chaos.ts", "traffic", "--rps", "15"], `${dataDir}/traffic.log`, env);
    if (!(await pause(3))) throw new Error("interrupted");
    const health = await waitForHealth(shopUrl);
    if (!health || shop.exitCode !== null || traffic.exitCode !== null) {
      throw new Error(`shop did not start at ${shopUrl}; see ${dataDir}/shop.log`);
    }
    console.log(JSON.stringify(health));

    const inject = async (): Promise<void> => {
      if (!(await pause(injectAfter))) throw new Error("interrupted before deployment injection");
      const result = await runTsx(
        ["demo/chaos.ts", "deploy", "v2.16.0", "--mode", mode],
        { env, output: "quiet" },
      );
      assertRun(result, "chaos deploy");
      console.log(`▶ injected v2.16.0 in mode ${mode}`);
    };
    const watch = runTsx(
      [
        "src/ops.ts",
        "watch-deploy",
        "Watch the next deployment for one minute. Check checkout success, errors and latency. Investigate any regression and ask me before rolling back.",
      ],
      { env },
    );
    const [, result] = await Promise.all([inject(), watch]);
    console.log(`watch command exit: ${result.code}`);
    return 0;
  } catch (error) {
    console.error(`FAIL demo:watch: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await stopChildren();
  }
};

main().then((code) => {
  process.exitCode = code;
});
