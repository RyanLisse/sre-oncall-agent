#!/usr/bin/env node
/**
 * scripts/hub.mjs — open the workshop hub
 *   npm run hub   → http://localhost:4320/hub when the lab runs (with the live next step),
 *                   otherwise the static hub/index.html file.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const port = process.env.AGENT_CONSOLE_PORT ?? "4320";
const live = await fetch(`http://localhost:${port}/api/health`).then((r) => r.ok, () => false);
const url = live ? `http://localhost:${port}/hub` : pathToFileURL(resolve("hub/index.html")).href;
console.log(`▶ hub ${url}${live ? "" : "  (static: start the lab with npm start for the live next step)"}`);
const opener = { darwin: ["open"], win32: ["cmd", "/c", "start", ""] }[process.platform] ?? ["xdg-open"];
spawn(opener[0], [...opener.slice(1), url], { stdio: "ignore", detached: true }).on("error", () => {}).unref();
