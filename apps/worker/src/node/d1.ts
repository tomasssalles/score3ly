// D1 on Node's built-in SQLite (docs/desktop.md): the part of the D1 API the Worker uses (`prepare`,
// `bind`, `first`, `all`, `run`, `batch`, `exec`), over one SQLite file. The Worker's code doesn't change. The desktop
// version's database, and the Node host of the Worker's tests (testPlatform.ts).

import { AsyncLocalStorage } from "node:async_hooks";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

// D1's limits (https://developers.cloudflare.com/d1/platform/limits/), which only the deployed instance has: local
// SQLite (Wrangler's, the desktop's) enforces none of them, so a statement or a request over them passes every test
// and fails in production (the code review, A3 and E1). NodeD1's limits mode enforces them, for the Worker's tests on
// the Node host (testPlatform.ts). Statements per request: D1 on the Free plan allows 50 queries per Worker
// invocation; whether a batch counts as one or as each of its statements isn't documented (E1's import ran a batch of
// thousands on the Free plan), so each statement counts, on the safe side.
export const D1_LIMITS = {
  boundParameters: 100,
  sqlBytes: 100_000,
  valueBytes: 2_000_000,
  statementsPerRequest: 50,
};

// What one request has done so far, while the limits mode counts (`NodeD1.request`).
type RequestCount = { statements: number };
const currentRequest = new AsyncLocalStorage<RequestCount>();

function overLimit(what: string): Error {
  return new Error(`D1_ERROR: over D1's limits (NodeD1's limits mode): ${what}`);
}

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
  private readonly limits: boolean;

  constructor(db: DatabaseSync, sql: string, params: SQLInputValue[] = [], limits = false) {
    this.db = db;
    this.sql = sql;
    this.params = params;
    this.limits = limits;
    if (limits) {
      if (Buffer.byteLength(sql) > D1_LIMITS.sqlBytes) throw overLimit(`a statement of ${Buffer.byteLength(sql)} bytes (at most ${D1_LIMITS.sqlBytes})`);
      if (params.length > D1_LIMITS.boundParameters) throw overLimit(`too many SQL variables: ${params.length} bound parameters (at most ${D1_LIMITS.boundParameters})`);
      for (const value of params) {
        const size = typeof value === "string" ? Buffer.byteLength(value) : value instanceof Uint8Array ? value.byteLength : 0;
        if (size > D1_LIMITS.valueBytes) throw overLimit(`a bound value of ${size} bytes (at most ${D1_LIMITS.valueBytes})`);
      }
    }
  }

  bind(...values: unknown[]): NodeD1Statement {
    return new NodeD1Statement(this.db, this.sql, values.map(toSqlite), this.limits);
  }

  // In the limits mode, each statement run counts against its request's.
  private counted() {
    const request = this.limits ? currentRequest.getStore() : undefined;
    if (request && ++request.statements > D1_LIMITS.statementsPerRequest) {
      throw overLimit(`more than ${D1_LIMITS.statementsPerRequest} statements in one request`);
    }
  }

  async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
    this.counted();
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

  // A statement that returns rows (a SELECT, or one with RETURNING) gives them; any other gives its changes.
  allSync<T>(): Result<T> {
    this.counted();
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
  readonly limits: boolean;

  // `limits`: D1's limits enforced (D1_LIMITS); statements are counted per request inside `request`.
  constructor(path: string, options: { limits?: boolean } = {}) {
    this.db = new DatabaseSync(path);
    this.limits = options.limits ?? false;
    // As in D1.
    this.db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  }

  prepare(sql: string): NodeD1Statement {
    return new NodeD1Statement(this.db, sql, [], this.limits);
  }

  // Runs one request's work (a Worker invocation), its statements counted apart from other requests' in the limits
  // mode. The count follows the request's async work, a response streamed after `fn` returns included.
  static request<T>(fn: () => T): T {
    return currentRequest.run({ statements: 0 }, fn);
  }

  // The statements run so far by the request this is called in (limits mode), for tests that look at a request's share.
  static statementsSoFar(): number {
    return currentRequest.getStore()?.statements ?? 0;
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
