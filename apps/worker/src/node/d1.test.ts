import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { migrate, NodeD1 } from "./d1.ts";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");

function fresh(): NodeD1 {
  return new NodeD1(join(mkdtempSync(join(tmpdir(), "score3ly-d1-")), "db.sqlite"));
}

test("the Worker's migrations apply, once", () => {
  const db = fresh();
  const applied = migrate(db, MIGRATIONS);
  assert.deepEqual(applied, readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort());
  assert.ok(applied.length >= 5);
  assert.deepEqual(migrate(db, MIGRATIONS), []);
});

// Migration 0009 makes places required (the code review's E6): on a database that still has calls with the placeholders
// of migration 0004 (calls the one-time script couldn't place), it applies, and keeps them as they are.
test("migration 0009 applies over calls that still have placeholder places, and keeps them", () => {
  const db = fresh();
  const before = mkdtempSync(join(tmpdir(), "score3ly-migrations-"));
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql") && f < "0009")) copyFileSync(join(MIGRATIONS, file), join(before, file));
  migrate(db, before);
  db.db.exec("INSERT INTO model_configs (id, name, provider, model_id, secrets_json, pricing_kind, created_at) VALUES ('m', 'Opus', 'anthropic', 'claude-opus-5-5', '{}', 'list', '2026-10-01')");
  db.db.exec("INSERT INTO llm_calls (id, model_config_id, request_key, status, started_at) VALUES ('old', 'm', 'k', 'ok', '2026-10-01')");
  assert.ok(migrate(db, MIGRATIONS).includes("0009_served_calls.sql"));
  assert.deepEqual({ ...(db.db.prepare("SELECT item, round, served_from FROM llm_calls WHERE id = 'old'").get() as object) }, { item: "?", round: 0, served_from: null });
  db.db.exec("UPDATE llm_calls SET deleted_at = '2026-11-01' WHERE id = 'old'"); // its other columns still change
  assert.throws(() => db.db.exec("INSERT INTO llm_calls (id, model_config_id, request_key, status, started_at) VALUES ('new', 'm', 'k', 'ok', '2026-10-02')"), /needs its place/);
});

test("statements: first, all, run, bound values as D1 takes them", async () => {
  const db = fresh();
  await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT, flag INTEGER, data BLOB)");
  const insert = db.prepare("INSERT INTO t (name, flag, data) VALUES (?, ?, ?)");
  const run = await insert.bind("a", true, new Uint8Array([1, 2]).buffer).run();
  assert.equal(run.meta.changes, 1);
  assert.equal(run.meta.last_row_id, 1);
  await insert.bind("b", false, null).run();
  assert.deepEqual(await db.prepare("SELECT name, flag FROM t WHERE id = ?").bind(1).first(), { name: "a", flag: 1 });
  assert.equal(await db.prepare("SELECT name FROM t WHERE id = ?").bind(2).first("name"), "b");
  assert.equal(await db.prepare("SELECT name FROM t WHERE id = 9").first(), null);
  const { results } = await db.prepare("SELECT data FROM t ORDER BY id").all<{ data: ArrayBuffer | null }>();
  assert.deepEqual([...new Uint8Array(results[0].data!)], [1, 2]);
  assert.equal(results[1].data, null);
  assert.throws(() => db.prepare("SELECT ?").bind(undefined));
});

test("a batch is all or nothing", async () => {
  const db = fresh();
  await db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  const results = await db.batch([db.prepare("INSERT INTO t (name) VALUES ('a')"), db.prepare("SELECT name FROM t")]);
  assert.deepEqual(results[1].results, [{ name: "a" }]);
  await assert.rejects(db.batch([db.prepare("INSERT INTO t (name) VALUES ('b')"), db.prepare("INSERT INTO t (name) VALUES (NULL)")]));
  assert.deepEqual((await db.prepare("SELECT name FROM t").all()).results, [{ name: "a" }]);
});

test("foreign keys are enforced, as in D1", async () => {
  const db = fresh();
  await db.exec("CREATE TABLE p (id TEXT PRIMARY KEY); CREATE TABLE c (p TEXT REFERENCES p(id))");
  await assert.rejects(db.prepare("INSERT INTO c VALUES ('x')").run());
});
