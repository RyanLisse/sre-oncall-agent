/**
 * console/server.ts — the local on-call console
 * ---------------------------------------------------------------------------
 *   npm run console        → http://localhost:4320
 *
 * One Node process, no framework, no build step:
 *   GET  /                          the UI (console/index.html)
 *   GET  /api/incidents             sidebar
 *   GET  /api/incidents/:id         messages
 *   GET  /api/stream                SSE: every new message, every state change
 *   POST /api/incidents             { title }                     ← "+ New investigation" (human report)
 *   POST /api/incidents/:id/chat    { text }                      ← the chat box (routeMessage)
 *   POST /api/incidents/:id/approve { by }  /reject { by }        ← buttons, named human
 *   POST /api/incidents/:id/execute                               ← the SEPARATE executor
 *   POST /api/incidents/:id/state   { state, by }                 ← mitigated / resolved: human only
 *   POST /api/alerts                { alert, service? }           ← intake path 1: your alerting posts here
 *   GET  /api/health                shop + telemetry + model status
 *
 * Three intake paths, one triage loop (Anthropic's figure): an alert webhook,
 * a human report, a failed deployment watch. All three create an incident
 * and run the same investigate().
 *
 * The LISTENER: every 10 s the console evaluates oncall.md-style criteria on
 * the live telemetry — deterministic, no model — and opens an incident when
 * they trip. "Claude is never the detector."
 */
import { readFile, readFileSync, writeFile } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decide, draftApproval, readApproval, writeApproval } from "../src/approval.js";
import { ask, investigateFromChat, routeMessage } from "../src/chat.js";
import { parseIncident, type Incident } from "../src/contract.js";
import { runWatch } from "../src/deployWatch.js";
import { execute } from "../src/executor.js";
import { nextAction, type Action } from "../src/nextAction.js";
import { appendResolutionLesson, lessonsStore, renderResolutionLesson } from "../src/lessons.js";
import type { Recommendation, Tag } from "../src/contract.js";
import { Store, type IncidentRow } from "../src/store.js";
import { loadTelemetry, summarizeMetrics, type Telemetry } from "../src/telemetry.js";
import { watchMetric } from "../src/watch.js";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.AGENT_CONSOLE_PORT ?? 4320);
const SHOP = process.env.AGENT_SHOP_URL ?? `http://localhost:${process.env.AGENT_SHOP_PORT ?? 4310}`;
const TELEMETRY = process.env.AGENT_TELEMETRY ?? (process.env.AGENT_DEMO_DATA ? `${process.env.AGENT_DEMO_DATA}/telemetry.json` : "demo/data/telemetry.json");
const MODEL = process.env.AGENT_MODEL; // undefined → offline
const APPROVALS = process.env.AGENT_APPROVALS_DIR ?? "approvals";
const store = new Store();

// ── SSE fan-out ──────────────────────────────────────────────────────────
const clients = new Set<ServerResponse>();
const broadcast = (event: string, data: unknown) => {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) c.write(line);
};
const say = (id: string, role: "user" | "agent" | "system", kind: Parameters<Store["add"]>[2], text: string) => {
  const m = store.add(id, role, kind, text);
  broadcast("message", m);
  return m;
};

// ── telemetry ────────────────────────────────────────────────────────────
const telemetry = async (): Promise<Telemetry | undefined> => {
  const t = await loadTelemetry(TELEMETRY);
  return t.ok ? t.value : undefined;
};

/** Snapshot telemetry next to the incident so the investigation is reproducible. */
const incidentFileFor = async (row: IncidentRow, alert: string, t: Telemetry): Promise<{ incident: Incident; telemetry: string; path: string }> => {
  await mkdir("console/data/incidents", { recursive: true });
  const telemetryPath = `console/data/incidents/${row.id}.telemetry.json`;
  const path = `console/data/incidents/${row.id}.json`;
  const incident: Incident = { incident_id: row.id, service: t.service, alert, fired_at: new Date().toISOString() };
  await new Promise<void>((res, rej) => writeFile(telemetryPath, JSON.stringify(t, null, 2), (e) => (e ? rej(e) : res())));
  await new Promise<void>((res, rej) => writeFile(path, JSON.stringify({ incident, telemetry: telemetryPath }, null, 2), (e) => (e ? rej(e) : res())));
  store.setIncidentJson(row.id, JSON.stringify({ incident, telemetry: telemetryPath }));
  return { incident, telemetry: telemetryPath, path };
};

const loadIncident = (row: IncidentRow): { incident: Incident; telemetry: string } | undefined => {
  if (!row.incident_json) return undefined;
  const j = JSON.parse(row.incident_json) as { incident: unknown; telemetry: string };
  const p = parseIncident(j.incident);
  return p.ok ? { incident: p.value, telemetry: j.telemetry } : undefined;
};

