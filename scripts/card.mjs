#!/usr/bin/env node
/**
 * scripts/card.mjs — workshop.json → CARD.md + hub/index.html
 * ---------------------------------------------------------------------------
 *   npm run card          write both files
 *   npm run card:check    fail when either file is out of date (CI)
 *
 * One source, two views: the card for GitHub, the terminal and agents; the hub
 * for the room (served by the console at http://127.0.0.1:4320/hub, with the
 * live next step of the open incident).
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const w = JSON.parse(readFileSync("workshop.json", "utf8"));
// Commands are marked with backticks in workshop.json; markdown keeps them, HTML turns them into <code>.
const cmd = (s) => s;

// ── CARD.md ──────────────────────────────────────────────────────────────
const md = [];
md.push(`# Participant card · ${w.title}`, "");
md.push("> Generated from `workshop.json` by `npm run card`. Do not edit by hand.", "");
md.push("The slides explain. This card is for doing. Each step says what you do, what you should see, how you check it, and what to do when you are stuck.", "");
md.push("## Start", "", w.start.say, "", "```bash", ...w.start.do, "```", "");
md.push(`- **See:** ${w.start.see}`, `- **Check:** ${cmd(w.start.check)}`, "- **Stuck?**");
for (const [p, f] of w.start.stuck) md.push(`  - ${p}: ${cmd(f)}`);
md.push("");
w.cores.forEach((c, i) => {
  md.push(`## Core ${i + 1} · ${c.name}`, "", `**Goal:** ${c.goal}`, "", `Slides: ${c.slides}. Replaces ${c.replaces.join(" + ")}.`, "");
  c.steps.forEach((s, j) => {
    md.push(`### ${i + 1}.${j + 1} ${cmd(s.do)}`, "", `- **See:** ${cmd(s.see)}`, `- **Check:** ${cmd(s.check)}`, `- **Stuck?** ${cmd(s.stuck)}`, "");
  });
});
md.push("## Go deeper (optional)", "", "| # | Task | Do |", "| --- | --- | --- |");
for (const d of w.deeper) md.push(`| ${d.id} | ${d.name} | ${cmd(d.do)} |`);
md.push("", "## Behind? Catch up without losing your work", "", cmd(w.catchUp), "", "| Checkpoint | Contains |", "| --- | --- |");
for (const c of w.checkpoints) md.push(`| \`${c.id}\` | ${c.say} |`);
md.push("", "## Where everything is", "");
for (const [role, list] of Object.entries(w.links)) md.push(`- **${role[0].toUpperCase() + role.slice(1)}:** ${list.map(([n, h]) => `[${n}](${h})`).join(" · ")}`);
md.push("");

// ── hub/index.html ───────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const code = (s) => esc(cmd(s)).replace(/`([^`]+)`/g, "<code>$1</code>");
const link = ([n, h]) => (h.startsWith("http") || h.startsWith("course/") ? `<a href="${esc(h.startsWith("course/") ? "/" + h : h)}">${esc(n)}</a>` : `${esc(n)} <code>${esc(h)}</code>`);
const step = (s, n) => `<li class="step"><div class="n">${n}</div><div><p class="do">${code(s.do)}</p><dl><dt>See</dt><dd>${code(s.see)}</dd><dt>Check</dt><dd>${code(s.check)}</dd><dt>Stuck?</dt><dd>${code(s.stuck)}</dd></dl></div></li>`;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Workshop 5 hub</title>
<!-- Generated from workshop.json by npm run card. Do not edit by hand. -->
<style>
:root{--bg:#fafaf9;--card:#fff;--line:#e7e5e4;--text:#1c1917;--muted:#78716c;--accent:#b91c1c;--ok:#2f6b46;--okbg:#eef6f0;--warnbg:#fff7ed;--warn:#b45309;--code:#f5f5f4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#1c1917;--card:#292524;--line:#44403c;--text:#f5f5f4;--muted:#a8a29e;--accent:#f87171;--ok:#86efac;--okbg:#14301f;--warnbg:#3b2510;--warn:#fbbf24;--code:#1c1917}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:16px/1.55 -apple-system,"Segoe UI",Inter,sans-serif}
main{max-width:980px;margin:0 auto;padding:28px 16px 64px}
h1{font-size:28px;margin:0 0 4px}h2{font-size:21px;margin:36px 0 10px}.sub{color:var(--muted);margin:0 0 18px}
code{font:13.5px ui-monospace,Menlo,monospace;background:var(--code);border:1px solid var(--line);border-radius:5px;padding:1px 5px;overflow-wrap:anywhere}
nav{display:flex;gap:8px;flex-wrap:wrap;position:sticky;top:0;background:var(--bg);padding:10px 0;border-bottom:1px solid var(--line);z-index:1}
nav a{color:var(--text);text-decoration:none;border:1px solid var(--line);background:var(--card);border-radius:999px;padding:5px 12px;font-size:14px}nav a:hover{border-color:var(--accent)}
.live{border:2px solid var(--line);border-radius:12px;padding:12px 16px;background:var(--card);margin:16px 0}.live.on{border-color:var(--ok)}.live h3{margin:0;font-size:16px}.live p{margin:4px 0 0;color:var(--muted);font-size:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:12px 0}
.goal{margin:0 0 6px}.meta{color:var(--muted);font-size:14px;margin:0 0 12px}
ol.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px}
.step{display:grid;grid-template-columns:40px 1fr;gap:12px}.n{font-weight:700;color:var(--accent);font-size:15px;padding-top:2px}
.do{margin:0 0 6px;font-weight:600}dl{display:grid;grid-template-columns:72px 1fr;gap:4px 12px;margin:0;font-size:15px}dt{color:var(--muted)}dd{margin:0}
pre{background:var(--code);border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow:auto}
table{border-collapse:collapse;width:100%;font-size:15px}td,th{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
.roles{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.roles ul{margin:6px 0 0;padding-left:18px}
a{color:var(--accent)}
@media (max-width:600px){.step{grid-template-columns:28px 1fr}dl{grid-template-columns:1fr}dt{margin-top:4px}}
</style>
</head>
<body>
<main>
<h1>${esc(w.title)}</h1>
<p class="sub">The slides explain. This page is for doing. Three core tasks; everything else is optional depth.</p>
<nav><a href="#start">Start</a>${w.cores.map((c, i) => `<a href="#${c.id}">Core ${i + 1} · ${esc(c.name)}</a>`).join("")}<a href="#deeper">Go deeper</a><a href="#catchup">Catch up</a><a href="#where">Where is what</a></nav>
<div class="live" id="live"><h3>Lab status</h3><p>Open this page from the console (<code>http://127.0.0.1:4320/hub</code>) to see the live next step.</p></div>
<h2 id="start">Start</h2>
<div class="card"><p class="goal">${esc(w.start.say)}</p><pre>${w.start.do.map(esc).join("\n")}</pre>
<dl><dt>See</dt><dd>${code(w.start.see)}</dd><dt>Check</dt><dd>${code(w.start.check)}</dd><dt>Stuck?</dt><dd>${w.start.stuck.map(([p, f]) => `<b>${esc(p)}.</b> ${code(f)}`).join("<br>")}</dd></dl></div>
${w.cores.map((c, i) => `<h2 id="${c.id}">Core ${i + 1} · ${esc(c.name)}</h2>
<div class="card"><p class="goal"><b>Goal:</b> ${esc(c.goal)}</p><p class="meta">Slides: ${esc(c.slides)} · replaces ${c.replaces.join(" + ")}</p>
<ol class="steps">${c.steps.map((s, j) => step(s, `${i + 1}.${j + 1}`)).join("")}</ol></div>`).join("\n")}
<h2 id="deeper">Go deeper (optional)</h2>
<div class="card"><table><tr><th>#</th><th>Task</th><th>Do</th></tr>${w.deeper.map((d) => `<tr><td>${d.id}</td><td>${esc(d.name)}</td><td>${code(d.do)}</td></tr>`).join("")}</table></div>
<h2 id="catchup">Behind? Catch up without losing your work</h2>
<div class="card"><p>${code(w.catchUp)}</p><table><tr><th>Checkpoint</th><th>Contains</th></tr>${w.checkpoints.map((c) => `<tr><td><code>${c.id}</code></td><td>${esc(c.say)}</td></tr>`).join("")}</table></div>
<h2 id="where">Where is what</h2>
<div class="roles">${Object.entries(w.links).map(([r, l]) => `<div class="card"><b>${r[0].toUpperCase() + r.slice(1)}</b><ul>${l.map((x) => `<li>${link(x)}</li>`).join("")}</ul></div>`).join("")}</div>
</main>
<script>
// Live status, only when served by the console. Reads the same next step the console enforces.
(async () => {
  const el = document.getElementById("live");
  try {
    const h = await (await fetch("/api/health")).json();
    const list = await (await fetch("/api/incidents")).json();
    const open = list.find((i) => i.state !== "resolved");
    let text = "No open incident. Break the shop when you are ready: npm run chaos -- deploy v2.15.0 --mode bad-deploy";
    let title = "Lab running · shop " + (h.shop ? h.shop.revision + " " + h.shop.mode : "not reachable");
    if (open) { const r = await (await fetch("/api/incidents/" + open.id)).json(); text = open.id + " · next: " + r.next.title + ". " + r.next.detail; }
    el.className = "live on"; el.innerHTML = "<h3></h3><p></p><p><a href='/'>Open the console →</a></p>";
    el.querySelector("h3").textContent = title; el.querySelector("p").textContent = text;
  } catch { /* opened as a file: keep the static hint */ }
})();
</script>
</body>
</html>
`;

const outputs = [["CARD.md", md.join("\n")], ["hub/index.html", html]];
if (process.argv.includes("--check")) {
  const stale = outputs.filter(([p, s]) => { try { return readFileSync(p, "utf8") !== s; } catch { return true; } });
  if (stale.length) { console.error(`out of date: ${stale.map(([p]) => p).join(", ")}. Run npm run card.`); process.exit(1); }
  console.log("CARD.md and hub/index.html are up to date.");
} else {
  mkdirSync("hub", { recursive: true });
  for (const [p, s] of outputs) writeFileSync(p, s);
  console.log("Wrote CARD.md and hub/index.html from workshop.json.");
}
