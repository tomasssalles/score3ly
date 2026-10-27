// D1 on Node's built-in SQLite (docs/desktop.md): the part of the D1 API the Worker uses (`prepare`,
// `bind`, `first`, `all`, `run`, `batch`, `exec`), over one SQLite file. The Worker's code doesn't change.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

type Meta = { changes: number; last_row_id: number; duration: number };
type Result<T> = { results: T[]; success: true; meta: Meta };

// D1 takes JavaScript values; SQLite takes these. Booleans become 1 and 0 as in D1, and binary data a Uint8Array.
function toSqlite(value: unknown): SQLInputValue {
  if (value === undefined) throw new TypeError("D1_TYPE_ERROR: undefined can't be bound");
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  return value as SQLInputValue;
}

// Rows as plain objects (SQLite's have no prototype), binary columns as ArrayBuffers as in D1.
function fromSqlite<T>(row: Record<string, SQLInputValue>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Uint8Array ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : value;
  }
  return out as T;
}

export class NodeD1Statement {
  private readonly db: DatabaseSync;
  readonly sql: string;
  private readonly params: SQLInputValue[];

  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): NodeD1Statement {
    return new NodeD1Statement(this.db, this.sql, values.map(toSqlite));
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as Record<string, SQLInputValue> | undefined;
    if (!row) return null;
    const value = fromSqlite<Record<string, unknown>>(row);
    return (column === undefined ? value : value[column]) as T;
  }

  async all<T = Record<string, unknown>>(): Promise<Result<T>> {
    return this.allSync<T>();
  }

  async run<T = Record<string, unknown>>(): Promise<Result<T>> {
    return this.allSync<T>();
  }

  async raw<T = unknown[]>(): Promise<T[]> {
    const statement = this.db.prepare(this.sql);
    statement.setReturnArrays(true);
    return statement.all(...this.params) as T[];
  }

  // A statement that returns rows (a SELECT, or one with RETURNING) gives them; any other gives its changes.
  allSync<T>(): Result<T> {
    const started = performance.now();
    const statement = this.db.prepare(this.sql);
    if (statement.columns().length > 0) {
      const rows = statement.all(...this.params) as Record<string, SQLInputValue>[];
      return { results: rows.map((row) => fromSqlite<T>(row)), success: true, meta: { changes: 0, last_row_id: 0, duration: performance.now() - started } };
    }
    const { changes, lastInsertRowid } = statement.run(...this.params);
    return { results: [], success: true, meta: { changes: Number(changes), last_row_id: Number(lastInsertRowid), duration: performance.now() - started } };
  }
}

export class NodeD1 {
  readonly db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    // As in D1.
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  }

  prepare(sql: string): NodeD1Statement {
    return new NodeD1Statement(this.db, sql);
  }

  // All or nothing, in order, as D1's batch.
  async batch<T = Record<string, unknown>>(statements: NodeD1Statement[]): Promise<Result<T>[]> {
    this.db.exec("BEGIN");
    try {
      const results = statements.map((statement) => statement.allSync<T>());
      this.db.exec("COMMIT");
      return results;
    } catch (err) {
      this.db.exec("ROLLBACK");
      throw err;
    }
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const started = performance.now();
    this.db.exec(sql);
    return { count: sql.split(";").filter((s) => s.trim()).length, duration: performance.now() - started };
  }

  close() {
    this.db.close();
  }
}

// Applies the migration files not applied yet, in order, each in a transaction, recording them as Wrangler does (a
// `d1_migrations` table), so a database moved between hosts knows where it is. Returns the names applied.
export function migrate(d1: NodeD1, dir: string): string[] {
  const db = d1.db;
  db.exec(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)",
  );
  const done = new Set((db.prepare("SELECT name FROM d1_migrations").all() as { name: string }[]).map((r) => r.name));
  const applied: string[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(name)) continue;
    db.exec("BEGIN");
    try {
      db.exec(readFileSync(join(dir, name), "utf8"));
      db.prepare("INSERT INTO d1_migrations (name) VALUES (?)").run(name);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw new Error(`migration ${name} failed: ${err instanceof Error ? err.message : err}`);
    }
    applied.push(name);
  }
  return applied;
}
