import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { migrate, NodeD1 } from "./d1.ts";

const MIGRATIONS = join(import.meta.dirname, "../../worker/migrations");

function fresh(): NodeD1 {
  return new NodeD1(join(mkdtempSync(join(tmpdir(), "score3ly-d1-")), "db.sqlite"));
}

test("the Worker's migrations apply, once", () => {
  const db = fresh();
  const applied = migrate(db, MIGRATIONS);
  assert.ok(applied.length > 10);
  assert.deepEqual(migrate(db, MIGRATIONS), []);
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
