import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJson, sha256Hex } from "@score3ly/core";
import { testPlatform } from "../src/testPlatform.ts";
import { fillCallPlaces } from "./callPlaces.ts";

// The one-time script's logic, against Wrangler's local D1 and R2, kept in memory: calls made before migration 0004,
// with its placeholders.
let platform: Awaited<ReturnType<typeof testPlatform>>;
let env: Env;

before(async () => {
  platform = await testPlatform();
  env = platform.env;
  const migrationsDir = join(import.meta.dirname, "..", "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    const sql = readFileSync(join(migrationsDir, file), "utf8").replace(/--.*$/gm, "").replace(/\s+/g, " ").replace(/; /g, ";\n");
    await env.DB.exec(sql);
  }
  const at = "2026-11-01T10:00:00.000Z";
  await env.DB.batch([
    env.DB.prepare("INSERT INTO projects (id, name, pdf_sha256, pdf_filename, created_at, last_modified_at, last_opened_at) VALUES ('p', 'P', 'x', 'p.pdf', ?, ?, ?)").bind(at, at, at),
    env.DB.prepare("INSERT INTO model_configs (id, name, provider, model_id, pricing_kind, created_at) VALUES ('m', 'M', 'fake', 'fake', 'free', ?)").bind(at),
    ...["layout", "extract"].map((step) => env.DB.prepare("INSERT INTO stages (id, created_in, step, status, created_at) VALUES (?, 'p', ?, 'done', ?)").bind(step, step, at)),
  ]);
});

after(async () => {
  await platform.dispose();
});

const text = (t: string) => ({ type: "text", text: t });
const image = (recipeKey: string, sha256 = "a".repeat(64)) => ({ type: "image", recipeKey, mediaType: "image/png", sha256 });

// A call as migration 0004 left it, with its stored request (or none, as a deleted project's).
async function oldCall(id: string, stage: string | null, messages: { role: string; content: object[] }[] | null, status = "ok") {
  let sha: string | null = null;
  if (messages) {
    const body = canonicalJson({ system: "S", messages });
    sha = await sha256Hex(new TextEncoder().encode(body));
    await env.PDFS.put(`content/${sha}`, body);
  }
  await env.DB.prepare("INSERT INTO llm_calls (id, stage_id, model_config_id, request_key, request_sha256, status, started_at) VALUES (?, ?, 'm', ?, ?, ?, ?)")
    .bind(id, stage, `key-${id}`, sha, status, `2026-11-01T10:00:0${id.length % 10}.000Z`)
    .run();
}

async function output(id: string, stage: string, item: string, callId: string) {
  await env.DB.prepare("INSERT INTO outputs (id, stage_id, item, type, content_sha256, call_id, created_at) VALUES (?, ?, ?, 't', 'c', ?, '2026-11-01')").bind(id, stage, item, callId).run();
}

test("the places of older calls: from the outputs, the requests' rounds and first messages; the rest listed", async () => {
  // A config's Test.
  await oldCall("test", null, [{ role: "user", content: [image("k-test"), text("What colour?")] }]);
  // `layout`'s three rounds on page 2: only the last is named by an output.
  const first = { role: "user", content: [image("k-page2"), text("Find the systems.")] };
  const answer = (n: number) => ({ role: "assistant", content: [text(`{"round":${n}}`)] });
  const check = { role: "user", content: [image("k-drawn"), text("Check them.")] };
  await oldCall("l1", "layout", [first]);
  await oldCall("l2", "layout", [first, answer(1), check]);
  await oldCall("l3", "layout", [first, answer(1), check, answer(2), check]);
  await output("o-l", "layout", "p2", "l3");
  // `extract`: a call that failed, asked again (the image made again: other bytes, same recipe) and answered.
  await oldCall("e-failed", "extract", [{ role: "user", content: [image("k-s2", "b".repeat(64)), text("Transcribe.")] }], "unparseable");
  await oldCall("e-ok", "extract", [{ role: "user", content: [image("k-s2"), text("Transcribe.")] }]);
  await output("o-e", "extract", "p1/s2", "e-ok");
  // A deleted project's call (no request any more), named by an output; and one named by none.
  await oldCall("e-deleted", "extract", null);
  await output("o-d", "extract", "p1/s3", "e-deleted");
  await oldCall("l-deleted", "layout", null);
  // A call nothing tells the place of.
  await oldCall("e-lonely", "extract", [{ role: "user", content: [image("k-s9"), text("Transcribe.")] }], "error");

  const { filled, unplaced } = await fillCallPlaces(env.DB, env.PDFS);
  const places = Object.fromEntries(
    (await env.DB.prepare("SELECT id, item, round FROM llm_calls").all<{ id: string; item: string; round: number }>()).results.map((c) => [c.id, [c.item, c.round]]),
  );
  assert.deepEqual(places, {
    test: ["", 1],
    l1: ["p2", 1],
    l2: ["p2", 2],
    l3: ["p2", 3],
    "e-failed": ["p1/s2", 1],
    "e-ok": ["p1/s2", 1],
    "e-deleted": ["p1/s3", 1],
    "l-deleted": ["?", 0],
    "e-lonely": ["?", 0],
  });
  assert.equal(filled, 7);
  assert.deepEqual(unplaced.map((u) => u.id).sort(), ["e-lonely", "l-deleted"]);

  // Run again: nothing more to do, and what was filled stays.
  const again = await fillCallPlaces(env.DB, env.PDFS);
  assert.equal(again.filled, 0);
  assert.equal(again.unplaced.length, 2);
});
