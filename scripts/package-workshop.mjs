import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const usage = () => {
  console.log(`Build the offline Workshop 5 participant packages.

Usage:
  npm run workshop:pack -- --output <new-directory>
  npm run workshop:pack -- --help

The command requires Git, reads committed HEAD only, and refuses a relevant
dirty worktree or an existing destination. It writes starter.zip (the bounded
A5 list_deploys exercise), checkpoint.zip (the solved HEAD), and manifest.json
with the source commit and each archive's SHA-256. Each archive has its own
starter/ or checkpoint/ root folder. Participants do not need Git to use an
archive; npm start is optional local launcher tooling.`);
};

const fail = (message) => {
  throw new Error(message);
};

const parseArgs = (args) => {
  let output;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--output") {
      output = args[++i];
      if (!output || output.startsWith("-")) fail("--output needs a new destination directory. Run npm run workshop:pack -- --help.");
      continue;
    }
    fail(`Unknown option "${arg}". Run npm run workshop:pack -- --help.`);
  }
  if (!output) fail("Pass a new destination with --output <dir>. Run npm run workshop:pack -- --help.");
  return { help: false, output };
};

const git = (root, args, env = {}) => {
  const result = spawnSync("git", args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error) fail(`Git is required for workshop packaging: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || "unknown Git error").trim();
    fail(`Git ${args.join(" ")} failed: ${detail}`);
  }
  return result.stdout.trimEnd();
};

const archiveExcluded = (path) =>
  path === "PROGRESS.md" ||
  path.startsWith("node_modules/") ||
  path.startsWith("console/data/") ||
  path.startsWith("demo/data/") ||
  path.startsWith("demo/incidents/") ||
  path.startsWith("approvals/") ||
  path.startsWith("lessons/") ||
  path === ".env" ||
  path.startsWith(".env.") ||
  path.startsWith(".lab/") ||
  path.endsWith(".log");

const dirtyRelevantPaths = (root) => {
  const status = git(root, ["status", "--porcelain=v1", "--untracked-files=all", "-z"]);
  const entries = status.split("\0");
  const paths = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry) continue;
    const code = entry.slice(0, 2);
    paths.push(entry.slice(3).replaceAll("\\", "/"));
    if (code.includes("R") || code.includes("C")) {
      const original = entries[i + 1];
      if (original) {
        paths.push(original.replaceAll("\\", "/"));
        i += 1;
      }
    }
  }
  return paths.filter((path) => !archiveExcluded(path));
};

const trackedPaths = (root) => git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);

const countExact = (source, needle) => {
  let count = 0;
  let from = 0;
  while (true) {
    const at = source.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
};

const starterTools = (source) => {
  const handler = `  list_deploys: (args: { since?: string | undefined; until?: string | undefined }) =>
    listDeploys(t, args.since, args.until),`;
  const registration = `      tool(
        "list_deploys",
        "List deploys in a window, newest first: id, version, time, author, summary. Cite results as deploys:<id>.",
        {
          since: z.string().optional(),
          until: z.string().optional(),
        },
        async (args) => text(withRepro("list_deploys", args, h.list_deploys(args))),
      ),`;
  if (countExact(source, handler) !== 1 || countExact(source, registration) !== 1) {
    fail("src/tools.ts does not match the expected A5 source shape; starter transformation was not applied.");
  }
  return source
    .replace(handler, `  // TODO(A5): bind listDeploys(t, args.since, args.until)\n  list_deploys: (_args: { since?: string | undefined; until?: string | undefined }) => [] as ReturnType<typeof listDeploys>,`)
    .replace(registration, `      // TODO(A5): register tool("list_deploys", …) here`);
};

const packageGuide = (kind, sha) => `# Workshop 5 package: ${kind === "starter" ? "STARTER" : "CHECKPOINT (SOLVED)"}

This archive is the **${kind}** Workshop 5 package.

- Package label: **${kind === "starter" ? "STARTER" : "CHECKPOINT (SOLVED)"}**.
- Source: committed \`HEAD\` at \`${sha}\`.
- The ${kind} package keeps the read-only investigation controls and human-gated recovery flow intact.
- ${kind === "starter" ? "The bounded A5 exercise leaves the list_deploys handler as [] and removes its MCP registration; learners implement both halves." : "The checkpoint contains the complete solved source from HEAD."}
- \`npm start\` is optional local launcher tooling for the offline shop, traffic, and console rehearsal. It never approves, executes, or closes an incident.
- No Git installation is required to use this package. Follow the included guides and install Node 22+ dependencies with npm when needed.

Runtime data, approvals, human records, lesson history, \`.env\`, \`node_modules\`, and inherited progress state are intentionally excluded.
`;

const writeBlob = (root, env, path, text) => {
  const file = join(mkdtempSync(join(tmpdir(), "workshop-package-")), basename(path));
  writeFileSync(file, text);
  try {
    return git(root, ["hash-object", "-w", file], env);
  } finally {
    rmSync(dirname(file), { recursive: true, force: true });
  }
};

const archiveKind = (root, destination, sha, kind, toolsSource, indexDir) => {
  const index = join(indexDir, `${kind}.index`);
  const env = { GIT_INDEX_FILE: index };
  git(root, ["read-tree", "HEAD"], env);
  const excluded = trackedPaths(root).filter(archiveExcluded);
  if (excluded.length) git(root, ["update-index", "--force-remove", "--", ...excluded], env);
  if (kind === "starter") {
    const blob = writeBlob(root, env, "src/tools.ts", toolsSource);
    git(root, ["update-index", "--add", "--cacheinfo", `100644,${blob},src/tools.ts`], env);
  }
  const guideBlob = writeBlob(root, env, "WORKSHOP-PACKAGE.md", packageGuide(kind, sha));
  git(root, ["update-index", "--add", "--cacheinfo", `100644,${guideBlob},WORKSHOP-PACKAGE.md`], env);
  const tree = git(root, ["write-tree"], env);
  git(root, ["archive", "--format=zip", `--prefix=${kind}/`, `--output=${join(destination, `${kind}.zip`)}`, tree], env);
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }
  const root = resolve(git(process.cwd(), ["rev-parse", "--show-toplevel"]));
  const destination = resolve(process.cwd(), options.output);
  if (existsSync(destination)) fail(`Destination already exists: ${destination}. Choose a new directory; existing packages are never overwritten.`);
  const dirty = dirtyRelevantPaths(root);
  if (dirty.length) fail(`Relevant files are dirty: ${dirty.join(", ")}. Commit them before packaging; packages are built from HEAD only.`);
  const sha = git(root, ["rev-parse", "HEAD"]);
  const source = git(root, ["show", "HEAD:src/tools.ts"]);
  const transformed = starterTools(source);
  mkdirSync(destination, { recursive: true });
  const indexDir = mkdtempSync(join(tmpdir(), "workshop-index-"));
  try {
    archiveKind(root, destination, sha, "starter", transformed, indexDir);
    archiveKind(root, destination, sha, "checkpoint", source, indexDir);
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
  const archives = ["starter", "checkpoint"].map((kind) => {
    const name = `${kind}.zip`;
    const digest = createHash("sha256").update(readFileSync(join(destination, name))).digest("hex");
    return { name, kind, sha256: digest };
  });
  writeFileSync(join(destination, "manifest.json"), `${JSON.stringify({ sourceCommit: sha, archives }, null, 2)}\n`);
  console.log(`Wrote starter.zip and checkpoint.zip to ${destination}`);
  console.log(`Source HEAD: ${sha}`);
};

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