// ── the triage loop (shared by all three intake paths) ───────────────────
const triage = async (row: IncidentRow, alert: string) => {
  const t = await telemetry();
  if (!t) { say(row.id, "system", "error", `no telemetry at ${TELEMETRY} — start the shop (npm run shop) or set AGENT_TELEMETRY`); return; }
  const file = await incidentFileFor(row, alert, t);
  say(row.id, "agent", "text", `Investigating ${row.id} with ${MODEL ? `model ${MODEL}` : "the offline investigator (scripted, not model evidence)"} …`);
  const run = await investigateFromChat(file.incident, {
    telemetry: t, model: MODEL,
    onEvent: (e) => {
      if (e.type === "assistant" && e.parent_tool_use_id === null)
        for (const b of e.message.content) if (b.type === "tool_use") say(row.id, "agent", "tool", `${String(b.name).replace(/^mcp__telemetry__/, "")} ${JSON.stringify(b.input ?? {})}`);
    },
  });
  if (!run.result.ok) { say(row.id, "agent", "error", `FAIL contract\n- ${run.result.errors.join("\n- ")}`); return; }
  const v = run.result.value;
  say(row.id, "agent", "diagnosis", JSON.stringify(v));
  store.retitle(row.id, `${v.tag}: ${v.hypothesis.slice(0, 60)}`);
  const approval = draftApproval(v, new Date().toISOString());
  await writeApproval(APPROVALS, approval);
  say(row.id, "system", "approval", JSON.stringify(approval));
  if (run.lessonFile) say(row.id, "system", "text", `lesson proposed → ${run.lessonFile}`);
  broadcast("incidents", store.list());
};

// ── the deterministic alert listener ─────────────────────────────────────
/** oncall.md-style criteria. AGENT_LISTEN_WINDOW_MIN defaults to 5 (production); the demo scripts set 1. */
const CRITERIA = { errorRate: 0.02, p95Ms: 2000, minutes: Number(process.env.AGENT_LISTEN_WINDOW_MIN ?? 5), deployWindowMin: 10 } as const;
let lastOpened = 0;
const listen = async () => {
  const t = await telemetry();
  if (!t) return;
  const since = new Date(Date.now() - CRITERIA.minutes * 60_000).toISOString();
  const recent = t.metrics.filter((m) => m.ts >= since && (m.n ?? 1) >= 5);
  if (recent.length < 3) return;
  const sustained = recent.every((m) => m.error_rate > CRITERIA.errorRate) ? "error_rate" : recent.every((m) => m.p95_ms > CRITERIA.p95Ms) ? "p95_ms" : undefined;
  if (!sustained) return;
  const inDeployWindow = t.deploys.some((d) => Date.now() - Date.parse(d.at) < CRITERIA.deployWindowMin * 60_000);
  const open = store.list().some((i) => i.state === "active" && i.source === "alert");
  if (open || Date.now() - lastOpened < 10 * 60_000) return;
  lastOpened = Date.now();
  const alert = `${sustained} above ${sustained === "error_rate" ? `${CRITERIA.errorRate * 100}%` : `${CRITERIA.p95Ms} ms`} for ${CRITERIA.minutes} min on ${t.service}${inDeployWindow ? " (inside a deploy window)" : ""}`;
  const row = store.newIncident(alert, "alert");
  say(row.id, "system", "text", `listener: criteria met → ${alert}. ${inDeployWindow ? "Deploy window: morning-log unless the agent says page." : "Not a known deploy window: page-tier."}`);
  broadcast("incidents", store.list());
  void triage(row, alert);
};

// ── helpers ──────────────────────────────────────────────────────────────
const json = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const body = (req: IncomingMessage): Promise<Record<string, unknown>> => new Promise((r) => { let s = ""; req.on("data", (c: Buffer) => (s += c)); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });
const watches = new Map<string, AbortController>();
/** Executor calls in flight: a second click while the first runs is refused. */
const executing = new Set<string>();
const next = (row: IncidentRow) => nextAction(row.state, store.messages(row.id));
/** Refuse any button that is not the next allowed action. */
const allowed = (res: ServerResponse, row: IncidentRow, action: Action): boolean => {
  const n = next(row);
  if (n.allowed.includes(action) && !executing.has(row.id)) return true;
  json(res, 409, { error: `not allowed now: ${action}. Next: ${n.title}`, next: n });
  return false;
};

