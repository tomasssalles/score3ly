import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";
import app from "./index.ts";

// The tests run the API against Wrangler's local R2 and D1, kept in memory.
const workerDir = join(import.meta.dirname, "..");
let platform: Awaited<ReturnType<typeof getPlatformProxy<Env>>>;
let env: Env;

before(async () => {
  platform = await getPlatformProxy<Env>({ configPath: join(workerDir, "wrangler.jsonc"), persist: false });
  env = platform.env;
  const migrationsDir = join(workerDir, "migrations");
  for (const file of readdirSync(migrationsDir).sort()) {
    await env.DB.exec(withoutComments(readFileSync(join(migrationsDir, file), "utf8")));
  }
});

beforeEach(async () => {
  await env.DB.exec("DELETE FROM projects");
});

after(async () => {
  await platform.dispose();
});

// D1's exec() wants each statement on one line, without comments.
function withoutComments(sql: string): string {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .replace(/; /g, ";\n");
}

// Stands in for a PDF: the API never looks inside the file.
function pdfBytes(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function postProject(fields: { pdf?: Uint8Array<ArrayBuffer>; filename?: string; sha256?: string }) {
  const form = new FormData();
  if (fields.pdf) {
    form.append("pdf", new File([fields.pdf], fields.filename ?? "score.pdf"));
  }
  if (fields.sha256 !== undefined) {
    form.append("sha256", fields.sha256);
  }
  return app.request("/api/projects", { method: "POST", body: form }, env);
}

async function projectRows() {
  const { results } = await env.DB.prepare("SELECT * FROM projects ORDER BY pdf_filename").all();
  return results;
}

test("creating a project stores the PDF in R2 and a row in D1", async () => {
  const pdf = pdfBytes("first pdf");
  const sha256 = await sha256Hex(pdf);
  const started = Date.now();

  const response = await postProject({ pdf, filename: "sonata.pdf", sha256 });

  assert.equal(response.status, 201);
  const project = (await response.json()) as Record<string, string>;
  assert.equal(project.pdfSha256, sha256);
  assert.equal(project.pdfFilename, "sonata.pdf");
  assert.ok(project.id.length > 0);
  const created = Date.parse(project.createdAt);
  assert.ok(created >= started && created <= Date.now());

  assert.deepEqual(await projectRows(), [
    { id: project.id, pdf_sha256: sha256, pdf_filename: "sonata.pdf", created_at: project.createdAt },
  ]);

  const stored = await env.PDFS.get(`pdfs/${sha256}.pdf`);
  assert.ok(stored);
  assert.deepEqual(new Uint8Array(await stored.arrayBuffer()), pdf);
});

test("a PDF that is already known gets another project", async () => {
  const pdf = pdfBytes("second pdf");
  const sha256 = await sha256Hex(pdf);

  const first = (await (await postProject({ pdf, filename: "a.pdf", sha256 })).json()) as Record<string, string>;
  const second = (await (await postProject({ pdf, filename: "b.pdf", sha256 })).json()) as Record<string, string>;

  assert.notEqual(first.id, second.id);
  const rows = await projectRows();
  assert.deepEqual(
    rows.map((row) => [row.id, row.pdf_sha256, row.pdf_filename]),
    [
      [first.id, sha256, "a.pdf"],
      [second.id, sha256, "b.pdf"],
    ],
  );
});

test("a hash that doesn't match the PDF creates nothing", async () => {
  const pdf = pdfBytes("third pdf");
  const wrongSha256 = await sha256Hex(pdfBytes("something else"));

  const response = await postProject({ pdf, sha256: wrongSha256 });

  assert.equal(response.ok, false);
  assert.deepEqual(await projectRows(), []);
  assert.equal(await env.PDFS.get(`pdfs/${wrongSha256}.pdf`), null);
});

test("a request without a PDF or with a malformed hash is rejected", async () => {
  const pdf = pdfBytes("fourth pdf");
  const sha256 = await sha256Hex(pdf);

  assert.equal((await postProject({ sha256 })).status, 400);
  assert.equal((await postProject({ pdf })).status, 400);
  assert.equal((await postProject({ pdf, sha256: sha256.toUpperCase() })).status, 400);
  assert.equal((await postProject({ pdf, sha256: "../" + sha256 })).status, 400);
  assert.deepEqual(await projectRows(), []);
});
