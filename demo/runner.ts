import { createWriteStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = createRequire(import.meta.url).resolve("tsx/cli");
const active = new Set<ChildProcess>();
const closed = new WeakSet<ChildProcess>();
const shutdown = new AbortController();
const output = (stream: NodeJS.WriteStream, text: string): void => {
  if (text) stream.write(text);
};

const exited = (child: ChildProcess): boolean =>
  closed.has(child) || child.exitCode !== null || child.signalCode !== null;

const terminate = (child: ChildProcess, force = false): void => {
  if (exited(child) || child.pid === undefined) return;
  if (process.platform === "win32") {
    child.kill();
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    return;
  }
  try {
    process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM");
  } catch {
    child.kill(force ? "SIGKILL" : "SIGTERM");
  }
};

const track = (child: ChildProcess): void => {
  active.add(child);
  child.once("close", () => {
    closed.add(child);
    active.delete(child);
  });
  child.on("error", () => undefined);
  if (shutdown.signal.aborted) terminate(child);
};

const waitForClose = (child: ChildProcess): Promise<void> =>
  exited(child)
    ? Promise.resolve()
    : new Promise((resolveClose) => child.once("close", () => resolveClose()));

export const stopChildren = async (): Promise<void> => {
  const children = [...active];
  for (const child of children) terminate(child);
  await Promise.all(
    children.map(async (child) => {
      await Promise.race([waitForClose(child), new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 2000))]);
      if (!exited(child)) {
        terminate(child, true);
        await waitForClose(child);
      }
    }),
  );
};

const stopOnSignal = (): void => {
  shutdown.abort();
  void stopChildren();
};

process.once("SIGINT", stopOnSignal);
process.once("SIGTERM", stopOnSignal);
process.on("exit", () => {
  for (const child of active) terminate(child, true);
});

export const pause = (seconds: number): Promise<boolean> =>
  new Promise((resolvePause) => {
    if (shutdown.signal.aborted) {
      resolvePause(false);
      return;
    }
    const timer = setTimeout(() => {
      shutdown.signal.removeEventListener("abort", onAbort);
      resolvePause(true);
    }, Math.max(0, seconds * 1000));
    const onAbort = (): void => {
      clearTimeout(timer);
      shutdown.signal.removeEventListener("abort", onAbort);
      resolvePause(false);
    };
    shutdown.signal.addEventListener("abort", onAbort, { once: true });
  });

export const runTsx = (
  args: readonly string[],
  options: { readonly env?: NodeJS.ProcessEnv; readonly output?: "stream" | "diagnosis" | "first-two" | "quiet" } = {},
): Promise<{ readonly code: number | null; readonly stdout: string; readonly stderr: string }> =>
  new Promise((resolveRun) => {
    const mode = options.output ?? "stream";
    const child = spawn(process.execPath, [tsxCli, ...args], {
      cwd: root,
      env: options.env ?? process.env,
      detached: process.platform !== "win32",
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: true,
    });
    track(child);
    let stdout = "";
    let stderr = "";
    let spawnError: string | undefined;
    const onAbort = (): void => terminate(child);
    shutdown.signal.addEventListener("abort", onAbort, { once: true });
    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (mode === "stream") output(process.stdout, text);
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (mode === "stream") output(process.stderr, text);
    });
    child.once("error", (error) => {
      spawnError = error.message;
    });
    child.once("close", (code) => {
      shutdown.signal.removeEventListener("abort", onAbort);
      if (mode !== "stream") {
        if (code === 0 && mode === "diagnosis") {
          const start = stdout.indexOf("── diagnosis");
          output(process.stdout, start < 0 ? stdout : stdout.slice(start));
        } else if (code === 0 && mode === "first-two") {
          output(process.stdout, `${stdout.split(/\r?\n/).slice(0, 2).join("\n")}\n`);
        } else if (code !== 0) {
          output(process.stdout, stdout);
          output(process.stderr, stderr);
        }
      }
      if (spawnError) output(process.stderr, `${spawnError}\n`);
      resolveRun({ code, stdout, stderr: spawnError ? `${stderr}${spawnError}` : stderr });
    });
  });

export const startTsx = async (
  args: readonly string[],
  logPath: string,
  env: NodeJS.ProcessEnv,
): Promise<ChildProcess> => {
  await mkdir(dirname(logPath), { recursive: true });
  const log = createWriteStream(logPath, { flags: "a" });
  const child = spawn(process.execPath, [tsxCli, ...args], {
    cwd: root,
    env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  track(child);
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  child.once("close", () => log.end());
  child.once("error", (error) => log.write(`${error.message}\n`));
  return child;
};

export const waitForHealth = async (url: string): Promise<unknown | undefined> => {
  for (let attempt = 0; attempt < 40 && !shutdown.signal.aborted; attempt++) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) return await response.json();
    } catch {
      // The shop may still be starting.
    }
    if (!(await pause(0.25))) return undefined;
  }
  return undefined;
};

export const prepareDemoData = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
  for (const name of ["telemetry.json", "shop.log", "traffic.log", "inject.log"]) {
    await rm(resolve(path, name), { force: true });
  }
};

export const step = (text: string): void => console.log(`\n── ${text}`);

export const assertRun = (
  result: { readonly code: number | null; readonly stderr: string },
  command: string,
): void => {
  if (result.code !== 0) {
    throw new Error(`${command} exited with ${result.code ?? "a signal"}${result.stderr ? `\n${result.stderr}` : ""}`);
  }
};
