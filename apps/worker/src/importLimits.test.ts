// The import of a large project within D1's limits and a Worker's CPU (the code review's batch 11, E1): on the Node
// host, whose limits mode refuses a statement or a request over D1's limits (testPlatform.ts). The project is the size
// of the owner's test on the deployed instance (2026-11-24) or larger: Liszt's Consolations, 22 pages and 132 systems,
// run with the fake model, a 15.8 MB project.json. Here the replay fixture's page (six systems) is made 32 pages, 192
// systems: the fixture's rows per system are fewer than a real score's, and 22 pages make only 10.9 MB.

import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { type ExportRow, IMPORT_CHUNK_BYTES, importChunks, importHead, MISSING_CONTENT_BATCH, type ProjectExport, sha256Hex } from "@score3ly/core";
import { unzipSync } from "fflate";
import { testPlatform, type TestPlatform } from "./testPlatform.ts";
import { D1_LIMITS, NodeD1 } from "./node/d1.ts";
import app from "./index.ts";

let platform: TestPlatform;
let env: Env;

before(async () => {
  platform = await testPlatform("node");
  env = platform.env;
});

after(async () => {
  await platform.dispose();
});

const FIXTURE = join(import.meta.dirname, "../../../fixtures/replay/fake.s3l");
const PAGES = 32;

// The fixture's one page made `pages` pages: every row about page 1 or one of its systems copied for each page (new ids,
// keys and items), the whole score's once, reading every page's outputs.
function largeExport(pages: number): { rows: ProjectExport; files: Record<string, Uint8Array> } {
  const files = unzipSync(new Uint8Array(readFileSync(FIXTURE)));
  const rows = JSON.parse(new TextDecoder().decode(files["project.json"])) as ProjectExport;
  const perPage = (item: unknown) => typeof item === "string" && item.startsWith("p1");
  const onPage = (item: string, k: number) => item.replace(/^p1/, `p${k}`);
  const copyId = (id: unknown, k: number) => (k === 1 ? id : `${id}~${k}`);
  const hexFor = (hex: unknown, k: number) => (typeof hex === "string" && k > 1 ? k.toString(16).padStart(2, "0") + hex.slice(2) : hex);
  const pagedOutputs = new Set(rows.outputs.filter((o) => perPage(o.item)).map((o) => o.id));
  const pagedCalls = new Set(rows.llm_calls.filter((c) => perPage(c.item)).map((c) => c.id));
  const pageNumbers = Array.from({ length: pages }, (_, i) => i + 1);
  const outputRef = (id: unknown, k: number) => (pagedOutputs.has(id) ? copyId(id, k) : id);
  const out: ProjectExport = { ...rows, outputs: [], output_inputs: [], stage_inputs: [], llm_calls: [], image_fingerprints: [] };
  for (const c of rows.llm_calls) {
    for (const k of pagedCalls.has(c.id) ? pageNumbers : [1]) out.llm_calls.push({ ...c, id: copyId(c.id, k), item: onPage(String(c.item), k), request_key: hexFor(c.request_key, k), served_from: c.served_from && pagedCalls.has(c.served_from) ? copyId(c.served_from, k) : (c.served_from ?? null) });
  }
  for (const o of rows.outputs) {
    for (const k of pagedOutputs.has(o.id) ? pageNumbers : [1]) {
      out.outputs.push({
        ...o,
        id: copyId(o.id, k),
        item: onPage(String(o.item), k),
        parent_output_id: o.parent_output_id ? outputRef(o.parent_output_id, k) : null,
        call_id: o.call_id && pagedCalls.has(o.call_id) ? copyId(o.call_id, k) : o.call_id,
      });
    }
  }
  const links = (list: ExportRow[], from: string, to: string, fromPaged: (row: ExportRow) => boolean) => {
    const result: ExportRow[] = [];
    for (const row of list) {
      // A row about a page: copied for each page; a whole-score row reading a page's output: reads every page's.
      const ks = fromPaged(row) || pagedOutputs.has(row[to]) ? pageNumbers : [1];
      for (const k of ks) result.push({ ...row, [from]: fromPaged(row) ? copyId(row[from], k) : row[from], [to]: outputRef(row[to], k) });
    }
    return result;
  };
  out.output_inputs = links(rows.output_inputs, "output_id", "input_id", (r) => pagedOutputs.has(r.output_id));
  out.stage_inputs = links(rows.stage_inputs, "stage_id", "output_id", () => false);
  for (const f of rows.image_fingerprints) for (const k of pageNumbers) out.image_fingerprints.push({ ...f, recipe_key: hexFor(f.recipe_key, k) });
  return { rows: out, files };
}