// ── routes ───────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  const m = url.pathname.match(/^\/api\/incidents\/([^/]+)(?:\/(\w+))?$/);

  if (req.method === "GET" && url.pathname === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(readFileSync(join(here, "index.html"))); }
  if (req.method === "GET" && url.pathname === "/api/health") {
    const t = await telemetry();
    const shop = await fetch(`${SHOP}/health`).then((r) => r.json()).catch(() => undefined);
    return json(res, 200, { shop, telemetry: t ? { buckets: t.metrics.length, deploys: t.deploys.length, path: TELEMETRY } : null, model: MODEL ?? "offline", listening: true });
  }
  if (req.method === "GET" && url.pathname === "/api/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(`event: incidents\ndata: ${JSON.stringify(store.list())}\n\n`);
    clients.add(res); req.on("close", () => clients.delete(res)); return;
  }
  if (req.method === "GET" && url.pathname === "/api/incidents") return json(res, 200, store.list());
  if (req.method === "POST" && url.pathname === "/api/incidents") {
    const b = await body(req);
    const title = String(b.title ?? "Production investigation");
    const row = store.newIncident(title, "human");
    if (b.investigate !== false) say(row.id, "user", "text", title);
    broadcast("incidents", store.list());
    json(res, 200, row);
    if (b.investigate !== false) void triage(row, title);
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/alerts") {
    const b = await body(req);
    const alert = String(b.alert ?? "alert");
    const row = store.newIncident(alert, "alert");
    say(row.id, "system", "text", `alert received via webhook: ${alert}`);
    broadcast("incidents", store.list());
    json(res, 202, row);
    void triage(row, alert);
    return;
  }
  if (m) {
    const [, id, action] = m;
    const row = store.get(id as string);
    if (!row) return json(res, 404, { error: "no such incident" });
    if (req.method === "GET" && !action) return json(res, 200, { incident: row, messages: store.messages(row.id), next: executing.has(row.id) ? { title: "Wait: the executor is running", detail: "Verifying checkouts on the rolled-back version.", allowed: [] } : next(row) });

    if (req.method === "POST" && action === "chat") {
      const text = String((await body(req)).text ?? "").trim();
      say(row.id, "user", "text", text);
      json(res, 202, { ok: true });
      const route = routeMessage(text);
      const t = await telemetry();
      if (route.kind === "refused") return void say(row.id, "agent", "error", route.reason);
      if (route.kind === "stop") { watches.get(row.id)?.abort(); return void say(row.id, "agent", "watch", "Stopping the deployment watch."); }
      if (route.kind === "investigate") return void triage(row, route.alert);
      if (route.kind === "watch") {
        const ac = new AbortController(); watches.set(row.id, ac);
        say(row.id, "agent", "watch", `Watching ${route.command.target} deployment for ${route.command.minutes} min. Policy: 3 consecutive verified failures | 3 consecutive >1000 ms | ≥3 5xx. No automatic rollback.`);
        const r = await runWatch(route.command, { shopUrl: SHOP, intervalMs: Number(process.env.AGENT_WATCH_INTERVAL_MS ?? 10_000), signal: ac.signal,
          onTick: (o, p) => say(row.id, "agent", "watch", `${o.verified ? (o.ok ? "ok" : "FAIL") : "unverified"} ${o.ms} ms rev ${o.revision ?? "?"} · streak f${p.consecutiveFailures}/s${p.consecutiveSlow}`) });
        watches.delete(row.id);
        say(row.id, "agent", "watch", `${r.outcome.toUpperCase()} · revision ${r.revision} · ${r.observations.length} checks${r.reason ? ` · ${r.reason}` : ""}`);
        if (r.outcome === "failed") { const w = store.newIncident(`Deployment watch failed on ${r.revision}: ${r.reason}`, "watch"); broadcast("incidents", store.list()); void triage(w, `Deployment watch failed on ${r.revision}: ${r.reason}`); }
        return;
      }
      if (!t) return void say(row.id, "agent", "error", `no telemetry at ${TELEMETRY}`);
      const answer = await ask(route.text, { telemetry: t, model: MODEL });
      return void say(row.id, "agent", "text", answer);
    }

    if (req.method === "POST" && (action === "approve" || action === "reject")) {
      if (!allowed(res, row, action)) return;
      const by = String((await body(req)).by ?? "").trim();
      const existing = await readApproval(APPROVALS, row.id);
      if (!existing.ok) return json(res, 400, { error: "no pending approval — investigate first" });
      const signed = decide(existing.value, action === "approve" ? "approved" : "rejected", by, new Date().toISOString());
      if (!signed.ok) return json(res, 400, { error: signed.errors.join("; ") });
      await writeApproval(APPROVALS, signed.value);
      say(row.id, "user", "approval", JSON.stringify(signed.value));
      return json(res, 200, signed.value);
    }
    if (req.method === "POST" && action === "execute") {
      const f = loadIncident(row);
      if (!f) return json(res, 400, { error: "no investigation on this incident" });
      if (!allowed(res, row, "execute")) return;
      executing.add(row.id); broadcast("incidents", store.list());
      json(res, 202, { ok: true });
      const fixAt = new Date().toISOString();
      const r = await execute(f.incident, { shopUrl: SHOP, approvalsDir: APPROVALS, telemetryPath: f.telemetry, log: (l) => say(row.id, "system", "executor", l) });
      executing.delete(row.id);
      if (!r.ok) { say(row.id, "system", "error", `REFUSED executor\n- ${r.errors.join("\n- ")}`); return void broadcast("incidents", store.list()); }
      say(row.id, "system", "recovery", JSON.stringify({ phase: "running" }));
      say(row.id, "system", "executor", `applied ${r.value.plan.from_version} → ${r.value.plan.to_version} with ${r.value.evidence.verified_ok} verified checkouts. Watching the metric land (3 checks) …`);
      const metric = JSON.parse(store.messages(row.id).find((x) => x.kind === "diagnosis")?.text ?? "{}").watch_metric === "p95_ms" ? "p95_ms" : "error_rate";
      const windowMs = Number(process.env.AGENT_WATCH_WINDOW_MS ?? 60_000);
      // Three bounded checks at half / full / double the window — not a polling loop.
      const delays = [windowMs / 2, windowMs / 2, windowMs];
      for (const [i, label] of (["half", "full", "double"] as const).entries()) {
        await new Promise((r2) => setTimeout(r2, delays[i]));
        const t = await telemetry();
        if (!t) { say(row.id, "system", "recovery", JSON.stringify({ phase: "done", landed: false, failed: [`${label} check: no telemetry at ${TELEMETRY}`] })); broadcast("incidents", store.list()); break; }
        const w = watchMetric(t, metric, f.incident.fired_at, fixAt, windowMs / 60_000);
        const c = w.checks[i];
        say(row.id, "agent", "watch", `${label} check @${c?.at.slice(11, 19)}: ${metric} = ${c?.value ?? "no data"} (baseline ${w.baseline}, limit ${w.limit}) ${c?.ok ? "✓" : "✗"}`);
        if (label === "double") {
          say(row.id, "agent", "text", w.landed
            ? "LANDED. The full and double checks passed. Only a human marks this mitigated and resolved."
            : `NOT LANDED. The full and double checks must both pass; the half check may fail.\nFailed:\n- ${w.failed.join("\n- ")}\nDo not close and do not execute again. Read the metric window and logs, then investigate or escalate.`);
          say(row.id, "system", "recovery", JSON.stringify({ phase: "done", landed: w.landed, failed: w.failed }));
          broadcast("incidents", store.list());
        }
      }
      return;
    }
    if (req.method === "POST" && action === "state") {
      const b = await body(req);
      if (b.state !== "mitigated" && b.state !== "resolved") return json(res, 400, { error: "state must be mitigated or resolved" });
      if (!allowed(res, row, b.state === "resolved" ? "resolve" : "mitigated")) return;
      const by = String(b.by ?? "").trim();
      const notes = String(b.notes ?? "").trim();
      if (b.state === "resolved" && notes.length === 0) return json(res, 400, { error: "resolution notes are required — they become the lesson" });
      try {
        const r = store.setState(row.id, b.state as IncidentRow["state"], by);
        if (b.state === "resolved") {
          const diag = store.messages(row.id).filter((x) => x.kind === "diagnosis").pop();
          const rec = diag ? (JSON.parse(diag.text) as Recommendation) : undefined;
          const entry = renderResolutionLesson(rec, row.id, (rec?.tag ?? "errors") as Tag, notes, by, new Date().toISOString());
          const path = await appendResolutionLesson(lessonsStore(), entry);
          say(row.id, "user", "text", `Resolution notes: ${notes}`);
          say(row.id, "system", "text", `lesson written → ${path} (human-authored, provenance ${row.id} by ${by})`);
        }
        broadcast("incidents", store.list()); return json(res, 200, r);
      } catch (e) { return json(res, 400, { error: (e as Error).message }); }
    }
  }
  json(res, 404, { error: "not found" });
});

setInterval(() => { void listen(); }, Number(process.env.AGENT_LISTEN_MS ?? 10_000)).unref();
setInterval(() => { const s = store.flagStale(); if (s.length) broadcast("incidents", store.list()); }, 60_000).unref();
server.listen(PORT, () => {
  console.log(`▶ on-call console  http://localhost:${PORT}`);
  console.log(`  shop ${SHOP} · telemetry ${TELEMETRY} · model ${MODEL ?? "offline"} · listening for alerts every 10 s`);
  console.log(`  alert webhook: curl -XPOST localhost:${PORT}/api/alerts -d '{"alert":"Error rate 12% on checkout"}'`);
});
void readFile; // (imported for symmetry with writeFile; keeps the import list honest)
