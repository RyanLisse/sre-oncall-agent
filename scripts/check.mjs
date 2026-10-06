import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";
const steps = [
  { name: "typecheck", args: ["run", "typecheck"] },
  { name: "tests", args: ["test"] },
  { name: "bench", args: ["run", "bench"] },
  { name: "course check", args: ["run", "course:check"] },
  {
    name: "bad-deploy dry run",
    args: ["run", "investigate", "--", "fixtures/incidents/bad-deploy.json", "--dry-run"],
  },
  {
    name: "adversarial dry run",
    args: ["run", "investigate", "--", "fixtures/incidents/adversarial.json", "--dry-run"],
  },
];

for (const step of steps) {
  console.log(`\n▶ ${step.name}`);
  const result = spawnSync(npm, step.args, {
    stdio: "inherit",
    shell: isWindows,
  });
  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? `exit code ${result.status ?? `signal ${result.signal}`}`;
    console.error(`FAIL check · ${step.name}: ${reason}`);
    process.exit(1);
  }
  console.log(`PASS ${step.name}`);
}

console.log("PASS check");