function post(path: string, body: unknown) {
  return app.request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, env);
}

test("a project larger than the owner's test (15.8 MB) imports in requests that each stay within D1's limits", async (t) => {
  const { rows, files } = largeExport(PAGES);
  const text = JSON.stringify(rows, null, 2) + "\n"; // as the file holds it
  t.diagnostic(`project.json: ${(text.length / 1e6).toFixed(1)} MB, ${rows.outputs.length} outputs, ${rows.output_inputs.length} output inputs, ${rows.llm_calls.length} calls, ${rows.image_fingerprints.length} fingerprints`);
  assert.ok(text.length > 15e6, `${text.length} bytes`);
  assert.equal(new Set(rows.outputs.map((o) => String(o.item)).filter((item) => /^p\d+\/s\d+$/.test(item))).size, PAGES * 6);

  const pdf = rows.project.pdf_sha256;
  assert.equal((await app.request(`/api/pdfs/${pdf}`, { method: "PUT", body: files[`pdf/${pdf}.pdf`] as Uint8Array<ArrayBuffer> }, env)).status, 204);
  // Every request below runs inside NodeD1's count of a request's statements (testPlatform.ts): one over the limits
  // fails. Their times, for the record: Node's, not a Worker's, but the share each request has of the work.
  const times: number[] = [];
  const timed = async (path: string, body: unknown, size = JSON.stringify(body).length) => {
    const started = performance.now();
    const response = await post(path, body);
    times.push(performance.now() - started);
    assert.ok(response.ok, `${path}: ${await response.clone().text()}`);
    assert.ok(size < IMPORT_CHUNK_BYTES + 50_000, `${path}: ${size} bytes`);
    return response;
  };
  const head = await timed("/api/projects/import", importHead(rows, await sha256Hex(new TextEncoder().encode(text))));
  const { id } = (await head.json()) as { id: string };
  for (let i = 0; i < rows.content.length; i += MISSING_CONTENT_BATCH) await timed("/api/content/missing", { sha256s: rows.content.slice(i, i + MISSING_CONTENT_BATCH) });
  const chunks = importChunks(rows);
  for (const chunk of chunks) await timed(`/api/projects/${id}/import/rows`, chunk);
  await timed(`/api/projects/${id}/import/finish`, {});
  t.diagnostic(`${times.length} requests (${chunks.length} chunks); the slowest ${Math.max(...times).toFixed(1)} ms, the median ${times.sort((a, b) => a - b)[times.length >> 1].toFixed(1)} ms`);

  // All of it arrived.
  const n = async (sql: string) => (await env.DB.prepare(sql).bind(id).first<{ n: number }>())!.n;
  assert.equal(await n("SELECT COUNT(*) AS n FROM outputs o JOIN stages s ON s.id = o.stage_id WHERE s.created_in = ?"), rows.outputs.length);
  assert.equal(await n("SELECT COUNT(*) AS n FROM output_inputs oi JOIN outputs o ON o.id = oi.output_id JOIN stages s ON s.id = o.stage_id WHERE s.created_in = ?"), rows.output_inputs.length);
  assert.equal(await n("SELECT COUNT(*) AS n FROM llm_calls c JOIN stages s ON s.id = c.stage_id WHERE s.created_in = ?"), rows.llm_calls.length);
  assert.equal(await n("SELECT COUNT(*) AS n FROM pipeline_entries WHERE project_id = ?"), rows.pipeline.length);
  assert.equal(await n("SELECT COUNT(*) AS n FROM projects WHERE id = ? AND importing IS NULL"), 1);
  assert.equal(await n("SELECT COUNT(*) AS n FROM import_ids WHERE project_id = ?"), 0);
});

