/**
 * store.ts — incidents and conversation, persisted locally (node:sqlite)
 * ---------------------------------------------------------------------------
 * Owain's console keeps incidents, runs, messages and evidence in Postgres.
 * Locally, SQLite in one file does the same job with no service to run.
 *
 * Four incident states, every arrow into closed states is a HUMAN action
 * (oncall-kit). The agent may only flag `stale`; it never resolves.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export const STATES = ["active", "stale", "mitigated", "resolved"] as const;
export type State = (typeof STATES)[number];
export const SOURCES = ["alert", "human", "watch"] as const;
export type Source = (typeof SOURCES)[number];

export interface IncidentRow {
  readonly id: string;
  readonly title: string;
  readonly source: Source;
  readonly state: State;
  readonly created_at: string;
  readonly updated_at: string;
  /** JSON: the incident file contents { incident, telemetry } once an investigation ran. */
  readonly incident_json: string | null;
}

export interface MessageRow {
  readonly id: number;
  readonly incident_id: string;
  readonly role: "user" | "agent" | "system";
  readonly kind: "text" | "diagnosis" | "tool" | "watch" | "approval" | "executor" | "error" | "recovery";
  readonly text: string;
  readonly at: string;
}

export class Store {
  private db: DatabaseSync;
  constructor(path = process.env.AGENT_DB ?? "console/data/oncall.sqlite") {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, source TEXT NOT NULL, state TEXT NOT NULL,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, incident_json TEXT
      );
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT NOT NULL, role TEXT NOT NULL,
        kind TEXT NOT NULL, text TEXT NOT NULL, at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS messages_incident ON messages(incident_id, id);
    `);
  }

  newIncident(title: string, source: Source, id = `INC-${Date.now().toString().slice(-5)}`): IncidentRow {
    const now = new Date().toISOString();
    this.db.prepare("INSERT INTO incidents VALUES (?, ?, ?, 'active', ?, ?, NULL)").run(id, title, source, now, now);
    return this.get(id) as IncidentRow;
  }
  get(id: string): IncidentRow | undefined {
    return this.db.prepare("SELECT * FROM incidents WHERE id = ?").get(id) as IncidentRow | undefined;
  }
  list(): IncidentRow[] {
    return this.db.prepare("SELECT * FROM incidents ORDER BY updated_at DESC, rowid DESC").all() as unknown as IncidentRow[];
  }
  /** State transitions. `by` is required for every arrow into a closed state. */
  setState(id: string, state: State, by: string): IncidentRow {
    if ((state === "resolved" || state === "mitigated") && by.trim().length === 0) throw new Error("a named human is required to mitigate or resolve");
    this.db.prepare("UPDATE incidents SET state = ?, updated_at = ? WHERE id = ?").run(state, new Date().toISOString(), id);
    this.add(id, "system", "text", `state → ${state}${by ? ` by ${by}` : ""}`);
    return this.get(id) as IncidentRow;
  }
  setIncidentJson(id: string, json: string): void {
    this.db.prepare("UPDATE incidents SET incident_json = ?, updated_at = ? WHERE id = ?").run(json, new Date().toISOString(), id);
  }
  retitle(id: string, title: string): void {
    this.db.prepare("UPDATE incidents SET title = ? WHERE id = ?").run(title, id);
  }
  add(incidentId: string, role: MessageRow["role"], kind: MessageRow["kind"], text: string): MessageRow {
    const at = new Date().toISOString();
    const r = this.db.prepare("INSERT INTO messages (incident_id, role, kind, text, at) VALUES (?, ?, ?, ?, ?)").run(incidentId, role, kind, text, at);
    this.db.prepare("UPDATE incidents SET updated_at = ? WHERE id = ?").run(at, incidentId);
    return { id: Number(r.lastInsertRowid), incident_id: incidentId, role, kind, text, at };
  }
  messages(incidentId: string): MessageRow[] {
    return this.db.prepare("SELECT * FROM messages WHERE incident_id = ? ORDER BY id").all(incidentId) as unknown as MessageRow[];
  }
  /** Incidents quiet past the policy window → the agent may FLAG stale (a nudge, never a closure). */
  flagStale(quietMinutes = 60): IncidentRow[] {
    const cutoff = new Date(Date.now() - quietMinutes * 60_000).toISOString();
    const rows = this.db.prepare("SELECT * FROM incidents WHERE state = 'active' AND updated_at <= ?").all(cutoff) as unknown as IncidentRow[];
    for (const r of rows) {
      this.db.prepare("UPDATE incidents SET state = 'stale' WHERE id = ?").run(r.id);
      this.add(r.id, "agent", "text", `flagged stale: no update for ${quietMinutes} min. Evidence: last activity ${r.updated_at}. This is a nudge, not a closure — a human decides.`);
    }
    return rows;
  }
}