test("the limits mode refuses what D1 refuses: too many parameters, too many statements in a request", async () => {
  const db = env.DB as unknown as NodeD1;
  assert.throws(() => db.prepare(`SELECT ${Array.from({ length: D1_LIMITS.boundParameters + 1 }, () => "?").join(", ")}`).bind(...Array(D1_LIMITS.boundParameters + 1).fill(1)), /too many SQL variables/);
  await NodeD1.request(async () => {
    for (let i = 0; i < D1_LIMITS.statementsPerRequest; i++) await db.prepare("SELECT 1").first();
    await assert.rejects(db.prepare("SELECT 1").first(), /more than 50 statements/);
  });
  // Outside a request (a test's own setup), nothing is counted.
  for (let i = 0; i <= D1_LIMITS.statementsPerRequest; i++) await db.prepare("SELECT 1").first();
});

// The plan's order (the owner, 2026-11-24): a retry removes the unfinished import before asking which content is
// missing. Removing collects the content only it used, once over an hour old; asked first, the check would have found
// that content present, and the rows would then point to objects that are gone.
test("a retry asks for the content after removing the unfinished import: what that collected is uploaded again", async () => {
  // A platform of its own: the large project above shares this content.
  const shared = env;
  const own = await testPlatform("node");
  env = own.env;
  try {
    await retryInOrder();
  } finally {
    env = shared;
    await own.dispose();
  }
});

async function retryInOrder() {
  const { rows, files } = largeExport(1);
  const text = JSON.stringify(rows, null, 2) + "\n";
  const key = await sha256Hex(new TextEncoder().encode(text));
  const pdf = rows.project.pdf_sha256;
  await app.request(`/api/pdfs/${pdf}`, { method: "PUT", body: files[`pdf/${pdf}.pdf`] as Uint8Array<ArrayBuffer> }, env);
  for (const sha of rows.content) await app.request(`/api/content/${sha}`, { method: "PUT", body: files[`content/${sha}`] as Uint8Array<ArrayBuffer> }, env);
  // The first attempt: its head and its calls, then nothing more.
  const first = (await (await post("/api/projects/import", importHead(rows, key))).json()) as { id: string };
  assert.equal((await post(`/api/projects/${first.id}/import/rows`, importChunks(rows)[0])).status, 204);
  // A day later, its content is old enough to be collected once nothing refers to it.
  const filesDir = join((env.STORE as unknown as { root: string }).root);
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  for (const sha of rows.content) utimesSync(join(filesDir, "content", sha), dayAgo, dayAgo);
  const missing = async () => {
    const found: string[] = [];
    for (let i = 0; i < rows.content.length; i += MISSING_CONTENT_BATCH) {
      const response = await post("/api/content/missing", { sha256s: rows.content.slice(i, i + MISSING_CONTENT_BATCH) });
      found.push(...((await response.json()) as { missing: string[] }).missing);
    }
    return found;
  };
  // Asked before the retry's head: what the first attempt's calls name is there; the rest, which no row names (the
  // code review's E9), counts as missing although it is stored.
  const callContent = rows.llm_calls.flatMap((c) => [c.request_sha256, c.response_sha256]).filter((sha): sha is string => typeof sha === "string");
  assert.deepEqual(new Set(await missing()), new Set(rows.content.filter((sha) => !callContent.includes(sha))));
  const second = (await (await post("/api/projects/import", importHead(rows, key))).json()) as { id: string };
  // The first attempt's calls were all that named their requests and responses: collected with it, and missing now.
  const nowMissing = await missing();
  for (const sha of new Set(callContent)) assert.ok(nowMissing.includes(sha), sha);
  for (const sha of nowMissing) assert.equal((await app.request(`/api/content/${sha}`, { method: "PUT", body: files[`content/${sha}`] as Uint8Array<ArrayBuffer> }, env)).status, 204);
  for (const chunk of importChunks(rows)) assert.equal((await post(`/api/projects/${second.id}/import/rows`, chunk)).status, 204);
  assert.equal((await post(`/api/projects/${second.id}/import/finish`, {})).status, 201);
  for (const sha of callContent) assert.ok(await env.STORE.head(`content/${sha}`), sha);
  assert.deepEqual(await missing(), []);
}
